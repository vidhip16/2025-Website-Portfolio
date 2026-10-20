import { expect, test } from "@playwright/test";
import { contact, person } from "../../content/site";
import { PROJECTS, SECTION_IDS, SEL, skipUnlessLocal } from "./helpers";

// Blueprint §12 gate 5 no-JS run: content complete and the form posts. Runs on chromium and webkit.
// With JavaScript off only locators and matchers are used (no page.evaluate in the page's world).

test.use({ javaScriptEnabled: false });

test.describe("without JavaScript", () => {
  test("every section and all six projects are in the server HTML", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);

    for (const id of SECTION_IDS) await expect(page.locator(`#${id}`), `#${id}`).toHaveCount(1);
    await expect(page.locator("#projects")).toHaveCount(1);
    await expect(page.locator("#resume")).toHaveCount(1);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText(person.firstName);
    await expect(h1).toContainText(person.lastName);
    await expect(h1).toHaveCSS("opacity", "1");

    // Section headings render and are not parked at opacity 0 waiting for a script.
    for (const id of SECTION_IDS.filter((s) => s !== "home")) {
      const heading = page.locator(`#${id} h2`).first();
      await expect(heading, `#${id} h2`).toBeVisible();
      await expect(heading).toHaveCSS("opacity", "1");
    }

    for (const p of PROJECTS) await expect(page.locator("#work"), p.title).toContainText(p.title);

    // §5.6: no canvas without JavaScript; the text is complete without it.
    await expect(page.locator(SEL.dots)).toHaveCount(0);
    await expect(page.locator(SEL.form)).toBeVisible();
  });

  test("every detail page renders without JavaScript", async ({ page }) => {
    for (const p of PROJECTS) {
      const res = await page.goto(`/work/${p.slug}`);
      expect(res?.status(), p.slug).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(p.title);
      await expect(page.locator(SEL.back)).toBeVisible();
      await expect(page.locator(SEL.repo)).toHaveAttribute("href", p.repo);
    }
  });

  test("the form posts without JavaScript and shows success @form", async ({ page, baseURL }) => {
    skipUnlessLocal(baseURL);
    await page.goto("/#contact");
    const form = page.locator(SEL.form);
    await form.getByLabel(contact.form.name, { exact: true }).fill("QA Visitor");
    await form.getByLabel(contact.form.email, { exact: true }).fill("qa@example.com");
    await form
      .getByLabel(contact.form.message, { exact: true })
      .fill("Hello from the no-JS form spec. Mock mode only, nothing is sent.");
    await form.getByRole("button", { name: contact.form.submit }).click();
    // A full-page POST round trip: the response renders the action state.
    await expect(page.locator(SEL.status)).toContainText(contact.form.success, { timeout: 15_000 });
  });

  test("a no-JS post with a bad email shows the field error @form", async ({ page, baseURL }) => {
    skipUnlessLocal(baseURL);
    await page.goto("/#contact");
    const form = page.locator(SEL.form);
    await form.getByLabel(contact.form.name, { exact: true }).fill("QA Visitor");
    // Passes the browser's type=email check (so it posts even if native validation is on) but
    // fails the server's z.email(): the error has to come back in the response.
    await form.getByLabel(contact.form.email, { exact: true }).fill("qa@localhost");
    await form
      .getByLabel(contact.form.message, { exact: true })
      .fill("Hello from the no-JS form spec. Mock mode only, nothing is sent.");
    await form.getByRole("button", { name: contact.form.submit }).click();

    const after = page.locator(SEL.form);
    await expect(after.getByLabel(contact.form.email, { exact: true })).toHaveAttribute("aria-invalid", "true", {
      timeout: 15_000,
    });
    await expect(after.getByText(contact.form.errors.email, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator(SEL.status)).not.toContainText(contact.form.success);
  });
});
