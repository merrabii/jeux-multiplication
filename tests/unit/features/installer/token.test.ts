import { afterEach, describe, expect, it } from "vitest";
import {
  isInstallTokenRequired,
  verifyInstallToken,
  isRecoveryEnabled,
  verifyRecoveryToken,
} from "@/features/installer/token";

/**
 * Tests unitaires du jeton d'installation et du jeton de récupération
 * (comparaisons à temps constant, absence de valeur par défaut).
 */

describe("jeton d'installation", () => {
  afterEach(() => {
    delete process.env.INSTALL_TOKEN;
    delete process.env.INSTALL_TOKEN_FILE;
  });

  it("aucun jeton défini → aucune exigence, tout jeton est accepté", () => {
    expect(isInstallTokenRequired()).toBe(false);
    expect(verifyInstallToken(undefined)).toBe(true);
  });

  it("jeton défini → exigé, comparaison exacte", () => {
    process.env.INSTALL_TOKEN = "jeton-secret-de-test";
    expect(isInstallTokenRequired()).toBe(true);
    expect(verifyInstallToken("jeton-secret-de-test")).toBe(true);
    expect(verifyInstallToken("  jeton-secret-de-test  ")).toBe(true); // trim
    expect(verifyInstallToken("mauvais-jeton")).toBe(false);
    expect(verifyInstallToken(undefined)).toBe(false);
    expect(verifyInstallToken("")).toBe(false);
  });

  it("longueur différente → rejet sans lever d'exception (timing-safe)", () => {
    process.env.INSTALL_TOKEN = "a".repeat(50);
    expect(verifyInstallToken("court")).toBe(false);
  });
});

describe("jeton de récupération administrateur", () => {
  afterEach(() => {
    delete process.env.ADMIN_RECOVERY_TOKEN;
  });

  it("sans variable → mécanisme désactivé", () => {
    expect(isRecoveryEnabled()).toBe(false);
    expect(verifyRecoveryToken("nimporte")).toBe(false);
  });

  it("avec variable → comparaison exacte à temps constant", () => {
    process.env.ADMIN_RECOVERY_TOKEN = "recuperation-secret";
    expect(isRecoveryEnabled()).toBe(true);
    expect(verifyRecoveryToken("recuperation-secret")).toBe(true);
    expect(verifyRecoveryToken("faux")).toBe(false);
    expect(verifyRecoveryToken(undefined)).toBe(false);
  });
});
