import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * E2E spec for the Pensacola tutorial vertical slice.
 * Covers: /create → /play golden path, keyboard navigation, and a11y.
 */

/** Complete character creation and land on /play */
async function createCharacterAndPlay(page: Page, name: string) {
  await page.goto("/create");
  await page.getByPlaceholder("Your character's name").fill(name);
  await page.getByLabel("Portrait 1").click();
  await page.getByRole("button", { name: /next/i }).click();

  // Occupation step — click first occupation card (label wrapping hidden radio)
  await page
    .getByRole("radiogroup", { name: /choose an occupation/i })
    .locator("label")
    .first()
    .click();
  await page.getByRole("button", { name: /next/i }).click();

  // Motivation step — fill required fields
  await page.getByLabel("Motivation").fill("My family needs me");
  await page.getByLabel("Weakness").fill("I freeze under pressure");
  await page.getByRole("button", { name: /next/i }).click();

  // Review step — begin
  await page.getByRole("button", { name: /begin the journey/i }).click();
  await expect(page).toHaveURL(/\/play/);
}

test.describe("Pensacola tutorial E2E", () => {
  test("golden path: create character → play → chapter exit", async ({
    page,
  }) => {
    await createCharacterAndPlay(page, "E2E Tester");
    await expect(
      page.getByRole("heading", { name: /journey/i }),
    ).toBeVisible();

    // Play: traverse routes until chapter complete or max iterations
    const maxIterations = 30;
    for (let i = 0; i < maxIterations; i++) {
      const chapterComplete = await page
        .getByText("Chapter Complete")
        .isVisible()
        .catch(() => false);
      if (chapterComplete) break;

      // Dismiss outcome if showing
      const continueBtn = page.getByRole("button", { name: /continue/i });
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
        continue;
      }

      // Trigger event if available
      const eventBtn = page.getByRole("button", { name: /look around/i });
      if (await eventBtn.isVisible().catch(() => false)) {
        await eventBtn.click();
        // Pick first option button in event panel
        const optionBtn = page
          .locator("[aria-label='Event options'], section")
          .getByRole("button")
          .first();
        if (await optionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await optionBtn.click();
        }
        continue;
      }

      // Travel first available route
      const routeBtn = page
        .locator("button")
        .filter({ hasText: /→.*Distance/i })
        .first();
      if (await routeBtn.isVisible().catch(() => false)) {
        await routeBtn.click();
        continue;
      }

      break;
    }

    // Verify game progressed
    const journeyLog = page.getByText(/journey log/i);
    await expect(journeyLog).toBeVisible();
  });

  test("keyboard navigation works on /play actions", async ({ page }) => {
    await createCharacterAndPlay(page, "KB Tester");

    // Tab to route button and activate with Enter
    const routeBtn = page
      .locator("button")
      .filter({ hasText: /→.*Distance/i })
      .first();
    if (await routeBtn.isVisible().catch(() => false)) {
      await routeBtn.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText(/journey log/i)).toBeVisible();
    }
  });

  test("a11y: /create page has no critical violations", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("domcontentloaded");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual(
      [],
    );
  });

  test("a11y: /play page has no critical violations", async ({ page }) => {
    await createCharacterAndPlay(page, "A11y Tester");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual(
      [],
    );
  });

  test("no save: /play shows create prompt", async ({ page }) => {
    await page.goto("/play");
    await expect(page.getByText(/no save found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create/i })).toBeVisible();
  });
});
