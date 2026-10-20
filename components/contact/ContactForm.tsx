"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { Check, CircleAlert } from "lucide-react";
import { sendContact } from "@/app/actions/contact";
import {
  CONTACT_LIMITS as L,
  INITIAL_CONTACT_STATE,
  type ContactField,
  type ContactState,
} from "@/app/actions/contact-shared";
import { useMotionPrefs } from "@/lib/motion";

/**
 * Labels from content/site.ts `contact.form`, passed down by the server Contact.
 * Success and error copy is chosen on the server and arrives in the action state.
 */
export type ContactFormCopy = {
  name: string;
  email: string;
  message: string;
  submit: string;
  pending: string;
  /** Character counter template; {count} and {max} are replaced. */
  counter: string;
};

/** Where a no-JS post lands: the browser scrolls back to the form and its result. */
const PERMALINK = "/#contact";

const ID = {
  name: "contact-name",
  email: "contact-email",
  message: "contact-message",
  company: "contact-company",
  count: "contact-message-count",
} as const;

const errorId = (f: ContactField) => `${ID[f]}-error`;

const fmt = (n: number) => n.toLocaleString("en-CA");
/** "1,234 of 4,000 characters" from the `contact.form.counter` template. */
const countText = (template: string, n: number) =>
  template.replace("{count}", fmt(n)).replace("{max}", fmt(L.message));

/** Update React's own text node in place, so later React text updates still land. */
function setText(el: HTMLElement | null, text: string) {
  if (!el) return;
  if (el.firstChild) el.firstChild.nodeValue = text;
  else el.textContent = text;
}

const inputClass =
  "block w-full rounded-[14px] border-2 border-ink bg-white/55 px-4 py-3 text-base leading-6 text-ink " +
  "transition-colors duration-200 ease-quint aria-[invalid=true]:bg-bubblegum/15 " +
  "forced-colors:border-[ButtonText]";

/**
 * The hardened contact form (blueprint §7). A native <form action> bound to a
 * Server Action through useActionState, so it posts and renders its result
 * without JavaScript. With JS, onSubmit dispatches the same action in a
 * transition (no automatic form reset, so typed values survive an error).
 */
