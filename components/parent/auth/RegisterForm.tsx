"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerParentAction, type AuthFormState } from "@/app/parent/auth-actions";

const initialState: AuthFormState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(
    registerParentAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-5">
      <div>
        <label htmlFor="email" className="block text-sm font-bold text-foreground-soft">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3 text-card-foreground"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-bold text-foreground-soft">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3 text-card-foreground"
        />
        <p className="mt-1 text-xs text-foreground-soft/80">
          8 caractères minimum.
        </p>
      </div>

      <div>
        <label
          htmlFor="passwordConfirm"
          className="block text-sm font-bold text-foreground-soft"
        >
          Confirmation du mot de passe
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3 text-card-foreground"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="acceptTerms"
          name="acceptTerms"
          type="checkbox"
          required
          className="mt-1 size-5"
        />
        <label htmlFor="acceptTerms" className="text-sm text-foreground-soft">
          J&apos;accepte les conditions d&apos;utilisation du Royaume Magique
          des Multiplications.
        </label>
      </div>

      {state.error && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
      >
        {isPending ? "Création…" : "Créer mon compte"}
      </button>

      <p className="text-center text-sm text-foreground-soft">
        Déjà inscrit ?{" "}
        <Link href="/parent/connexion" className="font-bold text-star underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
