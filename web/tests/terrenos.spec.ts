import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";

// Real relief in "Earth and Moon" (Jean): Mons Mouton (LOLA), Payunia P-27 (Copernicus GLO-30) and
// Jezero on Mars (USGS HRSC + MOLA). It must work with no live engine: the meshes are static files.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
});

test("published relief meshes match the hashes in modelos.json", async ({ page }) => {
  const modelos = await (await page.request.get("/modelos/modelos.json")).json();
  for (const nombre of ["mons_mouton", "payunia", "marte_jezero"]) {
    const t = modelos.terrenos[nombre];
    expect(t.pixel_m).toBe(nombre === "marte_jezero" ? 200 : 60);
    const r = await page.request.get(`/modelos/${t.archivo}`);
    expect(r.ok()).toBeTruthy();
    expect(createHash("sha256").update(await r.body()).digest("hex")).toBe(t.sha256);
  }
  expect(modelos.terrenos.payunia.candidata.id).toBe("P-27");
  expect(modelos.terrenos.payunia.parcelas.length).toBeGreaterThan(1);
});

test("two worlds opens on the real relief with every option visible, and compares Mars too", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#worlds");
  await page.getByLabel(/^Sun elevation/).first().fill("5");
  // Nothing to open first: pairs, ground and exaggeration are on screen.
  for (const nombre of ["Moon | Earth", "Mars | Earth", "Moon | Mars", "Close-up, flat ground", "Real relief, 30 × 30 km", "Vertical ×4"]) {
    await expect(page.getByRole("button", { name: nombre })).toBeVisible();
  }
  const leyenda = page.getByText(/Real relief, 30 × 30 km each/);
  await expect(leyenda).toBeVisible({ timeout: 60000 });
  await expect(leyenda).toContainText("vertical ×1");
  await page.getByRole("button", { name: "Vertical ×4" }).click();
  await expect(leyenda).toContainText("vertical ×4");
  // The physics readouts do not depend on the drawing: still 0.5 / tan(5°).
  await expect(page.locator(".lecturas dd").first()).toHaveText("5.72 m");

  await page.getByRole("button", { name: "Mars | Earth" }).click();
  await expect(page.getByText(/Real relief, 30 × 30 km each/)).toContainText("Jezero", { timeout: 60000 });
  await expect(page.getByRole("button", { name: "Close-up, flat ground" })).toBeDisabled();
  await expect(page.locator(".world-label.moon-label")).toHaveText("Mars");

  // Moon, Earth and Mars side by side, from the NASA fact sheets.
  const tabla = page.locator(".ficha-mundos table");
  await expect(tabla).toContainText("3.71 m/s²");
  await expect(tabla).toContainText("1.62 m/s²");

  await page.getByRole("button", { name: "Moon | Earth" }).click();
  await page.getByRole("button", { name: "Close-up, flat ground" }).click();
  await expect(page.getByText(/Real relief, 30 × 30 km each/)).toBeHidden();
  expect(errors).toEqual([]);
});
