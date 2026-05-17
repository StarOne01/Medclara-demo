"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitInterestAction, type InterestFormState } from "@/app/actions";

export function InterestForm() {
  const [state, formAction] = useActionState<InterestFormState, FormData>(
    submitInterestAction,
    { status: "idle" }
  );

  return (
    <div className="rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] p-8 shadow-xl">
      <form
        key={state.status === "success" ? "success" : "idle"}
        action={formAction}
        className="space-y-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Dr. ABC"
              className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-3 text-sm text-[color:var(--text-primary)] shadow-sm transition focus:border-[color:var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/20"
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-3 text-sm text-[color:var(--text-primary)] shadow-sm transition focus:border-[color:var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/20"
            />
          </Field>
        </div>
        <Field label="Role" htmlFor="role">
          <select
            id="role"
            name="role"
            required
            className="w-full appearance-none rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-3 text-sm text-[color:var(--text-primary)] shadow-sm transition focus:border-[color:var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/20"
            defaultValue=""
          >
            <option value="" disabled>
              Select your role
            </option>
            <option value="Physician">Physician</option>
            <option value="Clinic Administrator">Clinic Administrator</option>
            <option value="Health System Leader">Health System Leader</option>
            <option value="IT / Innovation">IT / Innovation</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field
          label="Message"
          htmlFor="message"
          description="Tell us about your documentation workflow or language needs."
        >
          <textarea
            id="message"
            name="message"
            rows={4}
            placeholder="We operate across South Indian clinics and need faster turnaround..."
            className="w-full resize-none rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-4 py-3 text-sm text-[color:var(--text-primary)] shadow-sm transition focus:border-[color:var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/20"
          />
        </Field>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SubmitButton />
          {state.status !== "idle" && (
            <p
              className={`text-sm ${
                state.status === "success" ? "text-[color:var(--color-success)]" : "text-[color:var(--color-error)]"
              }`}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>
      <p className="mt-8 text-xs text-[color:var(--text-secondary)]">
        By submitting this form you agree to receive updates from Medclara. You can
        unsubscribe anytime.
      </p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--button-primary-bg)] px-6 py-3 text-sm font-medium uppercase tracking-wide text-[color:var(--button-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Submitting…" : "Show Interest"}
    </button>
  );
}

function Field({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-[color:var(--text-secondary)]" htmlFor={htmlFor}>
      <span className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-tertiary)]">{label}</span>
      {children}
      {description && <span className="text-sm text-[color:var(--text-secondary)]">{description}</span>}
    </label>
  );
}
