import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/database/client";

/**
 * Healthcheck applicatif (utilisé par Docker Compose et Coolify).
 * Vérifie que le processus tourne ET que PostgreSQL répond.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pingDatabase();
    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] Échec du ping PostgreSQL :", error);
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503 },
    );
  }
}
