import { expect, test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";

/**
 * Parcours E2E complet (un seul test = un seul état de navigateur
 * cohérent) : parent → inscription → profil enfant + avatar → dashboard
 * → leçon (8 questions réussies) → défi 5 questions parfait → étoiles
 * persistées → statistiques parent. L'état est sauvegardé pour le test
 * de persistance après redémarrage du serveur.
 */

const AUTH_STATE = "tests/e2e/.auth/state.json";
const RUN_STATE = "tests/e2e/.auth/run-state.json";

const EMAIL = `e2e-${Date.now()}@auth-test.example`;
const PASSWORD = "MotDePasseSolide1";
const CHILD_NAME = "PerleE2E";

async function answerCurrentQuestionCorrectly(page: import("@playwright/test").Page) {
  // Lit « a × b = ? », calcule le produit, clique le bon choix.
  const questionText = (await page
    .getByText(/× \d+ = \?/)
    .first()
    .textContent()) as string;
  const match = questionText.match(/(\d+)\s*×\s*(\d+)/);
  if (!match) throw new Error(`Question illisible : ${questionText}`);
  const product = Number(match[1]) * Number(match[2]);
  await page.getByRole("button", { name: new RegExp(`^${product}$`) }).click();
  // Correction révélée APRÈS soumission (validation serveur).
  await expect(page.getByRole("status").first()).toBeVisible({ timeout: 10_000 });
}

async function answerCurrentQuestionWrong(page: import("@playwright/test").Page) {
  // Clique volontairement un choix incorrect (mode entraînement).
  const questionText = (await page
    .getByText(/× \d+ = \?/)
    .first()
    .textContent()) as string;
  const match = questionText.match(/(\d+)\s*×\s*(\d+)/);
  if (!match) throw new Error(`Question illisible : ${questionText}`);
  const product = Number(match[1]) * Number(match[2]);
  const choices = page.getByRole("button", { name: /^\d+$/ });
  const count = await choices.count();
  for (let k = 0; k < count; k++) {
    const value = Number((await choices.nth(k).textContent())?.trim());
    if (Number.isFinite(value) && value !== product) {
      await choices.nth(k).click();
      await expect(page.getByRole("status").first()).toBeVisible({ timeout: 10_000 });
      return;
    }
  }
  throw new Error("Aucun choix erroné trouvé pour la question");
}

test("parcours complet : inscription → enfant → leçon → défi → étoiles", async ({ page }) => {
  // 1. Inscription parent
  await page.goto("/parent/inscription");
  await page.getByLabel("Adresse e-mail").fill(EMAIL);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmation du mot de passe").fill(PASSWORD);
  await page.getByLabel(/J'accepte les conditions/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByRole("heading", { name: "Espace parent" })).toBeVisible();

  // 2. Création du profil enfant avec avatar illustré (SVG réel)
  await page.getByLabel("Pseudonyme de l'enfant").fill(CHILD_NAME);
  await page.locator('label:has(img[alt="Licorne"])').click();
  await page.getByRole("button", { name: "Créer le profil enfant" }).click();
  await expect(page.getByText(`Profil de ${CHILD_NAME} créé !`)).toBeVisible();

  // 3. Entrée dans le royaume : dashboard + avatar chargé
  await page.getByRole("button", { name: "Entrer dans le royaume" }).click();
  await expect(page).toHaveURL(/\/enfant$/);
  const avatar = page.locator('img[alt^="Avatar de"]');
  await expect(avatar).toBeVisible();
  const natural = await avatar.evaluate(
    (el) => (el as HTMLImageElement).naturalWidth,
  );
  expect(natural).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Mission du jour" })).toBeVisible();

  // 4. Leçon de la table de 2 : pédagogie + 8 questions réussies
  await page.goto("/enfant/apprendre/2");
  await expect(
    page.getByText(/Comprendre : multiplier, c'est ajouter des groupes/),
  ).toBeVisible();
  await expect(page.getByText("2 × 3 = 3 + 3 = 6")).toBeVisible();

  await page.getByRole("button", { name: "C'est parti !" }).click();
  for (let i = 0; i < 8; i++) {
    await answerCurrentQuestionCorrectly(page);
    if (i < 7) {
      await page.getByRole("button", { name: "Question suivante" }).click();
    }
  }
  await page.getByRole("button", { name: "Terminer la session" }).click();
  await expect(page.getByText("Incroyable ! Un sans-faute magique !")).toBeVisible();
  await expect(page.getByText("+15 ⭐")).toBeVisible();
  await expect(page.getByText("Nouveaux badges !")).toBeVisible();

  // 5. Défi de 5 questions parfait
  await page.goto("/enfant/defis");
  await page.getByRole("button", { name: "5", exact: true }).first().click();
  await page.getByRole("button", { name: "C'est parti !" }).click();
  for (let i = 0; i < 5; i++) {
    await answerCurrentQuestionCorrectly(page);
    if (i < 4) {
      await page.getByRole("button", { name: "Question suivante" }).click();
    }
  }
  await page.getByRole("button", { name: "Terminer la session" }).click();
  await expect(page.getByText("Défi parfait ! ⭐⭐⭐")).toBeVisible();
  await expect(page.getByText("+15 ⭐")).toBeVisible();
  await expect(page.getByText("+75 XP")).toBeVisible();

  // Interaction « Rejouer » : retour à la configuration.
  await page.getByRole("button", { name: "Rejouer" }).click();
  await expect(page.getByRole("button", { name: "C'est parti !" })).toBeVisible();

  // 5b. Entraînement libre : table 3, 10 questions (9 bonnes, 1 erreur
  // volontaire — les erreurs sont autorisées dans ce mode).
  await page.goto("/enfant/entrainement");
  await expect(
    page.getByText(/pas de chronomètre : prends ton temps/),
  ).toBeVisible();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "C'est parti !" }).click();
  for (let i = 0; i < 10; i++) {
    if (i < 9) {
      await answerCurrentQuestionCorrectly(page);
    } else {
      await answerCurrentQuestionWrong(page);
    }
    if (i < 9) {
      await page.getByRole("button", { name: "Question suivante" }).click();
    }
  }
  await page.getByRole("button", { name: "Terminer la session" }).click();
  await expect(page.getByText("Session terminée !")).toBeVisible();
  await expect(
    page.getByText("Bravo, c'est un excellent défi réussi !"),
  ).toBeVisible();
  // Récompenses PRACTICE calculées côté serveur : floor(9/2)=4 ⭐, 9×10 XP.
  await expect(page.getByText("+4 ⭐")).toBeVisible();
  await expect(page.getByText("+90 XP")).toBeVisible();

  // 6. Étoiles persistées côté enfant (rechargement complet)
  await page.goto("/enfant");
  const starsText = await page.getByText(/⭐ \d+/).first().textContent();
  const stars = Number(starsText?.match(/⭐\s*(\d+)/)?.[1] ?? 0);
  expect(stars).toBeGreaterThanOrEqual(34); // 15 leçon + 15 défi + 4 entraînement

  await page.goto("/enfant/recompenses");
  await expect(page.getByText("Défi parfait")).toBeVisible();
  await expect(
    page.getByText(/Multiplications maîtrisées \(\d+\)/),
  ).toBeVisible();

  // 7. Statistiques parent réelles
  await page.getByRole("button", { name: "Retour parent" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByText("Sessions : 3")).toBeVisible();
  await expect(page.getByText(/Tables maîtrisées :/)).toBeVisible();
  await expect(page.getByText(/Réussite/).first()).toBeVisible();

  // 8. Responsive mobile rapide (même session)
  // Ré-entrée dans le royaume (le retour parent a retiré la sélection).
  await page.getByRole("button", { name: "Entrer dans le royaume" }).click();
  await expect(page).toHaveURL(/\/enfant$/);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/enfant");
  await expect(page.getByRole("heading", { name: "Mission du jour" })).toBeVisible();
  const worldImage = page.locator('img[alt=""]').first();
  await expect(worldImage).toBeVisible();

  // Sauvegarde de l'état pour le test de persistance (après redémarrage).
  mkdirSync("tests/e2e/.auth", { recursive: true });
  await page.context().storageState({ path: AUTH_STATE });
  writeFileSync(RUN_STATE, JSON.stringify({ email: EMAIL, childName: CHILD_NAME }));
});
