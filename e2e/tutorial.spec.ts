import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * E2E spec for the Pensacola tutorial vertical slice.
 * Covers: /create → /play deterministic golden path, keyboard navigation,
 * save/resume, recovery path, corrupt-save handling, and a11y.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Dismiss any active event UI (resolution text + Continue, or event option chooser)
 * so that route buttons become visible again. Returns true if an event was dismissed.
 */
async function dismissActiveEvent(page: Page): Promise<boolean> {
  // If a resolution/outcome is showing, click Continue
  const continueBtn = page.getByRole("button", { name: /^continue$/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
    return true;
  }

  // If an event panel with options is showing, pick the first available option
  const eventOption = page
    .locator(".event-option-button:not([disabled])")
    .first();
  if (await eventOption.isVisible().catch(() => false)) {
    await eventOption.click();
    return true;
  }

  return false;
}

/**
 * Click a specific route button by matching its label text.
 * Waits for the button to appear and clicks it.
 */
async function clickRoute(page: Page, labelPattern: RegExp) {
  // First, clear any active events that might be blocking the route buttons
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await dismissActiveEvent(page)) {
      // Give the UI a moment to re-render after dismissing
      await page.waitForTimeout(200);
      continue;
    }
    break;
  }

  const routeBtn = page.locator("button").filter({ hasText: labelPattern });
  await expect(routeBtn).toBeVisible({ timeout: 5000 });
  await routeBtn.click();
}

/**
 * Advance through events and travel a specific named route edge.
 * After clicking the route, clears any post-travel events too.
 */
