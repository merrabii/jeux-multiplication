import Link from "next/link";
import type { Metadata } from "next";
import { ChildHeader } from "@/components/game/ChildHeader";
import { requireChildContext } from "@/lib/auth/child-guard";
import { prisma } from "@/lib/database/client";
import { getCompletedLessonTables } from "@/features/game/service";
import { MULTIPLICATION_TABLES } from "@/features/multiplication/tables";

export const metadata: Metadata = {
  title: "Apprendre — Royaume Magique des Multiplications",
};

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const { child } = await requireChildContext();
  const completed = await getCompletedLessonTables(prisma, child.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <ChildHeader child={child} active="apprendre" />
      <h2 className="font-display mt-8 text-2xl font-bold">
        Les 10 tables magiques
      </h2>
      <p className="mt-1 text-foreground-soft">
        Apprends chaque table : d&apos;abord comprendre, puis mémoriser.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MULTIPLICATION_TABLES.map((table) => {
          const done = completed.includes(table.number);
          return (
            <li key={table.number}>
              <Link
                href={`/enfant/apprendre/${table.number}`}
                className="block rounded-2xl bg-card p-5 text-card-foreground shadow-lg hover:bg-white"
              >
                <div className="flex items-center justify-between">
                  <p className="font-display text-2xl font-bold">
                    Table de {table.number}
                  </p>
                  <span
                    aria-label={done ? "Leçon validée" : "Leçon à faire"}
                    className="rounded-full px-3 py-1 text-sm font-bold"
                    style={{
                      background: done
                        ? "var(--royal-success)"
                        : "var(--background-soft)",
                      color: done ? "#fff" : "var(--foreground-soft)",
                    }}
                  >
                    {done ? "Validée ✓" : "À apprendre"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground-soft">
                  {table.guide} · {table.tip}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
