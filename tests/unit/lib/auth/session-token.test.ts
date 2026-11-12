import { describe, expect, it } from "vitest";
import {
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/session-token";

const payload = { userId: "user-123", sessionId: "session-abc" };

describe("jetons de session JWT", () => {
  it("signe puis vérifie un jeton valide", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await signSessionToken(payload, expiresAt);
    const resolved = await verifySessionToken(token);
    expect(resolved).toEqual(payload);
  });

  it("rejette un jeton expiré", async () => {
    const expired = new Date(Date.now() - 1_000);
    const token = await signSessionToken(payload, expired);
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("rejette un jeton falsifié (signature invalide)", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await signSessionToken(payload, expiresAt);
    const tampered = token.slice(0, -4) + "AAAA";
    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it("rejette un jeton forgé avec une autre clé", async () => {
    // Simulation : jeton construit hors du service (mauvais secret).
    const fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.fake";
    await expect(verifySessionToken(fakeToken)).resolves.toBeNull();
  });

  it("rejette un jeton dont la charge utile est incomplète", async () => {
    // sub et jti sont obligatoires : un JWT valide sans jti est rejeté.
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
      .sign(key);
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });
});
