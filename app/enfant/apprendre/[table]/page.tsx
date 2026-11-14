import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChildHeader } from "@/components/game/ChildHeader";
import { GameSession } from "@/components/game/GameSession";
import { requireChildContext } from "@/lib/auth/child-guard";
import {
  asRepeatedAddition,
  getTableTheme,
  multiply,
} from "@/features/multiplication/tables";

/**
 * Leçon d'une table (Phase 2.2-C) : introduction pédagogique, addition
 * répétée VISUALISÉE (groupes d'objets magiques), exemples interactifs,
 * table complète, puis vérification de 8 questions (session LESSON
 * enregistrée côté serveur).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ table: string }>;
}): Promise<Metadata> {
  const { table } = await params;
  const n = Number(table);
  return {
    title: `Table de ${Number.isInteger(n) ? n : "?"} — Royaume Magique`,
  };
}

const CRISTAL_EMOJIS = ["✨", "🌟", "💫", "🔮", "🪄", "🧿", "🎀", "🍬"];

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ table: string }>;
}) {
  const { table: tableParam } = await params;
  const tableNumber = Number(tableParam);
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 10) {
    notFound();
  }
  const { child } = await requireChildContext();
  const theme = getTableTheme(tableNumber)!;

  // Vérification de leçon : 8 questions faciles sur cette table.
  const LESSON_QUESTION_COUNT = 8;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <ChildHeader child={child} active="apprendre" />

      <section className="mt-8 rounded-2xl bg-card p-6 text-card-foreground shadow-lg sm:p-8">
        <p className="font-display text-sm text-star">
          Guide de cette table : {theme.guide}
        </p>
        <h2 className="font-display mt-1 text-2xl font-bold">
          La table de {tableNumber}
        </h2>
        <p className="mt-3 rounded-xl bg-background-soft px-4 py-3">
          <strong>Astuce magique :</strong> {theme.tip}
        </p>

        {/* Multiplication = addition répétée, visualisée */}
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold">
            Comprendre : multiplier, c&apos;est ajouter des groupes !
          </h3>
          <p className="mt-2 text-foreground-soft">
            {tableNumber} × 3, c&apos;est {tableNumber} groupes de 3 objets
            magiques. Compte-les !
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-label="Illustration de 3 groupes">
            {[1, 2, 3].map((group) => (
              <div
                key={group}
                className="rounded-2xl bg-background-soft p-4 text-center"
              >
                <p className="font-display text-sm font-bold text-foreground-soft">
                  Groupe {group}
                </p>
                <p className="mt-2 text-3xl tracking-widest" aria-hidden>
                  {CRISTAL_EMOJIS.slice(0, 3).map((e, i) => (
                    <span key={i}>{e}</span>
                  ))}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 font-display text-lg font-bold">
            {tableNumber} × 3 = {asRepeatedAddition(tableNumber, 3)} ={" "}
            {multiply(tableNumber, 3)}
          </p>
        </div>

        {/* Table complète */}
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold">
            La table complète
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label={`Table de ${tableNumber}`}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <li
                key={n}
                className="rounded-xl bg-background-soft px-3 py-2 text-center font-semibold"
              >
                {tableNumber} × {n} = <strong>{multiply(tableNumber, n)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Vérification (session LESSON réelle) */}
      <section className="mt-8">
        <h3 className="font-display text-xl font-bold">
          Vérifie ta leçon : 8 questions magiques
        </h3>
        <p className="mt-1 mb-4 text-foreground-soft">
          Réponds sans aide. Une erreur t&apos;explique la solution !
        </p>
        <GameSession
          kind="LESSON"
          availableTables={[tableNumber]}
          fixedCount={LESSON_QUESTION_COUNT}
        />
      </section>

      <p className="mt-8">
        <Link href="/enfant/apprendre" className="text-star underline">
          ← Toutes les tables
        </Link>
      </p>
    </main>
  );
}
