/**
 * TERRA-X guide: Gemini 3.5 Flash grounded in the published data.
 *
 * The model never computes anything. It receives the real ranking (fichas/indice.json), the active
 * candidate card and the engine's published facts, answers in plain language, and every number it
 * writes is checked against those facts (verificadorSI). If a number cannot be verified the model
 * is asked once to rewrite without it; if that still fails, a short answer built only from the card
 * is shown and labelled as such.
 */
import { EntradaRanking } from "../datos/ranking";
import type { ResultadoMotorSI } from "../datos/siMotor";
import { explicarMotorSI } from "./motorSI";
import {
  AccionRapidaSI,
  ContextoSI,
  ResultadoVerificacionSI,
  extraerDetalleFuente,
  verificarRespuestaSI,
} from "./verificadorSI";

export const MODELO = "gemini-3.5-flash";
export const NOMBRE_MODELO = "Gemini 3.5 Flash";

export interface RespuestaChatSI {
  texto: string;
  origen: "gemini" | "local" | "motor";
  modeloUsado: string;
  latenciaMs: number;
  verificacion: ResultadoVerificacionSI;
  acciones: AccionRapidaSI[];
  aviso?: string;
  resultadosMotor?: ResultadoMotorSI[];
}

const NOMBRES: Record<string, [string, string]> = {
  analogo_sostenido: ["supported analog", "análogo respaldado"],
  sostenido: ["supported analog", "análogo respaldado"],
  con_huecos: ["with gaps", "con vacíos de información"],
  no_alcanza: ["insufficient", "insuficiente"],
  no_podemos_concluir: ["cannot conclude", "no se puede concluir"],
  no_puede: ["cannot conclude", "no se puede concluir"],
  incompatible: ["incompatible (fails a hard requirement)", "incompatible (incumple un requisito)"],
};
const nombreEtiqueta = (e: string, lang: "en" | "es") => (NOMBRES[e] ?? [e, e])[lang === "es" ? 1 : 0];

function lineaRanking(e: EntradaRanking, lang: "en" | "es"): string {
  const pos = e.orden === null ? "—" : `#${e.orden}`;
  const que = e.control ? (lang === "es" ? `control ${e.control}` : `${e.control === "positivo" || e.control === "positivo_ruido" ? "positive" : "negative"} control`) : "";
  const c = e.C === null ? "C=—" : `C=${e.C.toFixed(3)}`;
  return `${pos} ${e.id}${que ? ` (${que})` : ""}: ${c} E=${e.E.toFixed(2)} L=${e.L.toFixed(3)} U=${e.U.toFixed(3)} · ${nombreEtiqueta(e.etiqueta, lang)}`;
}