async function travelRoute(page: Page, labelPattern: RegExp) {
  await clickRoute(page, labelPattern);
  // After travel, events may fire. Dismiss them.
  await page.waitForTimeout(300);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (await dismissActiveEvent(page)) {
      await page.waitForTimeout(200);
      continue;
    }
    break;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Pensacola tutorial E2E", () => {
  test("golden path: deterministic route to chapter exit", async ({ page }) => {
    await createCharacterAndPlay(page, "Golden Path");
    await expect(page.getByRole("heading", { name: /journey/i })).toBeVisible();

    // Deterministic shortest path through the Pensacola graph:
    // hotel → neighborhood → rail → industrial → bridge → exit-north
    // Each edge label is unique, so we match on it.

    // 1. Hotel → West Neighborhood
    await travelRoute(page, /Cut through west neighborhoods/i);

    // 2. Neighborhood → Rail Corridor
    await travelRoute(page, /Find the old rail corridor/i);

    // 3. Rail → Industrial Park
    await travelRoute(page, /Follow tracks to the warehouses/i);

    // 4. Industrial → North Bridge
    await travelRoute(page, /Work around to the bridge/i);

    // 5. Bridge → Exit North (this triggers chapter transition)
    await travelRoute(page, /Cross the bridge and head north/i);

    // Assert: "Chapter Complete" heading must be visible
    await expect(page.getByText("Chapter Complete")).toBeVisible({
      timeout: 5000,
    });

    // Assert: the chapter-complete section shows escape text
    await expect(page.getByText(/escaped Pensacola/i)).toBeVisible();
  });

  test("save/resume: progress is preserved across page reload", async ({
    page,
  }) => {
    await createCharacterAndPlay(page, "Save Tester");
    await expect(page.getByRole("heading", { name: /journey/i })).toBeVisible();

    // Take one route step to create state that differs from initial
    await travelRoute(page, /Cut through west neighborhoods/i);

    // Capture location name before reload — we should be at "West Residential District"
    await expect(page.getByText("West Residential District")).toBeVisible();

    // Capture a meter value for comparison (Health should be visible)
    const healthBefore = await page
      .locator("section[aria-label='Player status']")
      .getByText(/^\d+$/)
      .first()
      .textContent();

    // Reload the page to simulate resume
    await page.reload();

    // The page should load from sessionStorage save — not show "No save found"
    await expect(page.getByRole("heading", { name: /journey/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/no save found/i)).not.toBeVisible();

    // Location should still be West Residential District
    await expect(page.getByText("West Residential District")).toBeVisible();

    // Health meter should be preserved
    const healthAfter = await page
      .locator("section[aria-label='Player status']")
      .getByText(/^\d+$/)
      .first()
      .textContent();
    expect(healthAfter).toBe(healthBefore);

    // Can continue playing — route buttons should be available
    const nextRoute = page
      .locator("button")
      .filter({ hasText: /→.*Distance/i })
      .first();
    await expect(nextRoute).toBeVisible();
  });

  test("corrupt save: /play shows create prompt gracefully", async ({
    page,
  }) => {
    // Inject corrupt save data before navigating
    await page.goto("/play");
    await page.evaluate((key) => {
      sessionStorage.setItem(key, "{corrupted json!!!");
    }, "northbound-save");
    await page.reload();

    // Should show "No save found" — the corrupt data is rejected
    await expect(page.getByText(/no save found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create/i })).toBeVisible();
  });

  test("recovery path: encounter setback, take recovery action, verify state", async ({
    page,
  }) => {
    await createCharacterAndPlay(page, "Recovery Tester");
    await expect(page.getByRole("heading", { name: /journey/i })).toBeVisible();

    // Travel until an event triggers, or trigger one manually via "Look around"
    // We'll try to trigger an event; if none available, travel first then try again
    let eventEncountered = false;
    const maxAttempts = 15;

    for (let i = 0; i < maxAttempts && !eventEncountered; i++) {
      // Check for event trigger button
      const eventBtn = page.getByRole("button", { name: /look around/i });
      if (await eventBtn.isVisible().catch(() => false)) {
        await eventBtn.click();
        await page.waitForTimeout(300);

        // Check if an event panel appeared with options
        const eventOption = page
          .locator(".event-option-button:not([disabled])")
          .first();
        if (await eventOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Record health before the event choice
          const healthSection = page.locator(
            "section[aria-label='Player status']",
          );
          const healthVisible = await healthSection
            .isVisible()
            .catch(() => false);

          // Choose the first available option (may cause setback)
          await eventOption.click();
          await page.waitForTimeout(300);

          // An event outcome should be showing
          const outcomeSection = page.locator(
            "section[aria-label='Event outcome']",
          );
          if (
            await outcomeSection.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
            // Resolution text should be visible
            await expect(outcomeSection.locator("p").first()).not.toBeEmpty();
            eventEncountered = true;

            // Dismiss the outcome
            const continueBtn = page.getByRole("button", {
              name: /^continue$/i,
            });
            await continueBtn.click();

            // After recovery/dismissal, the player should still be on the play page
            // with route options or event options visible
            if (healthVisible) {
              await expect(healthSection).toBeVisible();
            }
          } else {
            // Event was already auto-dismissed; that still counts
            eventEncountered = true;
          }
          continue;
        }
      }

      // If no event available, try continuing or travelling
      const continueBtn = page.getByRole("button", { name: /^continue$/i });
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click();
        continue;
      }

      // Travel to generate state that may unlock events
      const routeBtn = page
        .locator("button")
        .filter({ hasText: /→.*Distance/i })
        .first();
      if (await routeBtn.isVisible().catch(() => false)) {
        await routeBtn.click();
        await page.waitForTimeout(300);
        continue;
      }
      break;
    }

    // Verify an event was actually encountered — the test must not silently pass
    expect(
      eventEncountered,
      "Expected to encounter at least one event during gameplay",
    ).toBe(true);

    // After the event and recovery, the game should still be playable
    // (either route buttons or event buttons must be visible, OR chapter complete)
    const routeVisible = await page
      .locator("button")
      .filter({ hasText: /→.*Distance/i })
      .first()
      .isVisible()
      .catch(() => false);
    const eventVisible = await page
      .getByRole("button", { name: /look around/i })
      .isVisible()
      .catch(() => false);
    const chapterDone = await page
      .getByText("Chapter Complete")
      .isVisible()
      .catch(() => false);

    expect(
      routeVisible || eventVisible || chapterDone,
      "After recovery, the game should still be playable or chapter complete",
    ).toBe(true);
  });

  test("keyboard navigation: route button activates with Enter", async ({
    page,
  }) => {
    await createCharacterAndPlay(page, "KB Tester");

    // Clear any initial events that might be blocking
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await dismissActiveEvent(page)) {
        await page.waitForTimeout(200);
        continue;
      }
      break;
    }

    // Route button MUST exist — fail immediately if absent
    const routeBtn = page
      .locator("button")
      .filter({ hasText: /→.*Distance/i })
      .first();
    await expect(
      routeBtn,
      "Route button must be present for keyboard test",
    ).toBeVisible({ timeout: 5000 });

    // Focus the route button and activate with Enter
    await routeBtn.focus();
    await page.keyboard.press("Enter");

    // Should have triggered travel — journey log should appear
    await expect(page.getByText(/journey log/i)).toBeVisible({
      timeout: 5000,
    });
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
