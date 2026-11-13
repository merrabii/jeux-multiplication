import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Persistance réelle : exécuté APRÈS redémarrage du serveur Next.js
 * (et non pas seulement un rechargement de page). Les cookies
 * (session parent + sélection enfant) et TOUTES les données viennent
 * de PostgreSQL : les étoiles doivent toujours être là.
 */

const AUTH_STATE = "tests/e2e/.auth/state.json";

test.use({ storageState: AUTH_STATE });

/**
 * Navigation robuste : en environnement dev, un goto peut être interrompu
 * (« Navigation ... interrupted by another navigation ») par une navigation
 * concurrente (prefetch/HMR). On retente simplement.
 */
async function gotoStable(
  page: import("@playwright/test").Page,
  url: string,
): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { timeout: 20_000 });
      return;
    } catch {
      if (attempt === 3) throw new Error(`Navigation impossible : ${url}`);
      await page.waitForTimeout(1_500);
    }
  }
}

test("après redémarrage du serveur : étoiles, progression et stats intactes", async ({ page }) => {
  const runState = JSON.parse(
    readFileSync("tests/e2e/.auth/run-state.json", "utf-8"),
  ) as { email: string; childName: string };

  // Les cookies ont survécu au redémarrage du process Next.js.
  await gotoStable(page, "/enfant");
  await expect(page.getByRole("heading", { name: "Mission du jour" })).toBeVisible();
  await expect(page.getByText(runState.childName, { exact: true })).toBeVisible();

  const starsText = await page.getByText(/⭐ \d+/).first().textContent();
  const stars = Number(starsText?.match(/⭐\s*(\d+)/)?.[1] ?? 0);
  expect(stars).toBeGreaterThanOrEqual(34);

  // Leçons validées visibles sur le dashboard (état PostgreSQL persisté).
  await expect(page.getByText(/1\/10 leçons validées/)).toBeVisible();

  // Leçons validées visibles côté enfant (page Apprendre).
  await gotoStable(page, "/enfant/apprendre");
  await expect(
    page.getByRole("heading", { name: "Les 10 tables magiques" }),
  ).toBeVisible();
  await expect(page.getByText("Validée ✓").first()).toBeVisible();

  // Espace parent : mêmes statistiques (source PostgreSQL).
  await gotoStable(page, "/enfant");
  // En dev, le server action du formulaire peut être annulé par une
  // re-navigation HMR : on retente si la navigation ne part pas.
  await page.getByRole("button", { name: "Retour parent" }).click();
  try {
    await page.waitForURL(/\/parent$/, { timeout: 8_000 });
  } catch {
    await page.getByRole("button", { name: "Retour parent" }).click();
    await expect(page).toHaveURL(/\/parent$/);
  }
  await expect(page.getByText("Sessions : 3")).toBeVisible();
  await expect(page.getByText(/Tables maîtrisées :/)).toBeVisible();
});

test.describe("sécurité", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/enfant sans cookies → redirection", async ({ page }) => {
    await page.goto("/enfant");
    await expect(page).toHaveURL(/\/parent/);
    await expect(
      page.getByRole("heading", { name: /Espace parent|Connexion/ }),
    ).toBeVisible();
  });
});
