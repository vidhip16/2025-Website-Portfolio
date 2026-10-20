// Unit tests for the fail-closed contact handler (blueprint §7). Project "unit":
// pure Node, no browser, no server. fetch is a recording fake, so nothing here
// can ever reach Formspree.
import { expect, test } from "@playwright/test";
import {
  FORMSPREE_DEFAULT_ID,
  formDataBytes,
  handleContact,
  type ContactEnv,
} from "../../app/actions/contact-core";
import { CONTACT_LIMITS } from "../../app/actions/contact-shared";
import { contact } from "../../content/site";

const NOW = 1_800_000_000_000;
const copy = contact.form;

type Call = { url: string; init?: RequestInit };

function harness(env: ContactEnv, opts: { status?: number; throws?: boolean } = {}) {
  const calls: Call[] = [];
  const logs: unknown[][] = [];
  const errors: unknown[][] = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (opts.throws) throw new Error("ECONNRESET secret-internal-detail");
    return new Response(opts.status === 204 ? null : "{}", { status: opts.status ?? 200 });
  }) as typeof fetch;
  const deps = {
    env,
    fetch: fakeFetch,
    now: () => NOW,
    log: { log: (...a: unknown[]) => void logs.push(a), error: (...a: unknown[]) => void errors.push(a) },
  };
  return { deps, calls, logs, errors };
}

const VALID = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Hello Vidhi, I'd like to talk about a role.",
  company: "",
  t: "",
};

function form(overrides: Partial<Record<keyof typeof VALID, string | null>> = {}) {
  const fd = new FormData();
  const fields = { ...VALID, ...overrides };
  for (const [k, v] of Object.entries(fields)) if (v !== null) fd.append(k, v);
  return fd;
}

const PROD: ContactEnv = { VERCEL_ENV: "production" };

test.describe("contact action: fail-closed sending", () => {
  for (const [label, env] of [
    ["VERCEL_ENV unset", {}],
    ["VERCEL_ENV=preview", { VERCEL_ENV: "preview" }],
    ["VERCEL_ENV=development", { VERCEL_ENV: "development" }],
    ["production with CONTACT_MODE=mock", { VERCEL_ENV: "production", CONTACT_MODE: "mock" }],
    ["preview with a form id set", { VERCEL_ENV: "preview", FORMSPREE_FORM_ID: "xyz" }],
  ] as const) {
    test(`never calls fetch when ${label}`, async () => {
      const h = harness(env);
      const state = await handleContact(form(), h.deps);
      expect(h.calls).toHaveLength(0);
      expect(state.status).toBe("success");
      expect(state.message).toBe(copy.success);
      expect(h.logs).toContainEqual(["contact: mock"]);
    });
  }

  test("sends once to Formspree in production, with the documented body", async () => {
    const h = harness(PROD);
    const state = await handleContact(form({ name: "  Ada Lovelace  " }), h.deps);
    expect(state.status).toBe("success");
    expect(h.calls).toHaveLength(1);
    const [{ url, init }] = h.calls;
    expect(url).toBe(`https://formspree.io/f/${FORMSPREE_DEFAULT_ID}`);
    expect(url).toBe("https://formspree.io/f/mqadvbog");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: VALID.message,
      _replyto: "ada@example.com",
      _subject: "Portfolio: Ada Lovelace",
    });
    expect(h.logs).not.toContainEqual(["contact: mock"]);
  });

  test("uses FORMSPREE_FORM_ID when set, and the default when it is empty", async () => {
    const custom = harness({ ...PROD, FORMSPREE_FORM_ID: "abc123" });
    await handleContact(form(), custom.deps);
    expect(custom.calls[0]?.url).toBe("https://formspree.io/f/abc123");

    const empty = harness({ ...PROD, FORMSPREE_FORM_ID: "" });
    await handleContact(form(), empty.deps);
    expect(empty.calls[0]?.url).toBe("https://formspree.io/f/mqadvbog");
  });

  test("a non-2xx response returns the generic error and logs the status", async () => {
    const h = harness(PROD, { status: 422 });
    const state = await handleContact(form(), h.deps);
    expect(state.status).toBe("error");
    expect(state.message).toBe(copy.errors.server);
    expect(state.fieldErrors).toBeUndefined();
    expect(h.errors.flat()).toContain(422);
  });

  test("a network failure never leaks the raw error message", async () => {
    const h = harness(PROD, { throws: true });
    const state = await handleContact(form(), h.deps);
    expect(state.status).toBe("error");
    expect(state.message).toBe(copy.errors.server);
    expect(JSON.stringify(state)).not.toContain("secret-internal-detail");
    expect(JSON.stringify(h.errors)).not.toContain("secret-internal-detail");
  });
});

