"use client";

import Link from "next/link";
import { useActionState } from "react";
import { recoverAdminAction, type RecoveryFormState } from "@/app/recuperation-admin/actions";

const initialState: RecoveryFormState = {};

/** Formulaire de récupération administrateur (client). */
export function RecoveryForm() {
  const [state, action, pending] = useActionState(
    recoverAdminAction,
    initialState,
  );

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-5">
      {state.error && (
        <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-xl bg-success/15 px-4 py-3 text-sm font-semibold text-success">
          ✅ Mot de passe réinitialisé. Toutes les sessions actives ont été
          révoquées.{" "}
          <Link href="/parent/connexion" className="underline">
            Se connecter
          </Link>
        </p>
      )}
      <div>
        <label htmlFor="token" className="block text-sm font-bold">
          Jeton de récupération
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="off"
          required
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-bold">
          Adresse e-mail administrateur
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-bold">
          Nouveau mot de passe (8 caractères minimum)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3"
        />
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="block text-sm font-bold">
          Confirmation du mot de passe
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
      >
        {pending ? "Vérification…" : "Réinitialiser le mot de passe"}
      </button>
    </form>
  );
}
