"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAdminAction,
  initializeAction,
  saveAppConfigAction,
  testExternalDbAction,
  verifyInstallTokenAction,
  type InstallerFormState,
} from "@/app/installation/actions";
import type { EnvironmentReport } from "@/features/installer/environment";

/**
 * Assistant d'installation — 6 étapes, responsive, en français,
 * cohérent avec l'univers du Royaume Magique.
 * Toutes les opérations sont exécutées par des Server Actions : la
 * progression affichée est réelle, jamais simulée.
 */

const initialState: InstallerFormState = {};

export type WizardProps = {
  /** Jeton d'installation exigé ? (étape 0 de déblocage) */
  tokenRequired: boolean;
  /** Jeton déjà validé ? */
  unlocked: boolean;
  environment: EnvironmentReport;
  config: {
    appName: string;
    appUrl: string;
    defaultLanguage: string;
    timezone: string;
    organization: string;
  };
  /** DATABASE_URL de l'environnement est-elle définie ? (sans valeur) */
  databaseUrlPresent: boolean;
};

const STEPS = [
  { n: 1, label: "Environnement" },
  { n: 2, label: "Application" },
  { n: 3, label: "Base de données" },
  { n: 4, label: "Initialisation" },
  { n: 5, label: "Administrateur" },
  { n: 6, label: "Terminé" },
] as const;

const STATUS_ICON: Record<string, string> = { ok: "✅", warn: "⚠️", error: "❌" };

