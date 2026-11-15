/**
 * Bridge between Erwan's interactive screens and Nahum's SI Assistant.
 * Contract N1: uses abrirSI(pregunta, patchContexto) from web/src/si/abrirSI.ts.
 */
import { abrirSI } from "../si/abrirSI";

export function explicarConSI(
  pregunta: string,
  patchContexto?: Record<string, unknown>,
): void {
  abrirSI(pregunta, patchContexto);
}