export function instruccionSistema(ctx: ContextoSI, lang: "en" | "es"): string {
  const f = ctx.ficha;
  const det = extraerDetalleFuente(f);
  const ranking = ctx.ranking ?? [];
  const altura = ctx.alturaObjetoM ?? 0.5;
  const sombra = ctx.elevacionSolDeg > 0 ? (altura / Math.tan((ctx.elevacionSolDeg * Math.PI) / 180)).toFixed(2) : null;
  const tarjeta = f
    ? JSON.stringify(
        {
          id: f.id,
          nombre: f.lugar.nombre,
          region: f.lugar.region,
          lat: f.lugar.lat,
          lon: f.lugar.lon,
          veredicto: nombreEtiqueta(f.etiqueta, lang),
          C: f.C,
          E: f.E,
          L: f.L,
          U: f.U,
          orden_en_el_ranking: det?.orden ?? null,
          requisitos: det?.requisitos ?? null,
          propiedades: det?.propiedades
            ? Object.fromEntries(
                Object.entries(det.propiedades as Record<string, Record<string, unknown> | undefined>).map(([k, p]) => [
                  k,
                  { estado: p?.estado, distancia: p?.distancia ?? null, utilidad: p?.utilidad ?? null, unidad: p?.unidad ?? null },
                ]),
              )
            : null,
          dimensiones: f.dimensiones,
          no_se_reproduce: f.no_transfiere,
          medir_primero: f.medir_primero,
          ventanas_de_ensayo_muestra: f.horario.slice(0, 3),
        },
        null,
        1,
      )
    : "none selected";
  const incompatibles = ranking.filter((e) => e.etiqueta === "incompatible").map((e) => e.id);
  return [
    "You are the TERRA-X guide, a calm expert who explains a NASA Space Apps 2026 project to visitors, jury members and scientists.",
    "TERRA-X finds places on Earth where a crew can rehearse work planned for the lunar south pole (a VIPER-class rover at Mons Mouton). It runs the same physics on the same 60 m grid for the Moon (NASA LOLA relief, JPL DE421 ephemerides) and for Earth (Copernicus DEM, Sentinel-2 vegetation).",
    "",
    "HOW TO ANSWER",
    `- Answer in ${lang === "es" ? "Spanish (rioplatense, natural, 'vos' is fine)" : "English"}, in plain language first; add the technical term in parentheses only when useful.`,
    "- Be short: two to five sentences, or up to four bullet points when listing. No headings. No preamble like 'Great question'.",
    "- Write 'SI' (Super Intelligence) when referring to this kind of assistant; never 'AI' or 'IA'.",
    "- Use ONLY numbers that appear in FACTS, RANKING or ACTIVE CARD below (you may round them). If a number is not there, say in words that the published data does not include it. Never estimate, never invent.",
    "- Compatibility C and evidence E are separate: never describe a candidate as 'X % similar to the Moon'. Never say an Earth site reproduces lunar gravity or vacuum, or certifies a lunar mission.",
    "- When the visitor asks what to do or where to look, you may end with one or two action tags on their own last line, exactly like these:",
    "  [ACTION:NAVIGATE:lab] [ACTION:NAVIGATE:compare] [ACTION:NAVIGATE:card] [ACTION:NAVIGATE:explore] [ACTION:NAVIGATE:checks] [ACTION:SELECT_CANDIDATE:P-27] [ACTION:SET_SUN:1.5]",
    "",
    "FACTS (published by the engine)",
    "- Destination: Mons Mouton, 84.6°S 31.0°E, lunar south pole. The Sun never rises above about 7° there (6.96° at most in the 2027 lunations). On a flat horizon the night lasts 289 to 418 h per lunation; in the central 30 x 30 km crop the shortest continuous night is 424 h in summer and 622 h in winter.",
    "- Rover template (public VIPER figures): 320 W of panels on three sides, 5420 Wh battery, survives 50 h of darkness, which implies a 108.4 W survival draw. Only relief (parking on a ridge) can shorten the night; the 3D lab lets the visitor try.",
    "- Grid: 60 m per pixel for both worlds, never interpolated to a finer resolution. Shadow of a vertical board = height / tan(Sun elevation). " + (sombra === null ? "There is no finite illuminated shadow at this elevation." : `With the chosen height ${altura} m at ${ctx.elevacionSolDeg}° the flat-plane geometric shadow is ${sombra} m.`),
    "- Earth candidates: 40 parcels of 3 x 3 km in Payunia (Mendoza, Argentina), with 30 km of relief around each. Hard requirements: vegetation NDVI p90 below 0.20 and median slope below 15°; a parcel that fails one is 'incompatible'.",
    "- Scores: C = compatibility of the terrain footprint (slope, roughness at 200 to 1600 m, grazing-light shadow fraction from 1.5° to 10°); E = how much evidence exists (0.8 means two properties, material and fine traversability, were never measured). Bounds L = C x E and U = L + (1 - E). Verdicts: supported analog (L above 0.70), with gaps, insufficient, cannot conclude, incompatible.",
    "- Controls: CTRL-MM is Mons Mouton itself and must rank first; CTRL-MM-R1..R3 are copies with 2, 5 and 10 m of noise and must rank in that order; CTRL-MEDANOS (Médanos del Chaco, Paraguay, vegetated) must be rejected. All three checks pass in the published data.",
    "- Every published file carries its SHA-256 in the manifest; the Verification page re-hashes them in the browser.",
    "",
    `RANKING (real, from fichas/indice.json; ${ranking.length} entries, threshold ${ranking.length ? "0.70" : "n/a"})`,
    ...(ranking.length
      ? ranking.filter((e) => e.etiqueta !== "incompatible").slice(0, 14).map((e) => "- " + lineaRanking(e, lang))
      : ["- not loaded yet: say that the ranking is on the Explore page"]),
    incompatibles.length ? `- Incompatible (fail a hard requirement): ${incompatibles.join(", ")}` : "",
    "",
    `CURRENT SCREEN: ${ctx.pagina} · Sun slider ${ctx.elevacionSolDeg}° · live engine ${ctx.motorEnVivo ? "connected" : "off (browser calculation)"}`,
    ctx.instante ? `DISPLAY TIME (screen parameter, not an additional engine calculation): ${ctx.instante}` : "",
    ...(ctx.resultadosMotor?.length ? [
      "VERIFIED ENGINE RESULTS (authoritative; each result retains its own inputs and units)",
      JSON.stringify(ctx.resultadosMotor.map(r => r.escenario ? {
        punto: r.escenario.punto, periodo: r.escenario.periodo, resultado: r.escenario.resultado,
        scenario_id: r.escenario.scenario_id, meta: r.escenario.meta,
      } : { error: "No verified result for this scenario" })),
      "Explain these results qualitatively, WITHOUT writing any numbers. Refer to the verified engine readout for numerical values. Do not replace or recalculate that readout. Distinguish geometric night, terrain darkness and battery energy.",
    ] : []),
    "ACTIVE CARD",
    tarjeta,
  ].join("\n");
}

