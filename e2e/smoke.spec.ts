import { expect, test, type Page } from "@playwright/test";

/** Signs in with the demo account (local mode) and lands on the dashboard. */
async function demoLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /conta de demonstração/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("public pages", () => {
  test("landing links to plans, terms and privacy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /campanhas viram séries/i })).toBeVisible();
    const legal = page.getByRole("navigation", { name: "Informações legais" });
    await expect(legal.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/terms");
    await expect(legal.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacy");
  });

  test("terms, privacy and plans render", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeVisible();
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeVisible();
    await expect(page.getByText(/art\. 18 da LGPD/)).toBeVisible();
    await page.goto("/plans");
    for (const name of ["Grátis", "Mestre", "Mesa"]) await expect(page.getByRole("heading", { name: new RegExp(`^${name}`) })).toBeVisible();
  });

  test("sign-up asks to accept the terms", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nome de exibição").fill("Teste E2E");
    await page.getByLabel("E-mail").fill(`e2e-${Date.now()}@exemplo.dev`);
    await page.getByLabel("Senha", { exact: true }).fill("senha-forte-123");
    await page.getByLabel("Confirmar senha").fill("senha-forte-123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Aceite os termos para criar a conta.")).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });
});

test.describe("signed in (demo)", () => {
  test("settings show the plan and the privacy tools", async ({ page }) => {
    await demoLogin(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Plano" })).toBeVisible();
    await expect(page.getByText("Modo local: tudo liberado, sem cobrança.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar meus dados" })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar meus dados" }).click();
    expect((await download).suggestedFilename()).toMatch(/^role-quest-.+\.json$/);
  });

  test("a D&D character goes through the guided creation", async ({ page }) => {
    await demoLogin(page);
    await page.goto("/characters");
    await page.getByRole("button", { name: "Novo personagem" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill("Ayla E2E");
    await dialog.getByRole("button", { name: "Próximo" }).click();
    await expect(dialog.getByText(/Passo 1 de 5/)).toBeVisible();
    await dialog.getByRole("button", { name: /Humano/ }).click();
    await dialog.getByRole("button", { name: "Próximo" }).click();
    await dialog.getByRole("button", { name: /Guerreiro/ }).click();
    await dialog.getByRole("button", { name: "Próximo" }).click();
    await dialog.getByRole("button", { name: "Próximo" }).click();
    await dialog.getByRole("button", { name: "Atletismo" }).click();
    await dialog.getByRole("button", { name: "Intimidação" }).click();
    await dialog.getByRole("button", { name: "Próximo" }).click();
    await expect(dialog.getByText(/CA \d+/)).toBeVisible();
    await dialog.getByRole("button", { name: /Criar e abrir ficha/ }).click();
    await expect(page).toHaveURL(/\/characters\/ch_/);
    await expect(page.getByText("RAÇA, CLASSE E ANTECEDENTE", { exact: false })).toBeVisible();
  });
});
