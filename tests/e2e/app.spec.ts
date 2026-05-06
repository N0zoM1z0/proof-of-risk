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

test("room flow completes a browser-driven Ballot RPS match", async ({ page }) => {
  await page.goto("/");

  const roomFlow = page.locator("section.roomFlow");
  await expect(roomFlow.getByRole("heading", { name: "Room Flow Console" })).toBeVisible();
  await expect(page.getByTestId("room-flow-status")).toContainText("idle");

  await roomFlow.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByTestId("room-flow-status")).toContainText("open");

  await roomFlow.getByRole("button", { name: "Join NPC" }).click();
  await expect(page.getByTestId("room-flow-status")).toContainText("active");

  await roomFlow.getByRole("button", { name: "Run voter commit/reveal" }).click();
  await expect(page.getByTestId("room-flow-status")).toContainText("playCommit");
  await expect(page.getByTestId("room-flow-pending")).toHaveText("0");

  await roomFlow.getByRole("button", { name: "Commit plays" }).click();
  await expect(page.getByTestId("room-flow-status")).toContainText("playReveal");
  await expect(page.getByTestId("room-flow-pending")).toHaveText("2");

  await roomFlow.getByRole("button", { name: "Reveal plays" }).click();
  await expect(page.getByTestId("room-flow-status")).toContainText("settled");
  await expect(page.getByTestId("room-flow-settlement")).toContainText(/wins by revealed RPS comparison|Tie reveal/);
});

test("room flow surfaces invalid actor errors without breaking the flow", async ({ page }) => {
  await page.goto("/");

  const roomFlow = page.locator("section.roomFlow");
  await roomFlow.getByRole("button", { name: "Create room" }).click();
  await roomFlow.getByRole("button", { name: "Try invalid actor" }).click();

  await expect(page.getByTestId("room-flow-error")).toContainText("Actor is not allowed in this room");
  await roomFlow.getByRole("button", { name: "Join NPC" }).click();
  await expect(page.getByTestId("room-flow-status")).toContainText("active");
});

test("mobile layout does not introduce horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Deterministic engine foundation" })).toBeVisible();
  await expect(page.locator("section.rpsDemo").getByRole("heading", { name: "Ballot RPS" })).toBeVisible();
  await expect(page.locator("section.roomFlow").getByRole("heading", { name: "Room Flow Console" })).toBeVisible();
  await expect(page.locator("section.nimDemo").getByRole("heading", { name: "Zero Nim" })).toBeVisible();
  await expect(page.locator("section.goodDemo").getByRole("heading", { name: "Greater Good" })).toBeVisible();
  await expect(page.locator("section.expansionDemo").getByRole("heading", { name: "Auction and probability tutorials" })).toBeVisible();
  await expect(page.locator("section.lab").getByRole("heading", { name: "Data-driven rules catalog" })).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});
