"use client";
import { useActionState } from "react";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

/** Formulari amb missatge d'error/èxit accessible (aria-live). */
export function ActionForm({ action, children, className = "space-y-4" }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <div aria-live="polite">
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{state.error}</p>}
        {state?.ok && state.message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{state.message}</p>}
      </div>
      {children}
    </form>
  );
}
