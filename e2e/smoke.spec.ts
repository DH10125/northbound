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
