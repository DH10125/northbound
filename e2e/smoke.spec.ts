import { test, expect } from "@playwright/test";

test("home page loads with game title", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /northbound/i, level: 1 }),
  ).toBeVisible();
});

test("home page has product principles section", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: /product principles/i }),
  ).toBeVisible();
});

test("skip-nav link is in the DOM and points to #main-content", async ({
  page,
}) => {
  await page.goto("/");
  const skipLink = page.locator("a.skip-nav");
  await expect(skipLink).toHaveAttribute("href", "#main-content");
});

test("main landmark has id=main-content for skip-nav target", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#main-content")).toBeAttached();
  await expect(page.locator("main#main-content")).toBeAttached();
});

test("live region is present in the DOM", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-testid='live-region']")).toBeAttached();
});

test("status system preview section is visible", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: /status system preview/i }),
  ).toBeVisible();
});

test("page is usable at 320px viewport width", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /northbound/i, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /product principles/i }),
  ).toBeVisible();
});

test("page is usable at 1280px desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /northbound/i, level: 1 }),
  ).toBeVisible();
});

test("html element has lang attribute", async ({ page }) => {
  await page.goto("/");
  const lang = await page.locator("html").getAttribute("lang");
  expect(lang).toBe("en");
});
