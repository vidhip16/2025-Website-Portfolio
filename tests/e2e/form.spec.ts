import { expect, test, type Locator, type Page } from "@playwright/test";
import { contact } from "../../content/site";
import { SEL, gotoAndSettle, settleApp, skipUnlessLocal } from "./helpers";

// Blueprint §7 + §12 gate 5 (form happy and error paths). RULES Hard rule 6: every test here
// submits the form, so every title carries @form and every test calls skipUnlessLocal(baseURL).
// The local webServer runs with CONTACT_MODE=mock and no VERCEL_ENV, so the action never sends.

const copy = contact.form;
const MIN_FILL_MS = 3000;

const VALID = {
  name: "QA Visitor",
  email: "qa@example.com",
  message: "Hello from the Playwright form spec. Mock mode only, nothing is sent.",
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function fields(page: Page) {
  const form = page.locator(SEL.form);
  return {
    form,
    name: form.getByLabel(copy.name, { exact: true }),
    email: form.getByLabel(copy.email, { exact: true }),
    message: form.getByLabel(copy.message, { exact: true }),
    submit: form.getByRole("button", { name: copy.submit }),
    status: page.locator(SEL.status),
  };
}

async function openForm(page: Page) {
  await gotoAndSettle(page, "/");
  await settleApp(page);
  const f = fields(page);
  await f.form.scrollIntoViewIfNeeded();
  // The timing field is rendered empty (static page) and filled after hydration.
  await page.waitForFunction(
    (sel) => !!(document.querySelector(`${sel} input[name="t"]`) as HTMLInputElement | null)?.value,
    SEL.form,
  );
  return f;
}

/** Wait until the form has been open longer than the 3 s bot threshold (page clock = server clock locally). */
async function waitPastTimingCheck(page: Page) {
  await page.waitForFunction(
    ({ sel, ms }) => {
      const t = Number((document.querySelector(`${sel} input[name="t"]`) as HTMLInputElement | null)?.value);
      return t > 0 && Date.now() - t >= ms;
    },
    { sel: SEL.form, ms: MIN_FILL_MS + 300 },
    { timeout: MIN_FILL_MS + 5000 },
  );
}

async function fill(f: ReturnType<typeof fields>, values: Partial<typeof VALID>) {
  const v = { ...VALID, ...values };
  await f.name.fill(v.name);
  await f.email.fill(v.email);
  await f.message.fill(v.message);
}

/** Field errors are server-side (zod); turn off native validation so the server is what answers. */
async function disableNativeValidation(form: Locator) {
  await form.evaluate((el: HTMLFormElement) => {
    el.noValidate = true;
  });
}

async function expectSuccess(f: ReturnType<typeof fields>) {
  await expect(f.status).toContainText(copy.success, { timeout: 10_000 });
  for (const field of [f.name, f.email, f.message]) await expect(field).not.toHaveAttribute("aria-invalid", "true");
  await expect(f.submit).toHaveText(copy.submit);
}

test.describe("contact form", () => {
  test("happy path shows the success message @form", async ({ page, baseURL }) => {
    skipUnlessLocal(baseURL);
    const f = await openForm(page);
    await fill(f, {});
    await waitPastTimingCheck(page);
    await f.submit.click();
    await expectSuccess(f);
  });

  const cases = [
    { field: "name", value: { name: "" }, error: copy.errors.name },
    { field: "email", value: { email: "not-an-email" }, error: copy.errors.email },
    { field: "message", value: { message: "too short" }, error: copy.errors.message },
  ] as const;

  for (const c of cases) {
    test(`${c.field} error is shown next to the field @form`, async ({ page, baseURL }) => {
      skipUnlessLocal(baseURL);
      const f = await openForm(page);
      await fill(f, c.value);
      await disableNativeValidation(f.form);
      await waitPastTimingCheck(page);
      await f.submit.click();

      const input = f[c.field];
      await expect(input).toHaveAttribute("aria-invalid", "true", { timeout: 10_000 });
      // "Next to the field": the error is the field's accessible description, and it is on screen.
      await expect(input).toHaveAccessibleDescription(new RegExp(escapeRe(c.error)));
      await expect(f.form.getByText(c.error, { exact: true }).filter({ visible: true }).first()).toBeVisible();

      for (const other of cases.filter((o) => o.field !== c.field)) {
        await expect(f[other.field]).not.toHaveAttribute("aria-invalid", "true");
      }
      await expect(f.status).not.toContainText(copy.success);
      // No raw error text ever reaches the visitor.
      await expect(f.form).not.toContainText(/zod|invalid_|Error:|undefined/i);
    });
  }

  test("a filled honeypot gets a silent success @form", async ({ page, baseURL }) => {
    skipUnlessLocal(baseURL);
    const f = await openForm(page);
    await fill(f, {});
    // Bots fill it through the DOM; people never see it (it is not focusable).
    await f.form.locator('input[name="company"]').evaluate((el: HTMLInputElement) => {
      el.value = "Acme Bots Inc.";
    });
    // Past the timing check, so the honeypot is the only bot signal in play.
    await waitPastTimingCheck(page);
    await f.submit.click();
    await expectSuccess(f);
  });

  test("a submit faster than 3 s gets a silent success @form", async ({ page, baseURL }) => {
    skipUnlessLocal(baseURL);
    const f = await openForm(page);
    await fill(f, {});
    // Re-arm the timer right now so the post lands well inside the 3 s window.
    await f.form.locator('input[name="t"]').evaluate((el: HTMLInputElement) => {
      el.value = String(Date.now());
    });
    await f.submit.click();
    await expectSuccess(f);
  });
});
