import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The lab must work with no live engine at all: these tests cut /api so the browser path runs.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
});

test("3D lab computes in the browser, close to the exported engine card", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const card = await (await page.request.get("/data/destino/ficha_verano.json")).json();
  await page.goto("/#lab");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Park the rover. Survive the night.");
  await expect(page.getByText("Computed in your browser")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("× Rover lost")).toBeVisible({ timeout: 30000 });
  // Same point and lunation as the exported card (360 azimuths there, 72 here): within 5 %.
  const text = await page.locator(".condiciones strong").first().innerText();
  const hours = Number(text.replace(/[^\d.]/g, ""));
  const reference = card.resultado.tramo_oscuro_mas_largo_h;
  expect(Math.abs(hours - reference) / reference).toBeLessThan(0.05);
  // Custom dates need the engine and say so.
  await expect(page.getByRole("button", { name: /Any dates/ })).toBeDisabled();

  // Park somewhere else with the keyboard-accessible fields: a second attempt is listed.
  await page.getByLabel("Row (north → south)").fill("120");
  await page.getByLabel("Column (west → east)").fill("380");
  await expect(page.locator(".intentos tbody tr").first()).toContainText("120, 380", { timeout: 30000 });
  await page.getByRole("button", { name: "Winter lunation 2027" }).click();
  await expect(page.locator(".intentos tbody tr").first()).toContainText("Winter lunation 2027", { timeout: 30000 });
  // The time slider moves the clock readout.
  const before = await page.locator(".lectura-reloj").innerText();
  await page.locator("#lab-reloj").fill("700");
  await expect(page.locator(".lectura-reloj")).not.toHaveText(before);
  expect(errors).toEqual([]);
});

test("lab and comparator are accessible in Spanish and fit a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page.goto("/#lab");
  await expect(page.getByText("× Rover perdido")).toBeVisible({ timeout: 30000 });
  let result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations, "lab").toEqual([]);
  await page.goto("/#compare");
  await expect(page.getByRole("heading", { name: "Compara candidatas lado a lado" })).toBeVisible();
  await expect(page.locator(".carril")).toHaveCount(2);
  await page.getByRole("button", { name: "CTRL-MEDANOS" }).click();
  await expect(page.locator(".carril")).toHaveCount(3);
  await expect(page.getByText(/× Vegetación: NDVI/)).toBeVisible();
  result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations, "compare").toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ["lab", "compare", "guide"]) {
    await page.goto("/#" + route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
  }
});

test("two worlds: readouts follow the Sun and the drop test reports both fall times", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#compare");
  await page.getByLabel(/^Sun elevation/).first().fill("5");
  // 0.50 m board at 5°: 0.5 / tan(5°) = 5.72 m on the Moon.
  await expect(page.locator(".lecturas dd").first()).toHaveText("5.72 m");
  await page.getByRole("button", { name: "Drop the ball in both worlds" }).click();
  await expect(page.locator(".lecturas section").nth(2).locator("dd").first()).toHaveText("1.76 s");
  await expect(page.locator(".lecturas section").nth(2).locator("dd").nth(1)).toHaveText("0.71 s");
});

test("field kit without the engine applies only the geometry", async ({ page }) => {
  await page.goto("/#guide");
  await page.getByLabel("Sun elevation from your printed sheet (°)").fill("10");
  await page.getByLabel("Measured shadow (m)").fill("2.9");
  // 0.5 / tan(10°) = 2.836 m → 2.3 % difference, inside the 5 % goal.
  await expect(page.locator(".campo-resultado")).toContainText("2.84 m");
  await expect(page.locator(".campo-resultado")).toContainText("within the 5 % goal");
});
