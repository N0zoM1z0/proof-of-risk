import { expect, test } from "@playwright/test";

test("production preview renders core panels and updates replay seed", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Deterministic engine foundation" })).toBeVisible();
  await expect(page.locator("section.rpsDemo").getByRole("heading", { name: "Ballot RPS" })).toBeVisible();
  await expect(page.locator("section.nimDemo").getByRole("heading", { name: "Zero Nim" })).toBeVisible();
  await expect(page.locator("section.goodDemo").getByRole("heading", { name: "Greater Good" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Auction and probability tutorials" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data-driven rules catalog" })).toBeVisible();

  const replayHash = page.locator(".grid .hash").first();
  const beforeHash = await replayHash.textContent();
  await page.getByRole("textbox", { name: "Replay seed" }).fill("phase-13-browser-seed");
  await expect(replayHash).not.toHaveText(beforeHash ?? "");
});

test("browser interactions update ruleset-driven controls", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Preferred play").selectOption("scissors");
  await expect(page.getByText(/wins by revealed RPS comparison|Tie reveal/)).toBeVisible();

  await page.getByLabel("Player die").selectOption("tide");
  await expect(page.getByText("granite is the counter-pick to tide")).toBeVisible();

  await page.getByLabel("Phase").selectOption("phase-8");
  await expect(page.getByLabel("Filtered gamble catalog").getByRole("button")).toHaveCount(5);
  await expect(page.getByLabel("Filtered gamble catalog").getByRole("button", { name: /All-pay Vote Auction/ })).toBeVisible();
});
