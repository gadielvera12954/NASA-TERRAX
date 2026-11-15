import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync } from "node:fs";

const referencia = (lunacion = "verano") => JSON.parse(readFileSync(new URL(`../public/data/destino/ficha_${lunacion}.json`, import.meta.url), "utf8"));
const pedido = { fila: 249, col: 249, lunacion: "verano", consumo_w: 60, panel_w: 320, bateria_wh: 5420 };
// Adapt the published scientific export to the existing live endpoint envelope.
// Route fixtures use Jean's J4 envelope; real-engine checks run separately.
function escenario(lunacion = "verano") {
  const f = referencia(lunacion);
  return { ...f, origen: "motor-en-vivo", periodo: { lunacion, desde: f.lunacion.desde, hasta: f.lunacion.hasta },
    vehiculo: { ...f.vehiculo, consumo_w: f.vehiculo.consumo_w.valor },
    scenario_id: (lunacion === "verano" ? "a" : "b").repeat(64) };
}
const lote = (escenarios: ({ scenario_id: string } | { error: string })[]) => ({ origen: "motor-en-vivo", escenarios: escenarios.map((v, i) => ({
  id: String.fromCharCode(65 + i), ...("error" in v ? { ok: false, error: v.error } : { ok: true, scenario_id: v.scenario_id, escenario: v }),
})) });
async function inicio(page: Page) {
  await page.goto("/");
  await expect(page.locator(".site-list").first().getByRole("link").first()).toBeVisible();
}
async function abrir(page: Page, contexto: Record<string, unknown>, pregunta = "Explain these results") {
  await page.evaluate(({ contexto, pregunta }) => window.dispatchEvent(new CustomEvent("terrax:si", { detail: { pregunta, contexto } })), { contexto, pregunta });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue(pregunta);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", r => r.abort());
  await page.route("**/api/si/estado", r => r.fulfill({ json: { disponible: false } }));
});

for (const idioma of ["en", "es"] as const) {
  test(`SI button, shortcuts, focus and accessible mobile panel (${idioma})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await inicio(page);
    if (idioma === "es") await page.getByRole("button", { name: "Español", exact: true }).click();
    const trigger = page.getByRole("button", { name: idioma === "es" ? "Preguntale a la SI" : "Ask the SI", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: idioma === "es" ? "Asistente SI de TERRA-X" : "TERRA-X SI assistant" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox")).toBeFocused();
    await expect(dialog.getByRole("status")).toHaveText(idioma === "es" ? "SI con datos locales" : "SI using local data");
    await expect(dialog).toContainText(idioma === "es" ? "ranking publicado" : "published ranking");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include(".si-raiz").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    mkdirSync("../output/playwright/si", { recursive: true });
    await page.screenshot({ path: `../output/playwright/si/mobile-${idioma}.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeHidden();
  });
}

test("home entry points reuse the atlas controls and prefill without sending", async ({ page }) => {
  let chats = 0;
  page.on("request", r => { if (r.url().endsWith("/api/si/chat")) chats++; });
  await inicio(page);
  await page.getByRole("button", { name: "Ask the SI about a site", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue("How can the SI help me choose a rehearsal site?");
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "SI assistant Explains results with engine data" }).click();
  await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue("How does the SI explain results with engine data?");
  expect(chats).toBe(0);
  expect(new URL(page.url()).hash).toBe("");
});

