import path from "node:path";
import { expect, test } from "@playwright/test";

const screenshotPath = (name: string) => path.join(process.cwd(), "docs", "screenshots", name);

async function freezeMessagesAtTop(page: import("@playwright/test").Page) {
  await page.locator(".messages").evaluate((element) => {
    element.style.scrollBehavior = "auto";
    element.style.overflowY = "hidden";
    element.scrollTop = 0;
  });
  await expect.poll(() => page.locator(".messages").evaluate((element) => element.scrollTop)).toBe(0);
}

test("renders the local demo and answers a financial question", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "United Finance" }).last()).toBeVisible();
  await expect(page.getByText("Assistente financeiro em modo demonstração local")).toBeVisible();

  const composer = page.getByRole("textbox", { name: "Mensagem" });
  await composer.fill("Vou ficar apertado no próximo mês?");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText(/^Em 2026-09, as faturas somam/)).toBeVisible();
  const hasHorizontalOverflow = await page.locator(".messages").evaluate(
    (element) => element.scrollWidth > element.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  if (testInfo.project.name === "desktop") {
    const navigation = page.getByRole("complementary", { name: "Navegação principal" });
    await expect(navigation.getByRole("button", { name: "Nova conversa" })).toBeVisible();
    await expect(navigation.getByRole("button")).toHaveCount(1);
  } else {
    await expect(page.getByRole("complementary", { name: "Navegação principal" })).toBeHidden();
  }

  await freezeMessagesAtTop(page);
  await page.screenshot({
    path: screenshotPath(`united-finance-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("captures the mobile login screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile screenshot only");

  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Suas finanças, em qualquer lugar." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  await page.screenshot({ path: screenshotPath("united-finance-mobile-login.png"), fullPage: true });
});

test("captures a plain mobile conversation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile screenshot only");
  await page.goto("/");

  await page.getByRole("textbox", { name: "Mensagem" }).fill("O que você pode fazer?");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText(/^Posso consultar resumos e faturas/)).toBeVisible();
  await freezeMessagesAtTop(page);
  await page.screenshot({ path: screenshotPath("united-finance-mobile-conversation.png"), fullPage: true });
});

test("captures a financial table on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile screenshot only");
  await page.goto("/");

  await page.getByRole("textbox", { name: "Mensagem" }).fill("Mostre minhas faturas");
  await page.getByRole("button", { name: "Enviar" }).click();

  const tableHeading = page.getByRole("heading", { name: "Faturas de 2026-08" });
  await expect(tableHeading).toBeVisible();
  await tableHeading.scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshotPath("united-finance-mobile-table.png"), fullPage: true });
});