export function ContactForm({ copy }: { copy: ContactFormCopy }) {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(
    sendContact,
    INITIAL_CONTACT_STATE,
    PERMALINK,
  );
  const { ok } = useMotionPrefs();

  const formRef = useRef<HTMLFormElement>(null);
  const tRef = useRef<HTMLInputElement>(null);
  const liveCount = useRef<HTMLSpanElement>(null);
  const srCount = useRef<HTMLSpanElement>(null);
  const handled = useRef<ContactState>(INITIAL_CONTACT_STATE);

  // Arm the timing check once. Re-running (Activity show) must not restart it,
  // or a visitor who comes back and sends at once would be dropped as a bot.
  useEffect(() => {
    const t = tRef.current;
    if (t && !t.value) t.value = String(Date.now());
  }, []);

  // React to each new action result exactly once (effects re-run when an
  // Activity boundary is shown again; the ref keeps that from repeating).
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    const form = formRef.current;
    if (!form) return;
    if (state.status === "success") {
      form.reset();
      setText(liveCount.current, countText(copy.counter, 0));
      setText(srCount.current, countText(copy.counter, 0));
      if (tRef.current) tRef.current.value = String(Date.now());
      window.dispatchEvent(new CustomEvent("contact:success"));
    } else if (state.fieldErrors) {
      const first = (["name", "email", "message"] as const).find((f) => state.fieldErrors?.[f]);
      if (first) document.getElementById(ID[first])?.focus();
    }
  }, [state, copy.counter]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  const fe = state.fieldErrors ?? {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const initialCount = countText(copy.counter, values.message?.length ?? 0);
  const describedBy = (f: ContactField, extra?: string) =>
    [fe[f] ? errorId(f) : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      data-contact-form=""
      aria-busy={pending || undefined}
      className="relative grid gap-6"
    >
      <div>
        <label htmlFor={ID.name} className="mb-2 block text-base font-semibold">
          {copy.name}
        </label>
        <input
          id={ID.name}
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={L.name}
          defaultValue={values.name}
          aria-invalid={fe.name ? true : undefined}
          aria-describedby={describedBy("name")}
          className={inputClass}
        />
        <FieldError id={errorId("name")} text={fe.name} />
      </div>

      <div>
        <label htmlFor={ID.email} className="mb-2 block text-base font-semibold">
          {copy.email}
        </label>
        <input
          id={ID.email}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={L.email}
          defaultValue={values.email}
          aria-invalid={fe.email ? true : undefined}
          aria-describedby={describedBy("email")}
          className={inputClass}
        />
        <FieldError id={errorId("email")} text={fe.email} />
      </div>

      <div>
        <label htmlFor={ID.message} className="mb-2 block text-base font-semibold">
          {copy.message}
        </label>
        <textarea
          id={ID.message}
          name="message"
          rows={6}
          required
          minLength={L.messageMin}
          maxLength={L.message}
          defaultValue={values.message}
          aria-invalid={fe.message ? true : undefined}
          aria-describedby={describedBy("message", ID.count)}
          onInput={(e) => {
            setText(liveCount.current, countText(copy.counter, e.currentTarget.value.length));
          }}
          onBlur={(e) => {
            setText(srCount.current, countText(copy.counter, e.currentTarget.value.length));
          }}
          className={`${inputClass} min-h-40 resize-y`}
        />
        <div className="mt-2 flex items-start justify-between gap-4">
          <FieldError id={errorId("message")} text={fe.message} inline />
          {/* Visible count updates as you type; the described-by copy only on blur. */}
          <span ref={liveCount} aria-hidden="true" className="ms-auto shrink-0 text-sm tabular-nums text-ink/75">
            {initialCount}
          </span>
          <span ref={srCount} id={ID.count} aria-live="off" className="sr-only-soft">
            {initialCount}
          </span>
        </div>
      </div>

      {/* Honeypot. Invisible (so autofill never fills it), out of the a11y tree,
          never focusable. Bot-only, so its label is not site copy. */}
      <div aria-hidden="true" className="invisible absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor={ID.company}>Company</label>
        <input
          id={ID.company}
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore=""
        />
      </div>
      {/* Rendered empty (the page is static) and set to Date.now() after mount.
          No defaultValue: a hidden input's value IS its value attribute, so React
          would reset it to "" on the next re-render (e.g. the motion-prefs sync). */}
      <input ref={tRef} type="hidden" name="t" />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <button
          type="submit"
          className="btn btn-primary disabled:cursor-progress disabled:opacity-70"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? copy.pending : copy.submit}
        </button>

        {/* The one live region for every status message. */}
        <div role="status" aria-live="polite" aria-atomic="true" className="min-h-[1lh] flex-1 basis-56">
          <StatusMessage key={state.at ?? 0} state={state} showCheck={!ok} />
        </div>
      </div>
    </form>
  );
}

function FieldError({ id, text, inline = false }: { id: string; text?: string; inline?: boolean }) {
  if (!text) return null;
  return (
    <p id={id} className={`${inline ? "" : "mt-2 "}flex items-start gap-2 text-base font-semibold`}>
      <CircleAlert aria-hidden size={18} strokeWidth={1.75} strokeLinecap="round" className="mt-[0.2em] shrink-0" />
      <span>{text}</span>
    </p>
  );
}

function StatusMessage({ state, showCheck }: { state: ContactState; showCheck: boolean }) {
  if (state.status === "success") {
    return (
      <p className="flex items-start gap-2 font-semibold">
        {showCheck && (
          <Check aria-hidden size={20} strokeWidth={1.75} strokeLinecap="round" className="mt-[0.2em] shrink-0" />
        )}
        <span>{state.message}</span>
      </p>
    );
  }
  if (state.status !== "error") return null;
  const fieldText = Object.values(state.fieldErrors ?? {}).join(" ");
  return (
    <>
      {state.message && <p className="font-semibold">{state.message}</p>}
      {/* Field errors are already shown next to each field; announce them here. */}
      {fieldText && <p className="sr-only-soft">{fieldText}</p>}
    </>
  );
}
