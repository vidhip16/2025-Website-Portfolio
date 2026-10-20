"use server";

// Contact Server Action (blueprint §7). All logic lives in ./contact-core so it
// can be unit-tested without Next; this wrapper only supplies the real env,
// fetch, clock and logger. Fail-closed: it sends only on Vercel production.
import { handleContact } from "./contact-core";
import type { ContactState } from "./contact-shared";

export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  return handleContact(formData, {
    env: {
      VERCEL_ENV: process.env.VERCEL_ENV,
      CONTACT_MODE: process.env.CONTACT_MODE,
      FORMSPREE_FORM_ID: process.env.FORMSPREE_FORM_ID,
    },
    // Wrapped so `this` is never the deps object (some fetch impls check it).
    fetch: (input, init) => fetch(input, init),
    now: Date.now,
    log: console,
  });
}