test.describe("contact action: bot traps return silent success", () => {
  test("honeypot filled", async () => {
    const h = harness(PROD);
    const state = await handleContact(form({ company: "Acme Corp" }), h.deps);
    expect(state.status).toBe("success");
    expect(state.message).toBe(copy.success);
    expect(h.calls).toHaveLength(0);
  });

  test("submitted less than 3 s after the form mounted", async () => {
    const h = harness(PROD);
    const state = await handleContact(form({ t: String(NOW - 1200) }), h.deps);
    expect(state.status).toBe("success");
    expect(h.calls).toHaveLength(0);
  });

  test("exactly at the threshold is allowed through", async () => {
    const h = harness(PROD);
    await handleContact(form({ t: String(NOW - CONTACT_LIMITS.minFillMs) }), h.deps);
    expect(h.calls).toHaveLength(1);
  });

  test("an older timestamp, an empty one (no-JS) or none at all sends", async () => {
    for (const t of [String(NOW - 60_000), "", null]) {
      const h = harness(PROD);
      await handleContact(form({ t }), h.deps);
      expect(h.calls, `t=${t}`).toHaveLength(1);
    }
  });

  test("a client clock running ahead is not mistaken for a bot", async () => {
    const h = harness(PROD);
    await handleContact(form({ t: String(NOW + 90_000) }), h.deps);
    expect(h.calls).toHaveLength(1);
  });

  test("a tampered timestamp is dropped silently", async () => {
    for (const t of ["soon", "-5", "1.5"]) {
      const h = harness(PROD);
      const state = await handleContact(form({ t }), h.deps);
      expect(state.status, `t=${t}`).toBe("success");
      expect(state.fieldErrors).toBeUndefined();
      expect(h.calls).toHaveLength(0);
    }
  });
});

test.describe("contact action: validation", () => {
  test("each bad field gets its own copy, nothing is sent, input is echoed", async () => {
    const h = harness(PROD);
    const state = await handleContact(
      form({ name: "   ", email: "not-an-email", message: "too short" }),
      h.deps,
    );
    expect(h.calls).toHaveLength(0);
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toEqual({
      name: copy.errors.name,
      email: copy.errors.email,
      message: copy.errors.message,
    });
    expect(state.values).toEqual({ name: "   ", email: "not-an-email", message: "too short" });
  });

  test("missing fields are field errors, not crashes", async () => {
    const h = harness(PROD);
    const state = await handleContact(form({ name: null, email: null, message: null }), h.deps);
    expect(state.status).toBe("error");
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(["email", "message", "name"]);
    expect(h.calls).toHaveLength(0);
  });

  test("length limits", async () => {
    const cases: [Partial<typeof VALID>, "name" | "email" | "message", string][] = [
      [{ name: "a".repeat(CONTACT_LIMITS.name + 1) }, "name", copy.errors.nameLong],
      [{ email: `${"a".repeat(250)}@example.com` }, "email", copy.errors.email],
      [{ message: "m".repeat(CONTACT_LIMITS.message + 1) }, "message", copy.errors.messageLong],
      [{ message: "         9" }, "message", copy.errors.message],
    ];
    for (const [overrides, field, text] of cases) {
      const h = harness(PROD);
      const state = await handleContact(form(overrides), h.deps);
      expect(state.status, field).toBe("error");
      expect(state.fieldErrors?.[field], field).toBe(text);
      expect(h.calls).toHaveLength(0);
    }
  });

  test("too-long fields get their own copy; too-short and invalid keep theirs", async () => {
    const h = harness(PROD);
    const long = await handleContact(
      form({ name: "n".repeat(CONTACT_LIMITS.name + 1), message: "m".repeat(CONTACT_LIMITS.message + 1) }),
      h.deps,
    );
    expect(long.fieldErrors).toEqual({ name: copy.errors.nameLong, message: copy.errors.messageLong });
    // Echoed input is capped at the field limits.
    expect(long.values?.name).toHaveLength(CONTACT_LIMITS.name);
    expect(long.values?.message).toHaveLength(CONTACT_LIMITS.message);

    // Exactly at the limit is fine; whitespace is trimmed before the limit applies.
    const atLimit = await handleContact(
      form({ name: ` ${"n".repeat(CONTACT_LIMITS.name)} `, message: "m".repeat(CONTACT_LIMITS.message) }),
      h.deps,
    );
    expect(atLimit.status).toBe("success");

    const short = await handleContact(form({ name: "", message: "short" }), h.deps);
    expect(short.fieldErrors).toEqual({ name: copy.errors.name, message: copy.errors.message });
    expect(short.fieldErrors?.name).not.toBe(copy.errors.nameLong);
  });

  test("validation runs before the bot checks", async () => {
    const h = harness(PROD);
    const state = await handleContact(form({ email: "nope", company: "bot" }), h.deps);
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBe(copy.errors.email);
  });

  test("anything that isn't FormData is a generic error", async () => {
    const h = harness(PROD);
    for (const input of [undefined, null, "name=a", { name: "Ada" }]) {
      const state = await handleContact(input, h.deps);
      expect(state.status).toBe("error");
      expect(state.message).toBe(copy.errors.server);
    }
    expect(h.calls).toHaveLength(0);
  });
});

