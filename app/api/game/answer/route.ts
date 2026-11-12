import { NextResponse } from "next/server";
import { getOptionalChildContext } from "@/lib/auth/child-guard";
import { submitAnswer } from "@/features/game/service";
import { prisma } from "@/lib/database/client";

/**
 * POST /api/game/answer — enregistre une réponse.
 * La validité est recalculée côté serveur (a×b) : le navigateur ne peut
 * pas tricher. La correction est révélée APRÈS soumission.
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
    sessionId?: unknown;
    questionId?: unknown;
    answer?: unknown;
  };
  if (
    typeof input.sessionId !== "string" ||
    typeof input.questionId !== "string" ||
    typeof input.answer !== "number"
  ) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const result = await submitAnswer(
    prisma,
    context.child.id,
    input.sessionId,
    input.questionId,
    input.answer,
  );

  switch (result.status) {
    case "invalid_input":
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    case "not_found":
      return NextResponse.json({ error: "Question introuvable" }, { status: 404 });
    case "ok":
      return NextResponse.json({
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        repeatedAddition: result.repeatedAddition,
      });
  }
}
