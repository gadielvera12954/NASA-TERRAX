import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The lab must work with no live engine at all: these tests cut /api so the browser path runs.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
});

test("3D lab computes in the browser, close to the exported engine card, with lunation jumps and SI explain", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const card = await (await page.request.get("/data/destino/ficha_verano.json")).json();
  await page.goto("/#lab");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lunar terrain laboratory");
  await expect(page.getByText("Computed in your browser")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Rover lost")).toBeVisible({ timeout: 30000 });
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

  // E3: Next darkness and Lowest battery buttons jump the clock and distinguish geometric night, power shortfall and battery.
  await page.getByRole("button", { name: "Next darkness" }).click();
  await expect(page.getByTestId("reloj-distincion")).toContainText("Power shortfall");
  await page.getByRole("button", { name: "Lowest battery" }).click();
  await expect(page.locator(".lectura-reloj")).toContainText("battery 0 %");

  // E5: Explain with SI in the lab opens the SI with the point's figures.
  await page.getByRole("button", { name: /Explain with SI: analyze this point/ }).click();
  await expect(page.locator("#terrax-guia")).toHaveAttribute("data-open", "true");
  await expect(page.locator("#terrax-guia input[type='text']")).toHaveValue(/120.*380/, { timeout: 5000 });
  await page.keyboard.press("Escape");

  expect(errors).toEqual([]);
});

test("lab and comparator are accessible in Spanish and fit a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page.goto("/#lab");
  await expect(page.getByText("Rover perdido")).toBeVisible({ timeout: 30000 });
  let result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations, "lab").toEqual([]);
  await page.goto("/#compare");
  await expect(page.getByRole("heading", { name: "Comparar sitios", level: 1 })).toBeVisible();
  await expect(page.locator(".record-column .record-tags")).toHaveCount(2);
  await page.locator(".record-column select").nth(2).selectOption("CTRL-MEDANOS");
  await page.getByText("Compatibilidad, evidencia y detalles técnicos", { exact: true }).click();
  await expect(page.locator(".carril")).toHaveCount(3);
  await expect(page.getByText(/× Vegetación: NDVI/)).toBeVisible();
  result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations, "compare").toEqual([]);

  // E5: Explain with SI in the comparator opens the SI with the active comparison.
  await page.getByRole("button", { name: /Explicar con SI: explicar esta comparación/ }).click();
  await expect(page.locator("#terrax-guia")).toHaveAttribute("data-open", "true");
  await expect(page.locator("#terrax-guia input[type='text']")).toHaveValue(/CTRL-MEDANOS/, { timeout: 5000 });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ["lab", "compare", "guide"]) {
    await page.goto("/#" + route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
  }
});