/** A short, honest answer built only from the card and the ranking, used when the model is unavailable. */
export function respuestaLocal(ctx: ContextoSI, lang: "en" | "es"): string {
  const f = ctx.ficha;
  const es = lang === "es";
  if (!f) return es ? "No hay una candidata abierta. Abrí una desde Explorar y te la explico." : "No candidate is open. Pick one on Explore and I will walk you through it.";
  const c = f.C === null ? "—" : f.C.toFixed(2);
  const pos = ctx.ranking?.find((e) => e.id === f.id)?.orden;
  const lineaPos = pos ? (es ? ` Está en el puesto ${pos} del ranking.` : ` It ranks #${pos}.`) : "";
  return es
    ? `${f.id} (${f.lugar.nombre}) tiene compatibilidad C = ${c} y evidencia E = ${f.E.toFixed(2)}, con límites ${f.L.toFixed(2)} a ${f.U.toFixed(2)}: veredicto "${nombreEtiqueta(f.etiqueta, "es")}".${lineaPos} No se reproduce: ${f.no_transfiere.join(", ")}. Lo primero que habría que medir: ${f.medir_primero}.`
    : `${f.id} (${f.lugar.nombre}) has compatibility C = ${c} and evidence E = ${f.E.toFixed(2)}, bounds ${f.L.toFixed(2)} to ${f.U.toFixed(2)}: verdict "${nombreEtiqueta(f.etiqueta, "en")}".${lineaPos} What does not transfer: ${f.no_transfiere.join(", ")}. First thing to measure: ${f.medir_primero}.`;
}

export function extraerAcciones(texto: string): { textoLimpio: string; acciones: AccionRapidaSI[] } {
  const acciones: AccionRapidaSI[] = [];
  const nav: Record<string, [string, string]> = {
    lab: ["Open the 3D lab", "Abrir el laboratorio 3D"],
    compare: ["Compare the two worlds", "Comparar los dos mundos"],
    card: ["Open the candidate card", "Abrir la ficha"],
    explore: ["Browse the candidates", "Ver las candidatas"],
    checks: ["Open Verification", "Abrir Verificación"],
  };
  for (const m of texto.matchAll(/\[ACTION:NAVIGATE:([a-z]+)\]/gi)) {
    const d = m[1].toLowerCase();
    if (nav[d]) acciones.push({ tipo: "navegar", valor: d, etiquetaEn: nav[d][0], etiquetaEs: nav[d][1] });
  }
  for (const m of texto.matchAll(/\[ACTION:SELECT_CANDIDATE:([A-Z0-9-]+)\]/gi)) {
    const id = m[1].toUpperCase();
    acciones.push({ tipo: "seleccionar_candidata", valor: id, etiquetaEn: `Open ${id}`, etiquetaEs: `Abrir ${id}` });
  }
  for (const m of texto.matchAll(/\[ACTION:SET_SUN:([\d.]+)\]/gi)) {
    const deg = Number(m[1]);
    if (deg >= 1.5 && deg <= 10) acciones.push({ tipo: "ajustar_sol", valor: deg, etiquetaEn: `Sun to ${deg}°`, etiquetaEs: `Sol a ${deg}°` });
  }
  return { textoLimpio: texto.replace(/\[ACTION:[^\]]+\]/gi, "").replace(/\n{3,}/g, "\n\n").trim(), acciones: acciones.slice(0, 3) };
}

