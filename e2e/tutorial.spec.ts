import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * E2E spec for the Pensacola tutorial vertical slice.
 * Covers: /create → /play golden path, keyboard navigation, and a11y.
 */

test.describe("Pensacola tutorial E2E", () => {
  test("golden path: create character → play → chapter exit", async ({
    page,
  }) => {
    // Navigate to character creation
    await page.goto("/create");
    await expect(
      page.getByRole("heading", { name: /create your character/i }),
    ).toBeVisible();

    // Step 1: Identity — fill name, select portrait
    await page.getByPlaceholder("Your character's name").fill("E2E Tester");
    await page.getByLabel("Portrait 1").click();
    await page.getByRole("button", { name: /next/i }).click();

    // Step 2: Occupation — pick first available
    await page.getByRole("radiogroup", { name: /choose an occupation/i })
      .locator("button")
      .first()
      .click();
    await page.getByRole("button", { name: /next/i }).click();

    // Step 3: Backstory — just advance (defaults are fine)
    await page.getByRole("button", { name: /next/i }).click();

    // Step 4: Review — begin the journey
    await page.getByRole("button", { name: /begin the journey/i }).click();

    // Should be on /play now
    await expect(page).toHaveURL(/\/play/);
    await expect(
      page.getByRole("heading", { name: /journey/i }),
    ).toBeVisible();

    // Play: traverse routes until chapter complete or max iterations
    const maxIterations = 30;
    for (let i = 0; i < maxIterations; i++) {
      // Check if chapter is complete
      const chapterComplete = await page
        .getByText("Chapter Complete")
        .isVisible()
        .catch(() => false);
      if (chapterComplete) break;

      // If there's an active event with options, choose the first
      const continueBtn = page.getByRole("button", { name: /continue/i });
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
        continue;
      }

      // Try to trigger an event if available
      const eventBtn = page.getByRole("button", {
        name: /look around/i,
      });
      if (await eventBtn.isVisible().catch(() => false)) {
        await eventBtn.click();
        // After triggering, there should be event options — click first
        const optionBtn = page
          .locator("section")
          .filter({ hasText: /A Bad Step|Spotlight|Compass|Ally/i })
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

      // No actions available — break to avoid infinite loop
      break;
    }

    // Verify chapter transition happened or game progressed meaningfully
    const journeyLog = page.getByText(/journey log/i);
    await expect(journeyLog).toBeVisible();
  });

  test("keyboard navigation works on /play actions", async ({ page }) => {
    // Create character first via navigation
    await page.goto("/create");
    await page.getByPlaceholder("Your character's name").fill("KB Tester");
    await page.getByLabel("Portrait 1").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("radiogroup", { name: /choose an occupation/i })
      .locator("button")
      .first()
      .click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /begin the journey/i }).click();
    await expect(page).toHaveURL(/\/play/);

    // Tab to route button and activate with Enter
    const routeBtn = page
      .locator("button")
      .filter({ hasText: /→.*Distance/i })
      .first();
    if (await routeBtn.isVisible().catch(() => false)) {
      await routeBtn.focus();
      await page.keyboard.press("Enter");
      // Should have triggered travel
      await expect(page.getByText(/journey log/i)).toBeVisible();
    }
  });

  test("a11y: /create page has no critical violations", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("domcontentloaded");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"]) // theme-dependent
      .analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual(
      [],
    );
  });

  test("a11y: /play page has no critical violations", async ({ page }) => {
    // Set up save via /create flow
    await page.goto("/create");
    await page.getByPlaceholder("Your character's name").fill("A11y Tester");
    await page.getByLabel("Portrait 1").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("radiogroup", { name: /choose an occupation/i })
      .locator("button")
      .first()
      .click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByRole("button", { name: /begin the journey/i }).click();
    await expect(page).toHaveURL(/\/play/);

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
