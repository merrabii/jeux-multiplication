import { test, expect } from "@playwright/test";
import "dotenv/config";
import { Client } from "pg";

/**
 * E2E de l'assistant d'installation (scénarios de la mission 1–8, 15) :
 *
 * 1. Purge SQL directe : installation + utilisateurs + profils
 *    (la base de TEST, jamais la base de dev) ;
 * 2. première ouverture de « / » → redirection vers /installation ;
 * 3. parcours complet des 6 étapes de l'assistant dans le navigateur
 *    (environnements, configuration, base, initialisation réelle,
 *    premier administrateur, page de réussite) ;
 * 4. connexion de l'administrateur créé via /parent/connexion ;
 * 5. verrouillage : /installation redirige vers la connexion ;
 * 6. restauration de l'état pour les specs suivantes (journey /
 *    persistence) : installation marquée terminée.
 *
 * S'exécute en PREMIER (ordre alphabétique) avec workers: 1.
 */

const ADMIN_EMAIL = "admin-install@royaume-test.example";
const ADMIN_PASSWORD = "MotDePasseSolide1";

function testClient(): Client {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL manquant");
  return new Client({ connectionString: url });
}

test.beforeAll(async () => {
  const client = testClient();
  await client.connect();
  try {
    // Purge (base de TEST uniquement) : l'assistant exige une base
    // sans utilisateur ni profil (mode hérité sinon).
    await client.query("DELETE FROM users"); // cascade : profils, sessions…
    await client.query("DELETE FROM installation");
    await client.query("DELETE FROM app_config WHERE key LIKE 'app.%'");
    await client.query("DELETE FROM login_attempts");
  } finally {
    await client.end();
  }
});

test.afterAll(async () => {
  // Restauration pour les specs suivantes : installation terminée.
  const client = testClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO installation (id, status, "completedAt", "appVersion", "updatedAt")
       VALUES ('installation', 'completed', NOW(), 'e2e', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'completed', "completedAt" = NOW(), "updatedAt" = NOW()`,
    );
  } finally {
    await client.end();
  }
});

test("première ouverture : redirection vers l'assistant puis installation complète", async ({
  page,
}) => {
  // 1. La page d'accueil redirige vers l'installateur.
  await page.goto("/");
  await expect(page).toHaveURL(/\/installation/);

  // 1b. Si un jeton d'installation est exigé (INSTALL_TOKEN), l'assistant
  //     demande d'abord le jeton : un jeton erroné est refusé, le bon
  //     déverrouille l'assistant.
  if (process.env.INSTALL_TOKEN) {
    await expect(
      page.getByRole("heading", { name: "Jeton d'installation" }),
    ).toBeVisible();
    await page.getByLabel("Jeton").fill("jeton-incorrect");
    await page.getByRole("button", { name: "Déverrouiller l'assistant" }).click();
    await expect(page.getByText("Jeton d'installation invalide.")).toBeVisible();
    await page.getByLabel("Jeton").fill(process.env.INSTALL_TOKEN);
    await page.getByRole("button", { name: "Déverrouiller l'assistant" }).click();
  }

  await expect(
    page.getByRole("heading", { name: "Vérification de l'environnement" }),
  ).toBeVisible();

  // 2. Étape 1 : vérifications réelles affichées.
  await expect(page.getByText("Connexion PostgreSQL").first()).toBeVisible();
  await expect(page.getByText("Migrations Prisma").first()).toBeVisible();
  await expect(page.getByText(/Version de l'application/)).toBeVisible();

  // 3. Étape 2 : configuration.
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(
    page.getByRole("heading", { name: "Configuration" }),
  ).toBeVisible();
  const appName = page.getByLabel(/Nom de l'application/);
  await appName.fill("Royaume E2E");
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();

  // 4. Étape 3 : base de données (mode automatique — DATABASE_URL définie).
  await expect(
    page.getByRole("heading", { name: "Base de données" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();

  // 5. Étape 4 : initialisation RÉELLE (migrations, tables, avatars).
  await expect(
    page.getByRole("heading", { name: "Initialisation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lancer l'initialisation" })
    .click();
  // L'initialisation est réelle (spawn du CLI Prisma) : délai large.
  await expect(page.getByText("Vérification de la connexion")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText(/Migrations appliquées|migrations appliquée\(s\)|à jour/i).first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText(/avatars disponibles/).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();

  // 6. Étape 5 : premier administrateur.
  await expect(
    page.getByRole("heading", { name: "Premier compte administrateur" }),
  ).toBeVisible();
  await page.getByLabel(/Nom ou pseudonyme/).fill("Admin Royaume");
  await page.getByLabel(/Adresse e-mail/).fill(ADMIN_EMAIL);
  await page.getByLabel(/Mot de passe \(8 caractères minimum\)/).fill(ADMIN_PASSWORD);
  await page.getByLabel(/Confirmation du mot de passe/).fill(ADMIN_PASSWORD);
  await page
    .getByRole("button", { name: "Créer l'administrateur" })
    .click();

  // 7. Étape 6 : page de réussite.
  await expect(
    page.getByRole("heading", { name: "Installation terminée !" }),
  ).toBeVisible();
  await expect(page.getByText("✅ Administrateur créé")).toBeVisible();
  await page.getByRole("link", { name: "Accéder à l'application" }).click();
  await expect(page).toHaveURL(/\/parent\/connexion/);
});

test("l'installateur est verrouillé après l'installation", async ({ page }) => {
  await page.goto("/installation");
  // Redirection immédiate vers la connexion (verrou définitif).
  await expect(page).toHaveURL(/\/parent\/connexion/);
});

test("l'administrateur créé peut se connecter (scénario 15)", async ({ page }) => {
  await page.goto("/parent/connexion");
  await page.getByLabel("Adresse e-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  // Connexion réussie : espace parent visible.
  await expect(page).toHaveURL(/\/parent/);
  await expect(page.getByText("Espace parent").first()).toBeVisible();
});
