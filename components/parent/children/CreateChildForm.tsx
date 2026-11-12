"use client";

import { useActionState, useState } from "react";
import {
  createChildAction,
  type ChildFormState,
} from "@/app/parent/children-actions";

const initialState: ChildFormState = {};

type AvatarOption = { id: string; name: string; imageKey: string };

/**
 * Formulaire de création d'un profil enfant avec sélecteur d'avatars
 * illustrés (images SVG locales du royaume).
 */
export function CreateChildForm({
  avatars,
}: {
  avatars: AvatarOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createChildAction,
    initialState,
  );
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]?.id ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div>
        <label
          htmlFor="child-pseudonym"
          className="block text-sm font-bold text-foreground-soft"
        >
          Pseudonyme de l&apos;enfant
        </label>
        <input
          id="child-pseudonym"
          name="pseudonym"
          required
          minLength={2}
          maxLength={20}
          placeholder="Ex. : Perle, Tom, Faëlys…"
          className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3 text-card-foreground"
        />
        <p className="mt-1 text-xs text-foreground-soft/80">
          2 à 20 caractères. Aucun nom complet ni donnée personnelle.
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-foreground-soft">
          Choisir un avatar
        </legend>
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {avatars.map((avatar) => (
            <label
              key={avatar.id}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 p-2 transition hover:bg-background-soft"
              style={
                selectedAvatar === avatar.id
                  ? { borderColor: "var(--magic)", background: "var(--background-soft)" }
                  : { borderColor: "transparent" }
              }
            >
              <input
                type="radio"
                name="avatarId"
                value={avatar.id}
                checked={selectedAvatar === avatar.id}
                onChange={() => setSelectedAvatar(avatar.id)}
                className="sr-only"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar.imageKey}
                alt={avatar.name}
                width={64}
                height={64}
                className="size-14 rounded-full shadow"
              />
              <span className="text-center text-[10px] font-semibold leading-tight text-foreground-soft">
                {avatar.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-xl bg-success/15 px-4 py-3 text-sm font-semibold text-success"
        >
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
      >
        {isPending ? "Création…" : "Créer le profil enfant"}
      </button>
    </form>
  );
}
