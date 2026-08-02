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

  test("recovery path: exhaustion setback triggers recovery that lowers fatigue", async ({
    page,
  }) => {
    // Create character to generate a valid versioned save
    await createCharacterAndPlay(page, "Recovery Tester");
    await expect(page.getByRole("heading", { name: /journey/i })).toBeVisible();

    // Modify the persisted save to set fatigue=75 (triggers exhaustion-check event
    // which requires meter.fatigue >= 70, chapter=pensacola-escape, no exhaustion-warned flag)
    const SAVE_KEY = "northbound-save";
    await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) throw new Error("No save found in sessionStorage");
      const envelope = JSON.parse(raw);
      envelope.state.party.player.meters.fatigue = 75;
      // Ensure the flag is not already set
      envelope.state.eventHistory.activeFlags =
        envelope.state.eventHistory.activeFlags.filter(
          (f: string) => f !== "exhaustion-warned",
        );
      sessionStorage.setItem(key, JSON.stringify(envelope));
    }, SAVE_KEY);

    // Reload to pick up the modified save
    await page.reload();
    await expect(page.getByRole("heading", { name: /journey/i })).toBeVisible({
      timeout: 5000,
    });

    // Verify fatigue is 75 before recovery
    const fatigueBefore = await page.evaluate(() => {
      const raw = sessionStorage.getItem("northbound-save");
      if (!raw) return -1;
      const envelope = JSON.parse(raw);
      return envelope.state.party.player.meters.fatigue as number;
    });
    expect(fatigueBefore).toBe(75);

    // Click "Look around" to trigger the exhaustion-check event
    const eventBtn = page.getByRole("button", { name: /look around/i });
    await expect(eventBtn).toBeVisible({ timeout: 5000 });
    await eventBtn.click();

    // The exhaustion event panel should appear with title "Hitting the Wall"
    await expect(page.getByText("Hitting the Wall")).toBeVisible({
      timeout: 5000,
    });

    // Select the recovery option: "Find a sheltered spot and rest"
    const recoveryOption = page
      .locator(".event-option-button")
      .filter({ hasText: /Find a sheltered spot and rest/i });
    await expect(recoveryOption).toBeVisible();
    await recoveryOption.click();

    // An outcome should show the recovery text
    const outcomeSection = page.locator("section[aria-label='Event outcome']");
    await expect(outcomeSection).toBeVisible({ timeout: 5000 });
    await expect(
      outcomeSection.getByText(/rest helps clear the fog/i),
    ).toBeVisible();

    // Dismiss the outcome
    const continueBtn = page.getByRole("button", { name: /^continue$/i });
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Assert fatigue decreased (was 75, recovery applies -20 → 55)
    const fatigueAfter = await page.evaluate(() => {
      const raw = sessionStorage.getItem("northbound-save");
      if (!raw) return -1;
      const envelope = JSON.parse(raw);
      return envelope.state.party.player.meters.fatigue as number;
    });
    expect(fatigueAfter).toBe(55);

    // Assert the run is still active (not ended)
    const runStatus = await page.evaluate(() => {
      const raw = sessionStorage.getItem("northbound-save");
      if (!raw) return "";
      const envelope = JSON.parse(raw);
      return envelope.state.runStatus as string;
    });
    expect(runStatus).toBe("active");

    // Game should still be playable — route buttons visible
    const routeBtn = page
      .locator("button")
      .filter({ hasText: /→.*Distance/i })
      .first();
    await expect(routeBtn).toBeVisible({ timeout: 5000 });
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
