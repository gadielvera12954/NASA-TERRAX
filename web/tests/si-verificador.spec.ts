import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { verificarCifrasMotorSI, verificarRespuestaSI } from "../src/si/verificadorSI";
import type { EscenarioMotorSI } from "../src/datos/siMotor";

const fuente = JSON.parse(readFileSync(new URL("../public/data/destino/ficha_verano.json", import.meta.url), "utf8"));
const escenario = fuente as EscenarioMotorSI;

test("a genuine value from another engine field is not proof for the claim", () => {
  const r = verificarCifrasMotorSI(escenario, [{ campo: "potencia_media_w", valor: fuente.resultado.noche_geometrica_h.toFixed(2), unidad: "W" }]);
  expect(r.valido).toBe(false);
  expect(r.cifrasMotorVerificadas).toBe(0);
});

test("the unit and sign must match the same scientific field", () => {
  const valor = fuente.resultado.potencia_media_w.toFixed(2);
  expect(verificarCifrasMotorSI(escenario, [{ campo: "potencia_media_w", valor, unidad: "Wh" }]).valido).toBe(false);
  expect(verificarCifrasMotorSI(escenario, [{ campo: "potencia_media_w", valor: `-${valor}`, unidad: "W" }]).valido).toBe(false);
  expect(verificarCifrasMotorSI(escenario, [{ campo: "potencia_media_w", valor, unidad: "W" }]).cifrasMotorVerificadas).toBe(1);
});

test("an empty set cannot earn verification and nearby numbers cannot borrow a constant", () => {
  expect(verificarCifrasMotorSI(escenario, []).valido).toBe(false);
  // Previously 183 passed because it was within two percent of the constant 180.
  expect(verificarRespuestaSI("Power: 183 W", { pagina: "home", elevacionSolDeg: 5 }).valido).toBe(false);
});
