import type { ResultadoMotorSI } from "../datos/siMotor";
import type { RespuestaChatSI } from "./geminiClient";
import { CifraMotorSI, METRICAS_MOTOR_SI, MetricaMotorSI, verificarCifrasMotorSI } from "./verificadorSI";

/** Explanations use only returned engine metrics. No model performs calculations. */
export function explicarMotorSI(resultados: ResultadoMotorSI[], idioma: "en" | "es"): RespuestaChatSI {
  const es = idioma === "es";
  const verificaciones = resultados.flatMap(r => {
    if (!r.escenario) return [];
    const cifras: CifraMotorSI[] = (Object.keys(METRICAS_MOTOR_SI) as MetricaMotorSI[]).map(campo => ({
      campo, valor: r.escenario.resultado[campo].toFixed(2), unidad: METRICAS_MOTOR_SI[campo].unidad,
    }));
    return [{ cifras, verificacion: verificarCifrasMotorSI(r.escenario, cifras) }];
  });
  let n = 0;
  const textos = resultados.map((r, i) => {
    const nombre = `${es ? "Escenario" : "Scenario"} ${String.fromCharCode(65 + i)}`;
    if (!r.escenario) return `${nombre}: ${es ? "el motor no pudo entregar un resultado verificable." : "the engine could not supply a verifiable result."}`;
    const { cifras, verificacion } = verificaciones[n++];
    if (!verificacion.valido) return `${nombre}: ${es ? "se ocultó un resultado sin verificar." : "an unverified result was hidden."}`;
    const { condiciones, en_riesgo } = r.escenario.resultado;
    return [
      nombre,
      ...cifras.map(c => `- ${METRICAS_MOTOR_SI[c.campo][es ? "es" : "en"]}: ${es ? c.valor.replace(".", ",") : c.valor} ${c.unidad}.`),
      es ? "La noche geométrica, la oscuridad por el relieve y la energía de batería son métricas distintas."
        : "Geometric night, terrain darkness and battery energy are different metrics.",
      es ? (en_riesgo ? "El motor indica riesgo en este escenario." : "El motor no indica riesgo bajo estos parámetros.")
        : (en_riesgo ? "The engine flags risk in this scenario." : "The engine flags no risk under these parameters."),
      `${es ? "Condiciones del motor" : "Engine conditions"}: ${[
        [es ? "oscuridad" : "darkness", condiciones.oscuridad],
        [es ? "batería" : "battery", condiciones.bateria],
        [es ? "pendiente" : "slope", condiciones.pendiente],
      ].map(([label, incumple]) => `${label}: ${incumple ? (es ? "no cumple" : "fails") : (es ? "cumple" : "passes")}`).join("; ")}.`,
    ].join("\n");
  });
  const validas = verificaciones.filter(v => v.verificacion.valido);
  const cifras = validas.flatMap(v => v.verificacion.numerosExtraidos);
  return {
    texto: textos.join("\n\n"), origen: "motor", modeloUsado: "TERRA-X engine", latenciaMs: 0,
    acciones: [], resultadosMotor: resultados,
    verificacion: {
      valido: validas.length > 0 && validas.length === verificaciones.length,
      numerosExtraidos: cifras, numerosNoVerificados: [], fraseProhibida: null,
      cifrasMotorVerificadas: cifras.length,
      resumenVerificacion: "Verified against the returned engine fields and units",
    },
  };
}
