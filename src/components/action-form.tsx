"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { initialState, type ActionState } from "@/lib/action-state";
import { GeoFields } from "./geo-fields";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel?: string;
  submitClass?: string;
  /** Capture GPS + device forensics with the submission. */
  geo?: boolean;
  confirm?: string;
  className?: string;
  resetOnSuccess?: boolean;
  /** Extra submit buttons (name/value pairs), e.g. Approve / Return. */
  buttons?: { label: string; name: string; value: string; className?: string }[];
};

export function ActionForm({ action, children, submitLabel = "Submit", submitClass = "btn btn-primary", geo = false, confirm, className = "", resetOnSuccess = false, buttons }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={`space-y-3 ${className}`}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {geo && <GeoFields />}
      {children}
      {state.error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}
      {state.ok && state.message && <p className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">{state.message}</p>}
      <div className="flex flex-wrap gap-2">
        {buttons ? (
          buttons.map((b) => (
            <button key={b.value} type="submit" name={b.name} value={b.value} disabled={pending} className={b.className ?? "btn btn-primary"}>
              {pending ? "Working…" : b.label}
            </button>
          ))
        ) : (
          <button type="submit" disabled={pending} className={submitClass}>
            {pending ? "Working…" : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
