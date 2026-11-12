"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginParentAction, type AuthFormState } from "@/app/parent/auth-actions";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginParentAction,
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
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3 text-card-foreground"
        />
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
        {isPending ? "Connexion…" : "Se connecter"}
      </button>

      <p className="text-center text-sm text-foreground-soft">
        Pas encore de compte ?{" "}
        <Link href="/parent/inscription" className="font-bold text-star underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
