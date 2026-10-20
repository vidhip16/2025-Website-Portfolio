// Pure contact handler (blueprint §7). No next/* imports: env, fetch, clock and
// logger are injected so tests/unit/contact.spec.ts can prove the fail-closed
// rules. app/actions/contact.ts is the thin "use server" wrapper.
//
// Order of checks:
//   1. reject posted fields > 8 KB
//   2. zod validation
//   3. silent success for the honeypot or a too-fast submit
//   4. send to Formspree, only when VERCEL_ENV=production and CONTACT_MODE!=mock
//   5. non-2xx → generic error, console.error(status)
// Relative imports (not "@/") keep this loadable by the Playwright unit runner.
import { z } from "zod";
import { contact } from "../../content/site";
import {
  CONTACT_LIMITS as L,
  type ContactField,
  type ContactState,
  type ContactValues,
} from "./contact-shared";

export const FORMSPREE_DEFAULT_ID = "mqadvbog";
export const FORMSPREE_TIMEOUT_MS = 8000;

export type ContactEnv = {
  VERCEL_ENV?: string;
  CONTACT_MODE?: string;
  FORMSPREE_FORM_ID?: string;
};

export type ContactDeps = {
  env: ContactEnv;
  fetch: typeof fetch;
  now: () => number;
  log?: Pick<Console, "log" | "error">;
};

const copy = contact.form;

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(L.name),
  email: z.string().trim().max(L.email).pipe(z.email()),
  message: z.string().trim().min(L.messageMin).max(L.message),
  /** Honeypot: humans never see it, so any value means a bot. */
  company: z.string().optional(),
  /** Date.now() set by the client after mount; empty for no-JS posts. */
  t: z.coerce.number().int().nonnegative().optional(),
});

const FIELD_COPY: Record<ContactField, string> = {
  name: copy.errors.name,
  email: copy.errors.email,
  message: copy.errors.message,
};

const FIELDS: readonly ContactField[] = ["name", "email", "message"];

/** True only where a real email may be sent. Everything else is mock. */
export function isLiveSend(env: ContactEnv): boolean {
  return env.VERCEL_ENV === "production" && env.CONTACT_MODE !== "mock";
}

export function formspreeUrl(env: ContactEnv): string {
  // `||` so an empty leftover variable can't produce /f/.
  const id = env.FORMSPREE_FORM_ID || FORMSPREE_DEFAULT_ID;
  return `https://formspree.io/f/${encodeURIComponent(id)}`;
}

/**
 * UTF-8 bytes of the posted fields. React's own `$ACTION_*` bookkeeping keys
 * (no-JS posts carry the previous state there) are not the visitor's input.
 */
export function formDataBytes(fd: FormData): number {
  const enc = new TextEncoder();
  let n = 0;
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("$ACTION_")) continue;
    n += enc.encode(key).length + (typeof value === "string" ? enc.encode(value).length : value.size);
  }
  return n;
}

const text = (v: FormDataEntryValue | null): string | undefined =>
  typeof v === "string" ? v : undefined;

function echo(fd: FormData): ContactValues {
  const values: ContactValues = {};
  for (const f of FIELDS) {
    const v = text(fd.get(f));
    if (v) values[f] = v.slice(0, L[f]);
  }
  return values;
}

export async function handleContact(formData: unknown, deps: ContactDeps): Promise<ContactState> {
  const { env, now } = deps;
  const log = deps.log ?? console;
  const at = now();
  const serverError: ContactState = { status: "error", message: copy.errors.server, at };
  const success: ContactState = { status: "success", message: copy.success, at };

  if (!(formData instanceof FormData)) return serverError;

  // 1. Size.
  if (formDataBytes(formData) > L.bodyBytes) return serverError;

  // 2. Validate.
  const parsed = contactSchema.safeParse({
    name: text(formData.get("name")),
    email: text(formData.get("email")),
    message: text(formData.get("message")),
    company: text(formData.get("company")),
    t: text(formData.get("t")),
  });

  if (!parsed.success) {
    const fieldErrors: NonNullable<ContactState["fieldErrors"]> = {};
    let botOnly = true;
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "name" || key === "email" || key === "message") {
        fieldErrors[key] ??= FIELD_COPY[key];
        botOnly = false;
      }
    }
    // Only the hidden fields failed (a tampered `t`): nothing a person can fix.
    if (botOnly) {
      log.log("contact: dropped");
      return success;
    }
    return { status: "error", fieldErrors, values: echo(formData), at };
  }

  const { name, email, message, company, t } = parsed.data;

  // 3. Bots: honeypot filled, or submitted within 3 s of the form mounting.
  // A negative elapsed time means the visitor's clock runs ahead of ours, not a bot.
  const elapsed = t && t > 0 ? at - t : null;
  if ((company ?? "").trim() !== "" || (elapsed !== null && elapsed >= 0 && elapsed < L.minFillMs)) {
    log.log("contact: dropped");
    return success;
  }

  // 4. Fail-closed: only Vercel production sends.
  if (!isLiveSend(env)) {
    log.log("contact: mock");
    return success;
  }

  const safeName = name.replace(/[\r\n]+/g, " ");
  try {
    const res = await deps.fetch(formspreeUrl(env), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: safeName,
        email,
        message,
        _replyto: email,
        _subject: `Portfolio: ${safeName}`,
      }),
      signal: AbortSignal.timeout(FORMSPREE_TIMEOUT_MS),
    });
    // 5. Non-2xx.
    if (!res.ok) {
      log.error("contact: formspree status", res.status);
      return serverError;
    }
    return success;
  } catch {
    log.error("contact: formspree unreachable");
    return serverError;
  }
}
