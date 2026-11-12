import { NextResponse } from "next/server";
import { getOptionalChildContext } from "@/lib/auth/child-guard";
import { completeGameSession } from "@/features/game/service";
import { prisma } from "@/lib/database/client";
import { BADGE_DEFINITIONS } from "@/features/rewards/rules";

/**
 * POST /api/game/complete — termine une session (idempotent).
 * Récompenses recalculées depuis les tentatives PostgreSQL : un score
 * soumis par le navigateur n'est jamais accepté.
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

  const input = body as { sessionId?: unknown; durationSeconds?: unknown };
  if (typeof input.sessionId !== "string") {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const result = await completeGameSession(
    prisma,
    context.child.id,
    input.sessionId,
    Number(input.durationSeconds ?? 0),
  );

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    alreadyCompleted: result.status === "already_completed",
    summary: result.summary,
    newBadges: result.newBadges.map(
      (key) =>
        BADGE_DEFINITIONS.find((b) => b.key === key)?.name ?? key,
    ),
  });
}