test("record explanation uses the active candidate and contextual suggestions", async ({ page }) => {
  await inicio(page);
  await page.locator(".site-list").first().getByRole("link").first().click();
  await page.getByRole("button", { name: "Explain with SI", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toHaveValue(/What supports the result for P-\d+, and what evidence is missing\?/);
  await expect(dialog.getByRole("button", { name: "What should the field team measure first?", exact: true })).toBeVisible();
  await expect(dialog).not.toContainText("How do you know the ranking is not rigged?");
});

test("external opening supplies engine context and performs one real point request", async ({ page }) => {
  const cuerpos: unknown[] = [];
  await page.route("**/api/destino/punto", async r => {
    cuerpos.push(r.request().postDataJSON());
    await r.fulfill({ json: escenario() });
  });
  await inicio(page);
  await abrir(page, { pagina: "lab", pedido });
  expect(cuerpos).toEqual([]);
  await page.getByRole("button", { name: "Analyze this point", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("4 figures verified against TERRA-X engine data");
  await expect(dialog.locator(".si-contexto").last()).toHaveText("Point parameters loaded · Engine inputs");
  await expect(dialog).toContainText(`Geometric night: ${referencia().resultado.noche_geometrica_h.toFixed(2)} h`);
  await expect(dialog).toContainText("darkness: fails; battery: fails; slope: passes");
  expect(cuerpos).toEqual([pedido]);
  await dialog.getByText("Engine provenance", { exact: true }).click();
  await expect(dialog).toContainText(referencia().meta.parametros_sha256);
});

test("batch adapter makes one request and retains valid results on partial failure", async ({ page }) => {
  let puntos = 0;
  let lotes = 0;
  await page.route("**/api/destino/punto", r => { puntos++; return r.abort(); });
  await page.route("**/api/destino/comparar", async r => {
    lotes++;
    expect(r.request().postDataJSON()).toEqual({ escenarios: [pedido, { ...pedido, lunacion: "invierno" }], series: false });
    await r.fulfill({ json: lote([escenario(), { error: "scenario failed" }]) });
  });
  await inicio(page);
  await abrir(page, { pagina: "lab", pedidos: [pedido, { ...pedido, lunacion: "invierno" }] });
  await page.getByRole("button", { name: "Compare scenarios with the engine", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("4 figures verified against TERRA-X engine data");
  await expect(page.getByRole("dialog")).toContainText("Scenario B: the engine could not supply a verifiable result.");
  expect(lotes).toBe(1); expect(puntos).toBe(0);
});

test("batch readout binds metrics to both returned scenarios", async ({ page }) => {
  await page.route("**/api/destino/comparar", r => r.fulfill({ json: lote([escenario(), escenario("invierno")]) }));
  await inicio(page);
  await abrir(page, { pedidos: [pedido, { ...pedido, lunacion: "invierno" }] });
  await page.getByRole("button", { name: "Compare scenarios with the engine", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("8 figures verified against TERRA-X engine data");
  await expect(page.getByRole("dialog")).toContainText(`Geometric night: ${referencia("invierno").resultado.noche_geometrica_h.toFixed(2)} h`);
});

test("Erwan's laboratory payload supplies inputs but never verified output", async ({ page }) => {
  const r = escenario();
  await page.route("**/api/destino/punto", route => route.fulfill({ json: r }));
  await inicio(page);
  await abrir(page, { pantalla: "lab", punto: r.punto, periodo: r.periodo, vehiculo: r.vehiculo,
    resultado: { potencia_media_w: 987654321 } });
  await expect(page.getByRole("dialog")).toContainText("How are geometric night, darkness and battery risk different?");
  await page.getByRole("button", { name: "Analyze this point", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("4 figures verified against TERRA-X engine data");
  await expect(page.getByRole("dialog")).not.toContainText("987654321");
});

test("the lab SI can compare both published lunations with unchanged vehicle parameters", async ({ page }) => {
  let cuerpo: unknown;
  await page.route("**/api/destino/comparar", async r => {
    cuerpo = r.request().postDataJSON();
    await r.fulfill({ json: lote([escenario(), escenario("invierno")]) });
  });
  await inicio(page);
  await abrir(page, { pedido });
  await page.getByRole("button", { name: "Compare summer and winter at this point", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("8 figures verified against TERRA-X engine data");
  expect(cuerpo).toEqual({ escenarios: [pedido, { ...pedido, lunacion: "invierno" }], series: false });
});

test("Erwan's record comparison reloads published cards instead of trusting caller scores", async ({ page }) => {
  await inicio(page);
  await abrir(page, { pantalla: "compare", sitios: [{ id: "P-27", C: 987654321 }, { id: "P-05", C: 987654321 }] });
  await expect(page.getByRole("dialog")).toContainText("published records of the compared sites");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const respuesta = page.getByRole("dialog").locator(".si-turno.guia");
  await expect(respuesta).toContainText("P-27");
  await expect(respuesta).toContainText("P-05");
  await expect(respuesta).not.toContainText("987654321");
  await expect(respuesta).not.toContainText("figures verified against TERRA-X engine data");
});

test("unavailable comparison reports the dependency and invents no result", async ({ page }) => {
  await page.route("**/api/destino/comparar", r => r.fulfill({ status: 404, json: { error: "missing" } }));
  await inicio(page);
  await abrir(page, { pedidos: [pedido, pedido] });
  await page.getByRole("button", { name: "Compare scenarios with the engine", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Engine comparison is not available on this server yet.");
  await expect(page.getByRole("dialog")).not.toContainText("figures verified");
});

test("a candidate identifier is never converted to a grid request", async ({ page }) => {
  let peticiones = 0;
  await page.route("**/api/destino/punto", r => { peticiones++; return r.abort(); });
  await inicio(page);
  await abrir(page, { pedido: { candidataId: "P-27", lunacion: "verano" } });
  await page.getByRole("button", { name: "Analyze this point", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("has not supplied valid point and period parameters");
  expect(peticiones).toBe(0);
});

test("engine connection failures show no fabricated calculation", async ({ page }) => {
  await inicio(page);
  await abrir(page, { pedido });
  await page.getByRole("button", { name: "Analyze this point", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("did not return a verifiable result");
  await expect(page.getByRole("dialog")).not.toContainText("figures verified");
});

test("an entirely failed batch cannot earn a calculation or verification label", async ({ page }) => {
  await page.route("**/api/destino/comparar", r => r.fulfill({ json: lote([{ error: "A" }, { error: "B" }]) }));
  await inicio(page);
  await abrir(page, { pedidos: [pedido, pedido] });
  await page.getByRole("button", { name: "Compare scenarios with the engine", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("No verified engine result");
  await expect(page.getByRole("dialog")).not.toContainText("figures verified");
  await expect(page.getByRole("dialog")).not.toContainText("Calculated by the TERRA-X engine");
});

for (const fallo of ["point", "provenance", "vehicle", "metric"]) {
  test(`rejects unverifiable engine response: ${fallo}`, async ({ page }) => {
    const r = escenario();
    if (fallo === "point") r.punto.fila++;
    if (fallo === "provenance") r.meta.parametros_sha256 = "unknown";
    if (fallo === "vehicle") r.vehiculo.consumo_w++;
    if (fallo === "metric") r.resultado.potencia_media_w = null;
    await page.route("**/api/destino/punto", route => route.fulfill({ json: r }));
    await inicio(page);
    await abrir(page, { pedido });
    await page.getByRole("button", { name: "Analyze this point", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("did not return a verifiable result");
    await expect(page.getByRole("dialog")).not.toContainText("figures verified");
  });
}

test("SI status follows the relay and rejected figures never reach the chat", async ({ page }) => {
  let llamadas = 0;
  await page.route("**/api/si/estado", r => r.fulfill({ json: { disponible: true } }));
  await page.route("**/api/si/chat", async r => {
    llamadas++;
    expect(r.request().headers()["x-terrax"]).toBe("1");
    await r.fulfill({ json: { texto: "The battery is 987654321 Wh." } });
  });
  await inicio(page);
  await page.locator(".si-trigger").click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("SI connected");
  await page.getByRole("textbox", { name: "Your question" }).fill("Explain this result");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Answer built from the card only");
  await expect(page.getByRole("dialog")).not.toContainText("987654321");
  expect(llamadas).toBe(2);
});

test("engine follow-up receives verified data but cannot relabel its numbers", async ({ page }) => {
  await page.route("**/api/destino/punto", r => r.fulfill({ json: escenario() }));
  let llamadas = 0;
  await page.route("**/api/si/chat", async r => {
    llamadas++;
    const system = r.request().postDataJSON().systemInstruction.parts[0].text;
    expect(system).toContain("VERIFIED ENGINE RESULTS");
    expect(system).toContain(referencia().meta.parametros_sha256);
    // A real darkness value attributed to the wrong quantity must still be blocked.
    await r.fulfill({ json: { texto: `Mean power is ${referencia().resultado.noche_geometrica_h} W.` } });
  });
  await inicio(page);
  await abrir(page, { pedido });
  await page.getByRole("button", { name: "Analyze this point", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("4 figures verified");
  await page.getByRole("textbox", { name: "Your question" }).fill("Why is the rover at risk?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("dialog").locator(".si-turno.guia")).toHaveCount(2);
  await expect(page.getByRole("dialog")).not.toContainText(`Mean power is ${referencia().resultado.noche_geometrica_h} W`);
  expect(llamadas).toBe(2);
});

test("late engine responses cannot enter a newly opened context", async ({ page }) => {
  let entregar: (() => Promise<void>) | undefined;
  await page.route("**/api/destino/punto", async r => {
    await new Promise<void>(resolve => { entregar = async () => { await r.fulfill({ json: escenario() }); resolve(); }; });
  });
  await inicio(page);
  await abrir(page, { pedido });
  await page.getByRole("button", { name: "Analyze this point", exact: true }).click();
  await expect.poll(() => !!entregar).toBe(true);
  await abrir(page, { pagina: "home" }, "A new context");
  await entregar!();
  await expect(page.getByRole("dialog").locator(".si-turno.guia")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue("A new context");
});
