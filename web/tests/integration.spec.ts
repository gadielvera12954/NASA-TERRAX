import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("the original main scientific workspace remains reachable", async ({
  page,
}) => {
  await page.goto("/team.html");
  await page.getByRole("button", { name: "Destination", exact: true }).click();
  await expect(
    page.locator('img[src="/data/destino/vista_refugios_verano.png"]'),
  ).toBeVisible();
});

test("main index: every candidate opens its own exported values and original JSON", async ({
  page,
}) => {
  // Each of the forty parcels and five controls is opened, downloaded and reloaded.
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const index = await (
    await page.request.get("/data/fichas/indice.json")
  ).json();
  await page.goto("/#explore");
  for (const candidate of index.candidatas) {
    await page.getByRole("searchbox").fill(candidate.id);
    await page.locator(`a[href*="candidate=${candidate.id}#card"]`).click();
    const raw = await (await page.request.get("/data/fichas/" + candidate.id + ".json", { maxRetries: 2 })).json();
    await expect(page.locator(".record-meta")).toContainText(raw.id);
    await expect(page.locator(".metrics strong").nth(0)).toHaveText(
      raw.C === null
        ? "Unknown"
        : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(
            raw.C,
          ),
    );
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download source card (JSON)" })
      .click();
    const path = await (await pending).path();
    expect(JSON.parse(readFileSync(path!, "utf8"))).toEqual(raw);
    await page.reload();
    await expect(page.locator(".record-meta")).toContainText(raw.id);
    await page
      .getByRole("link", { name: "← Back to candidates", exact: true })
      .click();
  }
  expect(errors).toEqual([]);
});

test("upstream report stays bilingual and exports retain their recorded hashes", async ({
  page,
}) => {
  await page.goto("/#checks");
  const report = await (await page.request.get("/data/pruebas.json")).json();
  await expect(
    page.getByText(
      `${report.resumen.total} tests · ${report.resumen.pasa} passed · ${report.resumen.falla} failed · ${report.resumen.pendiente} pending`,
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByText("See all test results", { exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: report.pruebas[0].nombre_en,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: report.pruebas[0].nombre_es,
      exact: true,
    }),
  ).toBeVisible();
  const manifest = await (await page.request.get("/data/manifest.json")).json();
  for (const item of manifest.archivos) {
    const response = await page.request.get("/data/" + item.archivo);
    expect(response.ok(), item.archivo).toBe(true);
    expect(
      createHash("sha256")
        .update(await response.body())
        .digest("hex"),
      item.archivo,
    ).toBe(item.sha256);
  }
});
