import { NextResponse } from "next/server";
import { getOptionalChildContext } from "@/lib/auth/child-guard";
import { startGameSession } from "@/features/game/service";
import { prisma } from "@/lib/database/client";

/**
 * POST /api/game/start — démarre une session de jeu.
 * Sécurité : session parent valide + enfant sélectionné vérifié côté
 * serveur (cookie rmm_child + appartenance). Les questions renvoyées ne
 * contiennent JAMAIS la réponse attendue.
 */
export async function POST(request: Request) {
  const context = await getOptionalChildContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const input = body as {
    kind?: unknown;
    tables?: unknown;
    difficulty?: unknown;
    questionCount?: unknown;
    targetPercent?: unknown;
  };

  const result = await startGameSession(prisma, context.child.id, {
    kind: String(input.kind ?? ""),
    tables: Array.isArray(input.tables) ? input.tables.map(Number) : [],
    difficulty: String(input.difficulty ?? ""),
    questionCount: Number(input.questionCount ?? 0),
    targetPercent: Number.isFinite(Number(input.targetPercent))
      ? Number(input.targetPercent)
      : undefined,
  });

  if (result.status === "invalid_input") {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  return NextResponse.json({
    sessionId: result.sessionId,
    questions: result.questions,
  });
}