/** Through the TERRA-X server (the key stays there). Not streamed: the answer arrives whole. */
async function llamarServidor(
  instruccion: string,
  historial: { rol: "user" | "model"; texto: string }[],
  pregunta: string,
): Promise<string> {
  const base = ((import.meta.env.VITE_MOTOR_URL as string | undefined) ?? "").replace(/\/$/, "");
  const r = await fetch(base + "/api/si/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-TerraX": "1" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instruccion }] },
      contents: [...historial.slice(-8).map((h) => ({ role: h.rol, parts: [{ text: h.texto }] })), { role: "user", parts: [{ text: pregunta }] }],
    }),
  });
  let j: { texto?: string; error?: string } = {};
  try {
    j = await r.json();
  } catch {
    // proxy error page: no server behind /api
  }
  if (!r.ok || !j.texto) throw new Error(j.error || `HTTP ${r.status}`);
  return j.texto;
}

export async function consultarSI(
  pregunta: string,
  ctx: ContextoSI,
  lang: "en" | "es",
  historial: { rol: "user" | "model"; texto: string }[],
): Promise<RespuestaChatSI> {
  const t0 = performance.now();
  const local = (aviso?: string): RespuestaChatSI => {
    if (ctx.resultadosMotor?.length) return { ...explicarMotorSI(ctx.resultadosMotor, lang), aviso };
    const candidata = respuestaLocal(ctx, lang);
    const verificacion = verificarRespuestaSI(candidata, ctx);
    const texto = verificacion.valido ? candidata : (lang === "es"
      ? "No puedo mostrar cifras verificadas con los datos disponibles. Abrí la ficha fuente para revisar el resultado."
      : "I cannot show verified figures from the available data. Open the source card to inspect the result.");
    return { texto, origen: "local", modeloUsado: "card only", latenciaMs: Math.round(performance.now() - t0), verificacion: verificarRespuestaSI(texto, ctx), acciones: [], aviso };
  };
  const instruccion = instruccionSistema(ctx, lang);
  try {
    let crudo = await llamarServidor(instruccion, historial, pregunta);
    let { textoLimpio, acciones } = extraerAcciones(crudo);
    let verif = verificarRespuestaSI(textoLimpio, ctx);
    if (!verif.valido) {
      // One rewrite: same conversation, the model is told which figures it may not use.
      const pedido = lang === "es"
        ? `Reescribí tu última respuesta sin usar estas cifras, que no están en los datos publicados: ${verif.numerosNoVerificados.join(", ")}. Si hace falta, decí en palabras que ese dato no está publicado.`
        : `Rewrite your last answer without these figures, which are not in the published data: ${verif.numerosNoVerificados.join(", ")}. If needed, say in words that the figure is not published.`;
      crudo = await llamarServidor(instruccion, [...historial, { rol: "user", texto: pregunta }, { rol: "model", texto: crudo }], pedido);
      ({ textoLimpio, acciones } = extraerAcciones(crudo));
      verif = verificarRespuestaSI(textoLimpio, ctx);
      if (!verif.valido) {
        return local(lang === "es"
          ? "La respuesta del modelo traía cifras que no están en los datos publicados, así que se muestra solo lo que dice la ficha."
          : "The model's answer carried figures that are not in the published data, so only what the card says is shown.");
      }
    }
    return { texto: textoLimpio, origen: "gemini", modeloUsado: NOMBRE_MODELO, latenciaMs: Math.round(performance.now() - t0), verificacion: verif, acciones };
  } catch {
    return local(lang === "es"
      ? "Sin conexión con la SI. Se muestran los datos locales disponibles."
      : "SI connection unavailable. Showing the available local data.");
  }
}
