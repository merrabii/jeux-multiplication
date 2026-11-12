"use client";

import { useActionState } from "react";
import {
  deleteChildAction,
  type ChildFormState,
} from "@/app/parent/children-actions";

const initialState: ChildFormState = {};

/** Bouton de suppression avec confirmation parentale explicite. */
export function DeleteChildButton({ childProfileId }: { childProfileId: string }) {
  const [state, formAction, isPending] = useActionState(
    deleteChildAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Supprimer ce profil ? Sa progression sera masquée. Confirmez seulement si vous êtes sûr.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="childProfileId" value={childProfileId} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl border-2 border-error/40 px-3 py-2 text-sm font-bold text-error hover:bg-error/10 disabled:opacity-60"
      >
        {isPending ? "Suppression…" : "Supprimer"}
      </button>
      {state.error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