test("two worlds: readouts follow the Sun, doubling h doubles the shadow, curtain drag/keys match the slider without interfering with SI, and Mars card is present", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#worlds");
  await page.getByLabel(/^Sun elevation/).first().fill("5");
  // 0.50 m board at 5°: 0.5 / tan(5°) = 5.72 m on the Moon, 5.54 m on Earth with refraction.
  await expect(page.locator(".lecturas dd").first()).toHaveText("5.72 m");
  await expect(page.locator(".lecturas dd").nth(1)).toHaveText("5.54 m");

  // E2: Doubling h (from 0.50 m to 1.00 m) doubles the shadow (5.715 * 2 = 11.43 m on the Moon, 5.533 * 2 = 11.07 m on Earth).
  const campoH = page.locator("#mundos-h");
  await campoH.fill("1");
  await expect(page.locator(".lecturas dd").first()).toHaveText("11.43 m");
  await expect(page.locator(".lecturas dd").nth(1)).toHaveText("11.07 m");
  await expect(page.getByTestId("formula-sombra")).toContainText("1.00 m ÷ tan(5.0°) = 11.43 m");
  await campoH.fill("0.50");
  await expect(page.locator(".lecturas dd").first()).toHaveText("5.72 m");

  // E4: Moon · Earth · Mars card with NASA Fact Sheet links and reference notice.
  const tarjeta = page.locator(".tarjeta-cuerpos");
  await expect(tarjeta).toContainText("Reference values, with no Martian terrain analysis in this version.");
  await expect(tarjeta.locator('a[href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/"]').first()).toBeVisible();
  await expect(tarjeta.locator('tr[data-fila="sombra"]')).toContainText("5.72 m");

  // E1 & E7: Open 3D view, check terrain selector, drag curtain with mouse and touch, and test keyboard shortcuts.
  await page.getByRole("button", { name: "Open illustrative 3D view" }).click();
  await expect(page.getByRole("button", { name: "Real relief, 30 × 30 km" })).toBeVisible();
  const escenario = page.locator(".comparison.mundos");
  const cortina = page.locator(".comparison.mundos .curtain");
  const rango = page.locator("#curtain");

  const box = await escenario.boundingBox();
  expect(box).not.toBeNull();
  const x70 = box!.x + box!.width * 0.7;
  const x30 = box!.x + box!.width * 0.3;
  const yMid = box!.y + box!.height * 0.5;

  // Mouse drag to 70 % matches the slider set to 70 %.
  await cortina.dispatchEvent("pointerdown", { button: 0, pointerId: 1, pointerType: "mouse", clientX: box!.x + box!.width * 0.5, clientY: yMid });
  await cortina.dispatchEvent("pointermove", { pointerId: 1, pointerType: "mouse", clientX: x70, clientY: yMid });
  await cortina.dispatchEvent("pointerup", { pointerId: 1, pointerType: "mouse", clientX: x70, clientY: yMid });
  const trasMouse = await rango.inputValue();
  expect(Number(trasMouse)).toBe(70);
  await rango.fill("70");
  await expect(page.locator(".moon-layer")).toHaveAttribute("style", /30%/);

  // Touch drag to 30 % matches the slider set to 30 %.
  await cortina.dispatchEvent("pointerdown", { button: 0, pointerId: 2, pointerType: "touch", clientX: x70, clientY: yMid });
  await cortina.dispatchEvent("pointermove", { pointerId: 2, pointerType: "touch", clientX: x30, clientY: yMid });
  await cortina.dispatchEvent("pointerup", { pointerId: 2, pointerType: "touch", clientX: x30, clientY: yMid });
  const trasTouch = await rango.inputValue();
  expect(Number(trasTouch)).toBe(30);
  await rango.fill("30");
  await expect(page.locator(".moon-layer")).toHaveAttribute("style", /70%/);

  // Keyboard shortcuts when Two Worlds is focused: L -> 95, T -> 5, ArrowRight -> 6.
  await escenario.focus();
  await page.keyboard.press("L");
  await expect(rango).toHaveValue("95");
  await page.keyboard.press("T");
  await expect(rango).toHaveValue("5");
  await page.keyboard.press("ArrowRight");
  await expect(rango).toHaveValue("6");

  // Keys must never interfere while typing in the SI assistant.
  await page.getByRole("button", { name: "Explain with SI" }).click();
  const campoSI = page.locator("#terrax-guia input[type='text']");
  await expect(campoSI).toHaveValue(/5\.72 m/, { timeout: 5000 });
  await campoSI.focus();
  await page.keyboard.type("LT");
  await expect(rango).toHaveValue("6");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Gravity", exact: true }).click();
  await page.getByRole("button", { name: "Drop the ball in both worlds" }).click();
  await expect(page.locator(".lecturas section").locator("dd").first()).toHaveText("1.76 s");
  await expect(page.locator(".lecturas section").locator("dd").nth(1)).toHaveText("0.71 s");
});

test("field kit without the engine applies only the geometry", async ({ page }) => {
  await page.goto("/#guide");
  await page.getByLabel("Sun elevation from your printed sheet (°)").fill("10");
  await page.getByLabel("Measured shadow (m)").fill("2.9");
  // 0.5 / tan(10°) = 2.836 m → 2.3 % difference, inside the 5 % goal.
  await expect(page.locator(".campo-resultado")).toContainText("2.84 m");
  await expect(page.locator(".campo-resultado")).toContainText("within the 5 % goal");

  // E6: 90s tour in specialist workspace respects reduced motion, advances by keyboard and has an SI step.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/team.html");
  await page.getByRole("button", { name: /90s Tour/ }).click();
  const dialog = page.getByRole("dialog", { name: "TERRA-X 90-second jury tour" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Play" })).toBeVisible();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(dialog).toContainText("Step 6 of 7 · Super Intelligence (SI)");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
