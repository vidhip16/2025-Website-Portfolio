// Shared, dependency-free contract between the contact Server Action
// (app/actions/contact.ts → contact-core.ts) and the client form.
// Keep this file free of imports so the client bundle stays tiny.

export const CONTACT_LIMITS = {
  name: 80,
  email: 254,
  messageMin: 10,
  message: 4000,
  /** Posted field bytes (UTF-8) above this are rejected before validation. */
  bodyBytes: 8 * 1024,
  /** A submit less than this long after the form mounted is treated as a bot. */
  minFillMs: 3000,
} as const;

export type ContactField = "name" | "email" | "message";

export type ContactValues = Partial<Record<ContactField, string>>;

export type ContactState = {
  status: "idle" | "success" | "error";
  /** One message per invalid field, shown next to the field. */
  fieldErrors?: Partial<Record<ContactField, string>>;
  /** Success or form-level error copy. Never a raw error message. */
  message?: string;
  /** Echo of what was typed, so a no-JS post that fails validation keeps its input. */
  values?: ContactValues;
  /** Server time of the response; keys the status region so repeats re-announce. */
  at?: number;
};

export const INITIAL_CONTACT_STATE: ContactState = { status: "idle" };