export function InstallerWizard(props: WizardProps) {
  const startStep = props.tokenRequired && !props.unlocked ? 0 : 1;
  const [step, setStep] = useState(startStep);

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Barre de progression des étapes */}
      <ol
        aria-label="Étapes de l'installation"
        className="mb-8 grid grid-cols-6 gap-1 text-center text-xs sm:text-sm"
      >
        {STEPS.map((s) => {
          const active = s.n === step;
          const done = s.n < step;
          return (
            <li
              key={s.n}
              aria-current={active ? "step" : undefined}
              className={`rounded-xl px-1 py-2 font-bold ${
                active
                  ? "bg-star text-background"
                  : done
                    ? "bg-success/20 text-foreground"
                    : "bg-background-soft text-foreground-soft"
              }`}
            >
              <span aria-hidden className="block text-base">
                {done ? "✔" : active ? "✨" : "•"}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>

      <div className="rounded-3xl bg-card p-6 text-card-foreground shadow-2xl sm:p-8">
        {step === 0 && <TokenStep onUnlocked={() => setStep(1)} />}
        {step === 1 && (
          <EnvironmentStep
            report={props.environment}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <ConfigStep
            defaults={props.config}
            onContinue={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <DatabaseStep
            databaseUrlPresent={props.databaseUrlPresent}
            onContinue={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <InitializeStep
            onContinue={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && <AdminStep onDone={() => setStep(6)} />}
        {step === 6 && <SuccessStep />}
      </div>
    </div>
  );
}

/* ---------------- Étape 0 : jeton d'installation ---------------- */

function TokenStep({ onUnlocked }: { onUnlocked: () => void }) {
  const [state, action, pending] = useActionState(
    verifyInstallTokenAction,
    initialState,
  );
  useEffect(() => {
    if (state.ok) onUnlocked();
  }, [state.ok, onUnlocked]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold">Jeton d&apos;installation</h1>
      <p className="text-foreground-soft">
        Cette application est protégée par un jeton d&apos;installation. Il est
        défini par l&apos;administrateur du serveur (variable
        <code className="mx-1 rounded bg-background-soft px-1">INSTALL_TOKEN</code>
        ou fichier <code className="rounded bg-background-soft px-1">.install_token</code>{" "}
        généré au démarrage du conteneur et visible dans ses journaux).
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="token" className="block text-sm font-bold">
          Jeton
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
      <button
        type="submit"
        disabled={pending}
        className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
      >
        {pending ? "Vérification…" : "Déverrouiller l'assistant"}
      </button>
    </form>
  );
}

/* ---------------- Étape 1 : environnement ---------------- */

function EnvironmentStep({
  report,
  onContinue,
}: {
  report: EnvironmentReport;
  onContinue: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold">
        Vérification de l&apos;environnement
      </h1>
      <p className="text-foreground-soft">
        Application v{report.appVersion} · Node.js v{report.nodeVersion}
      </p>
      <ul className="flex flex-col gap-3">
        {report.checks.map((check) => (
          <li key={check.id} className="rounded-2xl bg-background-soft/10 p-4">
            <p className="font-bold">
              <span aria-hidden>{STATUS_ICON[check.status]}</span> {check.label}
            </p>
            <p className="mt-1 text-sm text-foreground-soft">{check.detail}</p>
            {check.solution && (
              <p className="mt-1 text-sm text-star">💡 {check.solution}</p>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-xl border-2 border-magic px-4 py-3 font-bold hover:bg-background-soft"
        >
          ↻ Revérifier
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!report.compatible}
          className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
        >
          Continuer
        </button>
      </div>
      {!report.compatible && (
        <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
          Au moins une vérification est en erreur. Corrigez-la puis cliquez
          sur « Revérifier ».
        </p>
      )}
    </div>
  );
}

/* ---------------- Étape 2 : application ---------------- */

function ConfigStep({
  defaults,
  onContinue,
  onBack,
}: {
  defaults: WizardProps["config"];
  onContinue: () => void;
  onBack: () => void;
}) {
  const [state, action, pending] = useActionState(
    saveAppConfigAction,
    initialState,
  );
  useEffect(() => {
    if (state.ok) onContinue();
  }, [state.ok, onContinue]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold">Configuration</h1>
      {state.error && (
        <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
          {state.error}
        </p>
      )}
      <Field
        id="appName"
        label="Nom de l'application"
        defaultValue={defaults.appName || "Royaume Magique des Multiplications"}
        required
        error={state.fieldErrors?.appName}
      />
      <Field
        id="appUrl"
        label="URL principale (facultatif)"
        defaultValue={defaults.appUrl}
        placeholder="https://mon-royaume.example.com"
        error={state.fieldErrors?.appUrl}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="defaultLanguage" className="block text-sm font-bold">
            Langue par défaut
          </label>
          <select
            id="defaultLanguage"
            name="defaultLanguage"
            defaultValue={defaults.defaultLanguage || "fr"}
            className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
        <Field
          id="timezone"
          label="Fuseau horaire"
          defaultValue={defaults.timezone || "Europe/Paris"}
          error={state.fieldErrors?.timezone}
        />
      </div>
      <Field
        id="organization"
        label="Établissement / organisation (facultatif)"
        defaultValue={defaults.organization}
        error={state.fieldErrors?.organization}
      />
      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border-2 border-magic px-4 py-3 font-bold hover:bg-background-soft"
        >
          ← Retour
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer et continuer"}
        </button>
      </div>
    </form>
  );
}

/* ---------------- Étape 3 : base de données ---------------- */

function DatabaseStep({
  databaseUrlPresent,
  onContinue,
  onBack,
}: {
  databaseUrlPresent: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"auto" | "external">(
    databaseUrlPresent ? "auto" : "external",
  );
  const [state, action, pending] = useActionState(
    testExternalDbAction,
    initialState,
  );

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold">Base de données</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          title="PostgreSQL automatique"
          subtitle="Recommandé (Docker, Coolify, Dokploy, VPS)"
          selected={mode === "auto"}
          onClick={() => setMode("auto")}
          icon="🐘"
        />
        <ModeCard
          title="PostgreSQL externe"
          subtitle="Vous avez déjà une base"
          selected={mode === "external"}
          onClick={() => setMode("external")}
          icon="🔌"
        />
      </div>

      {mode === "auto" && !databaseUrlPresent && (
        <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
          DATABASE_URL est absente de l&apos;environnement : le mode automatique
          ne peut pas fonctionner. Définissez la variable (Compose/Coolify)
          puis revérifiez l&apos;environnement, ou choisissez une base externe.
        </p>
      )}

      {mode === "external" && (
        <form action={action} className="flex flex-col gap-4">
          {state.error && (
            <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p role="status" className="rounded-xl bg-success/15 px-4 py-3 text-sm font-semibold text-success">
              ✅ Connexion réussie : la base répond.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="host" label="Hôte" required error={state.fieldErrors?.host} />
            <Field
              id="port"
              label="Port"
              type="number"
              defaultValue="5432"
              required
              error={state.fieldErrors?.port}
            />
            <Field
              id="database"
              label="Nom de la base"
              required
              error={state.fieldErrors?.database}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="user" label="Utilisateur" required error={state.fieldErrors?.user} />
            <Field
              id="password"
              label="Mot de passe"
              type="password"
              autoComplete="new-password"
              error={state.fieldErrors?.password}
            />
            <div>
              <label htmlFor="sslMode" className="block text-sm font-bold">
                SSL
              </label>
              <select
                id="sslMode"
                name="sslMode"
                defaultValue="prefer"
                className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3"
              >
                <option value="disable">Désactivé</option>
                <option value="prefer">Préféré</option>
                <option value="require">Requis</option>
              </select>
            </div>
          </div>
          <p className="text-sm text-foreground-soft">
            🔒 Le mot de passe n&apos;est jamais enregistré ni affiché. Les
            informations de connexion restent dans la configuration de
            l&apos;application (variables d&apos;environnement), jamais en base.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl border-2 border-magic px-4 py-3 font-bold hover:bg-background-soft disabled:opacity-60"
          >
            {pending ? "Test en cours…" : "Tester la connexion"}
          </button>
        </form>
      )}

      <p className="text-sm text-foreground-soft">
        ℹ️ L&apos;application utilise la connexion définie par la variable
        d&apos;environnement
        <code className="mx-1 rounded bg-background-soft px-1">DATABASE_URL</code>
        {databaseUrlPresent
          ? " (définie). Si vous avez testé une base externe différente, "
          : " (absente). Si votre base est externe, "}
        configurez cette variable avec les mêmes informations puis
        redémarrez l&apos;application : les identifiants ne sont jamais stockés
        dans la base applicative.
      </p>

      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border-2 border-magic px-4 py-3 font-bold hover:bg-background-soft"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={mode === "auto" && !databaseUrlPresent}
          className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

/* ---------------- Étape 4 : initialisation ---------------- */

function InitializeStep({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [state, action, pending] = useActionState(initializeAction, initialState);
  const allOk = Boolean(state.init?.length) && state.init?.every((s) => s.ok);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold">Initialisation</h1>
      <p className="text-foreground-soft">
        Les opérations sont réellement exécutées : migrations versionnées
        (jamais destructives), vérification des tables, données de
        référence. Si une étape échoue, rien n&apos;est perdu et vous pouvez
        corriger la configuration.
      </p>
      <form action={action} className="flex flex-wrap items-center gap-3">
        {/* L'initialisation cible DATABASE_URL de l'environnement (c'est la
            connexion que l'application utilisera) ; la base externe testée
            à l'étape 3 sert de vérification préalable. */}
        <input type="hidden" name="mode" value="auto" />
        <button
          type="submit"
          disabled={pending}
          className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
        >
          {pending ? "Initialisation en cours…" : "🚀 Lancer l'initialisation"}
        </button>
      </form>

      {state.init && state.init.length > 0 && (
        <ol className="flex flex-col gap-3">
          {state.init.map((step) => (
            <li key={step.id} className="rounded-2xl bg-background-soft/10 p-4">
              <p className="font-bold">
                <span aria-hidden>{step.ok ? "✅" : "❌"}</span> {step.label}
              </p>
              <p className="mt-1 text-sm text-foreground-soft">{step.detail}</p>
              {step.logs && step.logs.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-bold">
                    Détails techniques
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-background p-3 text-foreground-soft">
                    {step.logs.join("\n")}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}

      {state.error && (
        <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border-2 border-magic px-4 py-3 font-bold hover:bg-background-soft"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!allOk}
          className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}

/* ---------------- Étape 5 : administrateur ---------------- */

function AdminStep({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(createAdminAction, initialState);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold">
        Premier compte administrateur
      </h1>
      <p className="text-foreground-soft">
        Ce compte est le véritable administrateur de l&apos;application. Son mot
        de passe est haché (bcrypt) — jamais de mot de passe par défaut.
        Après sa création, l&apos;assistant est verrouillé définitivement.
      </p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error">
          {state.error}
        </p>
      )}
      <Field
        id="displayName"
        label="Nom ou pseudonyme"
        required
        error={state.fieldErrors?.displayName}
      />
      <Field
        id="email"
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="password"
          label="Mot de passe (8 caractères minimum)"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.password}
        />
        <Field
          id="passwordConfirm"
          label="Confirmation du mot de passe"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.passwordConfirm}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-large bg-button text-white shadow-lg hover:bg-button-hover disabled:opacity-60"
      >
        {pending ? "Création sécurisée…" : "🔒 Créer l'administrateur"}
      </button>
    </form>
  );
}

/* ---------------- Étape 6 : terminé ---------------- */

function SuccessStep() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p aria-hidden className="text-5xl">
        🏰✨
      </p>
      <h1 className="font-display text-3xl font-bold">Installation terminée !</h1>
      <ul className="flex flex-col gap-2 text-left text-foreground-soft">
        <li>✅ Application installée</li>
        <li>✅ Base de données connectée</li>
        <li>✅ Migrations appliquées</li>
        <li>✅ Administrateur créé</li>
        <li>✅ Configuration terminée</li>
      </ul>
      <p className="text-sm text-foreground-soft">
        L&apos;assistant est désormais verrouillé. La récupération d&apos;accès
        administrateur se fait via la page dédiée (jeton
        <code className="mx-1 rounded bg-background-soft px-1">ADMIN_RECOVERY_TOKEN</code>
        , voir docs/INSTALLATION.md).
      </p>
      <a
        href="/parent/connexion"
        className="btn-large bg-button text-white shadow-lg hover:bg-button-hover"
      >
        Accéder à l&apos;application
      </a>
    </div>
  );
}

/* ---------------- Champs réutilisables ---------------- */

function ModeCard({
  title,
  subtitle,
  selected,
  onClick,
  icon,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-2xl border-2 p-4 text-left transition ${
        selected
          ? "border-button bg-button/10"
          : "border-magic/40 hover:bg-background-soft/40"
      }`}
    >
      <span aria-hidden className="text-2xl">
        {icon}
      </span>
      <p className="mt-1 font-bold">{title}</p>
      <p className="text-xs text-foreground-soft">{subtitle}</p>
    </button>
  );
}

function Field({
  id,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required,
  autoComplete,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
        {required && <span aria-hidden> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-xl border-2 border-magic/40 bg-card px-4 py-3"
      />
      {error && (
        <p role="alert" className="mt-1 text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}