test.describe("contact action: body size", () => {
  test("rejects more than 8 KB of posted fields before validating", async () => {
    const h = harness(PROD);
    const big = form({ message: "x".repeat(9000) });
    expect(formDataBytes(big)).toBeGreaterThan(CONTACT_LIMITS.bodyBytes);
    const state = await handleContact(big, h.deps);
    expect(state.status).toBe("error");
    expect(state.message).toBe(copy.errors.tooLarge);
    expect(state.message).not.toBe(copy.errors.server);
    expect(state.fieldErrors).toBeUndefined();
    expect(state.at).toBe(NOW);
    // The input comes back capped at the field limits, so a no-JS post can be shortened.
    expect(state.values?.name).toBe(VALID.name);
    expect(state.values?.message).toHaveLength(CONTACT_LIMITS.message);
    expect(h.calls).toHaveLength(0);
  });

  test("counts UTF-8 bytes, and an unknown oversized field is rejected too", async () => {
    // 3,000 Devanagari characters: inside the 4,000-character limit, but 9,000 bytes.
    const multiByte = form({ message: "ह".repeat(3000) });
    expect(formDataBytes(multiByte)).toBeGreaterThan(CONTACT_LIMITS.bodyBytes);

    const h = harness(PROD);
    const multiState = await handleContact(multiByte, h.deps);
    expect(multiState.status).toBe("error");
    expect(multiState.message).toBe(copy.errors.tooLarge);
    expect(multiState.values?.message).toBe("ह".repeat(3000));

    const extra = form();
    extra.append("padding", "p".repeat(10_000));
    const state = await handleContact(extra, h.deps);
    expect(state.status).toBe("error");
    expect(state.message).toBe(copy.errors.tooLarge);
    expect(state.values).toEqual({ name: VALID.name, email: VALID.email, message: VALID.message });
    expect(h.calls).toHaveLength(0);
  });

  test("ignores React's $ACTION_ bookkeeping keys (no-JS posts)", async () => {
    const fd = form();
    fd.append("$ACTION_1:1", JSON.stringify([{ status: "error", values: { message: "y".repeat(7000) } }]));
    expect(formDataBytes(fd)).toBeLessThan(CONTACT_LIMITS.bodyBytes);
    const h = harness(PROD);
    await handleContact(fd, h.deps);
    expect(h.calls).toHaveLength(1);
  });

  test("a full 4,000-character ASCII message fits", async () => {
    const h = harness(PROD);
    const state = await handleContact(form({ message: "z".repeat(CONTACT_LIMITS.message) }), h.deps);
    expect(state.status).toBe("success");
    expect(h.calls).toHaveLength(1);
  });
});
