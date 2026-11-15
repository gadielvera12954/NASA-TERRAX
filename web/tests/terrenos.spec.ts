import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";

// Real relief in "Earth and Moon" (Jean): Mons Mouton (LOLA) against Payunia P-27 (Copernicus GLO-30).
// It must work with no live engine: the meshes are static files.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
});

test("published relief meshes match the hashes in modelos.json", async ({ page }) => {
  const modelos = await (await page.request.get("/modelos/modelos.json")).json();
  for (const nombre of ["mons_mouton", "payunia"]) {
    const t = modelos.terrenos[nombre];
    expect(t.pixel_m).toBe(60);
    const r = await page.request.get(`/modelos/${t.archivo}`);
    expect(r.ok()).toBeTruthy();
    expect(createHash("sha256").update(await r.body()).digest("hex")).toBe(t.sha256);
  }
  expect(modelos.terrenos.payunia.candidata.id).toBe("P-27");
});

test("two worlds switches to the real relief, labels it and keeps the readouts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#worlds");
  await page.getByLabel(/^Sun elevation/).first().fill("5");
  await page.getByRole("button", { name: "Open illustrative 3D view" }).click();
  const relieve = page.getByRole("button", { name: "Real relief, 30 × 30 km" });
  await relieve.click();
  await expect(relieve).toHaveAttribute("aria-pressed", "true");
  const leyenda = page.getByText(/Real relief, 30 × 30 km each/);
  await expect(leyenda).toBeVisible({ timeout: 60000 });
  await expect(leyenda).toContainText("vertical ×1");
  await page.getByRole("button", { name: "Vertical ×4" }).click();
  await expect(leyenda).toContainText("vertical ×4");
  // The physics readouts do not depend on the drawing: still 0.5 / tan(5°).
  await expect(page.locator(".lecturas dd").first()).toHaveText("5.72 m");
  await page.getByRole("button", { name: "Close-up, flat ground" }).click();
  await expect(leyenda).toBeHidden();
  expect(errors).toEqual([]);
});
