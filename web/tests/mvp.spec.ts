import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const legacyManifest = JSON.parse(
  readFileSync(
    new URL("./fixtures/legacy-manifest.json", import.meta.url),
    "utf8",
  ),
);
const legacyCard = JSON.parse(
  readFileSync(new URL("./fixtures/legacy-P-07.json", import.meta.url), "utf8"),
);

// Preserve Nahum's original workflows against the original, explicitly mock contract.
test.beforeEach(async ({ page }) => {
  await page.route("**/data/manifest.json", (route) =>
    route.fulfill({ json: legacyManifest }),
  );
  await page.route("**/data/fichas/P-07.json", (route) =>
    route.fulfill({ json: legacyCard }),
  );
  await page.route("**/data/fichas/indice.json", (route) =>
    route.fulfill({ status: 404 }),
  );
});

test("Spanish desktop screens have no automated WCAG A/AA violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  for (const route of [
    "home",
    "explore",
    "card",
    "compare",
    "checks",
    "guide",
  ]) {
    await page.goto("/#" + route);
    await expect(
      page.getByText("DATOS DE MAQUETA · Demostración"),
    ).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations, route).toEqual([]);
    if (route === "home" || route === "card")
      await page.screenshot({
        path: `test-results/desktop-${route}-es.png`,
        fullPage: true,
      });
  }
});

test("bilingual candidate flow, search, sources and language persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Practice on Earth. Prepare for the Moon.",
  );
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page
    .getByRole("button", { name: "Explorar una candidata →", exact: true })
    .click();
  await page.getByRole("searchbox").fill("unknown place");
  await expect(
    page.getByText("No hay candidatas que coincidan."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
  await page.getByLabel("Objetivo del ensayo").selectOption("materials");
  await expect(
    page.getByText("Los materiales figuran como no comparables.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir ficha de la candidata →" })
    .click();
  await expect(
    page.getByRole("heading", { name: "¿Qué tan bien encaja?" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Composición del material superficial y luego distribución de las rocas.",
    ),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar ficha fuente (JSON)" })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe("P-07.json");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "¿Qué tan bien encaja?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "How well does it fit?" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Verification", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scientific tests", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile layout, keyboard focus, comparison and reduced-motion tour", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page
    .getByRole("button", { name: "Optional: take the 90-second tour" })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Two worlds. Different limits." }),
  ).toBeVisible();
  await page.getByLabel("Comparison divider").fill("75");
  await expect(page.locator(".moon-layer")).toHaveAttribute("style", /25%/);
  await page.getByRole("button", { name: "Exit tour", exact: true }).click();
  for (const route of [
    "home",
    "explore",
    "card",
    "compare",
    "checks",
    "guide",
  ]) {
    await page.goto("/#" + route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/mobile-guide.png",
    fullPage: true,
  });
});

test("tour completes six stages in 90 seconds and stops on manual navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByRole("button", { name: "Optional: take the 90-second tour" })
    .click();
  for (const route of ["explore", "card", "compare", "checks", "guide"]) {
    await page.clock.runFor(15000);
    await expect(page).toHaveURL(new RegExp("#" + route + "$"));
  }
  await page.clock.runFor(15000);
  await expect(
    page.getByRole("complementary", { name: "Guided tour" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByRole("button", { name: "Optional: take the 90-second tour" })
    .click();
  await page.getByRole("link", { name: "Guide", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Exit tour", exact: true }),
  ).toHaveCount(0);
});

test("production offline copy reloads with candidate and persisted language", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Saved for offline use", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await context.setOffline(true);
  await page.goto("/#card");
  await expect(
    page.getByRole("heading", { name: "¿Qué tan bien encaja?" }),
  ).toBeVisible();
  await expect(page.getByText("DATOS DE MAQUETA · Demostración")).toBeVisible();
  await page.getByRole("link", { name: "Guía", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué es un análogo?" }),
  ).toBeVisible();
});

test("invalid or unavailable files show a recoverable error, never false results", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/data/fichas/P-07.json", (route) =>
    fail ? route.fulfill({ json: { id: "P-07", C: 99 } }) : route.continue(),
  );
  await page.goto("/#card");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How well does it fit?" }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "How well does it fit?" }),
  ).toBeVisible();
});
