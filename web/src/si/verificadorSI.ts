import { Ficha, Manifest } from "../datos/contract";

export interface ContextoSI {
  pagina: string;
  ficha?: Ficha;
  manifest?: Manifest;
  elevacionSolDeg: number;
  motorEnVivo?: boolean;
}

export interface ResultadoVerificacionSI {
  valido: boolean;
  numerosExtraidos: number[];
  numerosNoVerificados: number[];
  fraseProhibida: string | null;
  resumenVerificacion: string;
}

/**
 * Constantes físicas y de misión congeladas en parametros.yaml y fichas lunares reales.
 * Toda cifra que mencione la SI debe provenir de esta lista o de la Ficha activa.
 */
const CONSTANTES_VERIFICADAS: number[] = [
  // Escala, recortes y geometría (Doc 02)
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16, 17, 18, 19, 20, 24, 30, 40, 50,
  60, 72, 90, 100, 101, 118, 180, 200, 240, 300, 360, 400, 500, 800, 1600, 2025,
  2026,
  // Sol rasante y umbrales
  0.2, 0.3, 0.5, 0.53, 1.5, 2.5, 3.5, 7.0, 10.0, 15.0,
  // VIPER y Mons Mouton (ficha_verano.json / ficha_invierno.json / iluminacion_nasa.json)
  84.6, -84.6, 31.0, 320, 5420, 5.42, 108.4, 85, 424, 424.0, 622, 622.0, 0.985,
  98.5, 0.16, 0.166, 1.62, 9.81, 708, 29.5,
  // Pesos y evidencia por defecto
  0.1, 0.2, 0.3, 0.6, 0.7, 0.75, 0.8, 0.85,
];

const PATRONES_PROHIBIDOS: { regex: RegExp; motivo: string }[] = [
  {
    regex: /\b\d+(?:[.,]\d+)?\s*%\s*(?:similar|parecido|idéntico|identico|igual|match)\s+(?:to|a)\s+(?:the\s+)?(?:moon|mars|luna|marte)\b/i,
    motivo: "Prohibited global similarity percentage to the Moon or Mars",
  },
  {
    regex: /\b(?:certifies|certifica|guarantees|garantiza)\s+(?:a\s+)?(?:lunar|moon)\s+(?:mission|operation|misión|operación)\b/i,
    motivo: "Prohibited claim that an Earth test certifies a lunar mission",
  },
  {
    regex: /\b(?:reproduces|reproduce|simulates|simula)\s+lunar\s+(?:gravity|vacuum|gravedad|vacío)\b/i,
    motivo: "Prohibited claim that an open-air site reproduces lunar gravity or vacuum",
  },
];

function extraerNumerosDeFicha(ctx: ContextoSI): number[] {
  const nums = new Set<number>(CONSTANTES_VERIFICADAS);
  nums.add(Number(ctx.elevacionSolDeg.toFixed(2)));
  const SombraPoste = 0.5 / Math.tan((ctx.elevacionSolDeg * Math.PI) / 180);
  if (Number.isFinite(SombraPoste)) {
    nums.add(Number(SombraPoste.toFixed(2)));
    nums.add(Number(SombraPoste.toFixed(1)));
  }

  const f = ctx.ficha;
  if (f) {
    for (const val of [f.C, f.E, f.L, f.U, f.lugar.lat, f.lugar.lon]) {
      if (typeof val === "number" && Number.isFinite(val)) {
        nums.add(val);
        nums.add(Math.abs(val));
        nums.add(Number(val.toFixed(2)));
        nums.add(Number(val.toFixed(3)));
        nums.add(Number((val * 100).toFixed(0)));
        nums.add(Number((val * 100).toFixed(1)));
      }
    }
    if (f.U !== null && f.L !== null) {
      const ancho = f.U - f.L;
      nums.add(Number(ancho.toFixed(2)));
      nums.add(Number(ancho.toFixed(3)));
    }
    const idMatch = f.id.match(/\d+/g);
    if (idMatch) {
      idMatch.forEach((m) => nums.add(Number(m)));
    }
    for (const h of f.horario) {
      const matches = `${h.fecha} ${h.desde} ${h.hasta}`.match(/\d+/g);
      if (matches) {
        matches.forEach((m) => nums.add(Number(m)));
      }
      const [h1, m1] = h.desde.split(":").map(Number);
      const [h2, m2] = h.hasta.split(":").map(Number);
      const mins = h2 * 60 + m2 - (h1 * 60 + m1);
      if (Number.isFinite(mins) && mins > 0) {
        nums.add(mins);
      }
    }
  }
  return Array.from(nums);
}

function coincideConVerificados(n: number, permitidos: number[]): boolean {
  const absN = Math.abs(n);
  return permitidos.some((p) => {
    const absP = Math.abs(p);
    const tol = Math.max(0.015, absP * 0.015);
    return Math.abs(absN - absP) <= tol;
  });
}

/**
 * Extrae cada cifra del texto generado por la SI y comprueba que exista en la ficha
 * o en las constantes verificadas del motor, además de bloquear frases prohibidas (Doc 04 §8).
 */
export function verificarRespuestaSI(
  texto: string,
  ctx: ContextoSI,
): ResultadoVerificacionSI {
  for (const regla of PATRONES_PROHIBIDOS) {
    if (regla.regex.test(texto)) {
      return {
        valido: false,
        numerosExtraidos: [],
        numerosNoVerificados: [],
        fraseProhibida: regla.motivo,
        resumenVerificacion: regla.motivo,
      };
    }
  }

  // Limpiamos identificadores como P-07, F1..F20, UTC-3, 1/6 g antes de extraer cifras científicas
  const limpio = texto
    .replace(/\b(?:P|CTRL-MM-R|F)-?\d+\b/gi, " ")
    .replace(/\bUTC[−+-]?\d+\b/gi, " ")
    .replace(/\b1\/6\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");

  const coincidencias = limpio.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  const permitidos = extraerNumerosDeFicha(ctx);
  const extraidos: number[] = [];
  const noVerificados: number[] = [];

  for (const raw of coincidencias) {
    const norm = Number(raw.replace(",", "."));
    if (!Number.isFinite(norm)) continue;
    extraidos.push(norm);
    if (!coincideConVerificados(norm, permitidos)) {
      noVerificados.push(norm);
    }
  }

  const valido = noVerificados.length === 0;
  return {
    valido,
    numerosExtraidos: extraidos,
    numerosNoVerificados: noVerificados,
    fraseProhibida: null,
    resumenVerificacion: valido
      ? `Verified (${extraidos.length} numeric values matched card & engine constants)`
      : `Blocked ${noVerificados.length} unverified number(s): ${noVerificados.join(", ")}`,
  };
}

/**
 * Opción C (Doc 04): Explicador determinista verificado que funciona sin internet y sin clave,
 * o como respaldo automático si la red o el verificador rechazan una salida.
 */
export function respuestaDeterministaSI(
  pregunta: string,
  ctx: ContextoSI,
  lang: "en" | "es",
): string {
  const q = pregunta.toLowerCase();
  const f = ctx.ficha;

  // 1. Explicación de la candidata actual (C, E, L, U, etiqueta)
  if (
    q.includes("candidat") ||
    q.includes("ficha") ||
    q.includes("card") ||
    q.includes("p-0") ||
    q.includes("p-") ||
    q.includes("compatib") ||
    q.includes("evidenc") ||
    q.includes("explain") ||
    q.includes("explica")
  ) {
    if (!f) {
      return lang === "es"
        ? "Todavía no hay una ficha candidata cargada. Abrí la pestaña Explorar para seleccionar una parcela (por ejemplo P-07 en Payunia)."
        : "No candidate card is currently loaded. Open the Explore tab to select a parcel (for example P-07 in Payunia).";
    }
    const cStr = f.C === null ? (lang === "es" ? "Desconocido" : "Unknown") : f.C.toFixed(2);
    const ancho = (f.U - f.L).toFixed(2);
    const hor = f.horario[0]
      ? `${f.horario[0].fecha} (${f.horario[0].desde}–${f.horario[0].hasta} UTC−3)`
      : lang === "es"
        ? "sin ventana horaria"
        : "no scheduled window";

    if (lang === "es") {
      return [
        `**Ficha activa: ${f.id} · ${f.lugar.nombre}** (${f.lugar.region}, coords \`${f.lugar.lat}, ${f.lugar.lon}\`).`,
        `• **Compatibilidad (C = ${cStr})** y **Evidencia (E = ${f.E.toFixed(2)})** se reportan por separado: nunca se mezclan en un porcentaje global de similitud con la Luna.`,
        `• **Intervalo de decisión [L, U] = [${f.L.toFixed(2)}, ${f.U.toFixed(2)}]** (ancho ${ancho}): calculado con F17 y F18 ($L = C \\cdot E$, $U = L + (1 - E)$).`,
        `• **Qué NO se transfiere:** ${f.no_transfiere.join(", ")}.`,
        `• **Qué medir primero en campo:** ${f.medir_primero}`,
        `• **Ventana de luz rasante (1,5° a 10°):** ${hor}.`,
      ].join("\n");
    }
    return [
      `**Active card: ${f.id} · ${f.lugar.nombre}** (${f.lugar.region}, coords \`${f.lugar.lat}, ${f.lugar.lon}\`).`,
      `• **Compatibility (C = ${cStr})** and **Evidence (E = ${f.E.toFixed(2)})** are reported separately — never merged into a single percentage of similarity to the Moon.`,
      `• **Decision bounds [L, U] = [${f.L.toFixed(2)}, ${f.U.toFixed(2)}]** (width ${ancho}): computed via F17 & F18 ($L = C \\cdot E$, $U = L + (1 - E)$).`,
      `• **Does NOT transfer:** ${f.no_transfiere.join(", ")}.`,
      `• **Measure first in the field:** ${f.medir_primero}`,
      `• **Grazing-light window (1.5° to 10°):** ${hor}.`,
    ].join("\n");
  }

  // 2. Mons Mouton, refugios, VIPER, noche lunar
  if (
    q.includes("mons") ||
    q.includes("mouton") ||
    q.includes("viper") ||
    q.includes("refug") ||
    q.includes("bater") ||
    q.includes("batter") ||
    q.includes("noche") ||
    q.includes("night") ||
    q.includes("luna") ||
    q.includes("moon") ||
    q.includes("424")
  ) {
    if (lang === "es") {
      return [
        "**Destino lunar: Mons Mouton (84,6°S, 31,0°E) y rover clase VIPER:**",
        "• **Vehículo:** paneles solares de 320 W en 3 lados, batería de 5.420 Wh y límite de supervivencia sin Sol de 50 h (consumo de supervivencia de 108,4 W, F6).",
        "• **Validación con NASA LOLA (PGDA 69 AVGVISIB):** correlación de Spearman $\\rho = 0{,}985$ y RMSE de 2,5 puntos porcentuales en 10.000 puntos.",
        "• **Hallazgo real en el recorte central de 30 × 30 km (a 60 m/píxel):** la oscuridad continua mínima es de **424 h en verano** y **622 h en invierno** (0% de refugios con el umbral de 50 h). Las crestas de alta iluminación (85% de luz) están a ~20–24 km al oeste del centro.",
      ].join("\n");
    }
    return [
      "**Lunar destination: Mons Mouton (84.6°S, 31.0°E) & VIPER-class rover:**",
      "• **Vehicle parameters:** 320 W solar panels on 3 sides, 5,420 Wh battery, and 50 h survival limit without Sun (108.4 W survival draw, F6).",
      "• **Validation against NASA LOLA (PGDA 69 AVGVISIB):** Spearman correlation $\\rho = 0.985$ and RMSE of 2.5 percentage points across 10,000 points.",
      "• **Real finding on the central 30 × 30 km crop (60 m/pixel):** minimum continuous darkness is **424 h in summer** and **622 h in winter** (0% refuges under the 50 h threshold). High-illumination ridges (85% sunlight) lie ~20–24 km west of the center.",
    ].join("\n");
  }

  // 3. Qué no se transfiere / límites de un análogo
  if (
    q.includes("transfer") ||
    q.includes("transfiere") ||
    q.includes("limit") ||
    q.includes("límit") ||
    q.includes("diferen") ||
    q.includes("differ") ||
    q.includes("grav") ||
    q.includes("atmo")
  ) {
    const lista = f?.no_transfiere?.length
      ? f.no_transfiere.join(", ")
      : "Gravity (1/6 g), Vacuum, Sharp shadow contrast without sky diffuse light, Radiation, Electrostatic regolith dust, Time scales";
    if (lang === "es") {
      return [
        "**Qué NO se transfiere de la Tierra a la Luna:**",
        `• En la ficha activa (${f?.id ?? "P-07"}): **${lista}**.`,
        "• **Por qué importa:** en la Tierra el cielo azul ilumina las sombras por dispersión atmosférica y la gravedad es 6 veces mayor. Además, el Sol cruza de 1,5° a 10° en unos 30–40 minutos al amanecer o atardecer, mientras que en el polo sur lunar una lunación dura ~708 horas (~29,5 días).",
        "• Por eso TERRA-X compara la **respuesta geométrica del relieve a la luz rasante $\\bar{f}(e)$** a 60 m por píxel (F16) sin atmósfera.",
      ].join("\n");
    }
    return [
      "**What does NOT transfer from Earth to the Moon:**",
      `• On the active card (${f?.id ?? "P-07"}): **${lista}**.`,
      "• **Why it matters:** on Earth, Rayleigh sky scattering fills shadows with diffuse light and gravity is 6× higher. Also, the Sun crosses 1.5° to 10° in ~30–40 minutes at sunrise/sunset, whereas a lunar polar lunation lasts ~708 hours (~29.5 days).",
      "• That is why TERRA-X compares the **geometric relief response to grazing light $\\bar{f}(e)$** at 60 m per pixel (F16) with no atmosphere.",
    ].join("\n");
  }

  // 4. Medición de campo / sombra / tablita
  if (
    q.includes("campo") ||
    q.includes("field") ||
    q.includes("sombra") ||
    q.includes("shadow") ||
    q.includes("tablit") ||
    q.includes("board") ||
    q.includes("medir") ||
    q.includes("measure")
  ) {
    const sombraActual = (0.5 / Math.tan((ctx.elevacionSolDeg * Math.PI) / 180)).toFixed(2);
    if (lang === "es") {
      return [
        "**Protocolo de campo y qué medir primero:**",
        `• **En la parcela ${f?.id ?? "P-07"}:** falta medir **${f?.medir_primero ?? "composición superficial y transitabilidad fina"}** para subir la evidencia $E$ de ${f?.E.toFixed(2) ?? "0.80"} a 1,00 y cerrar el ancho del intervalo $[L, U]$.`,
        `• **Verificación con tablita de 0,50 m:** con la elevación solar actual del control (${ctx.elevacionSolDeg}°), un poste vertical de 0,50 m proyecta una sombra geométrica de **${sombraActual} m** ($L = h / \\tan(e)$).`,
      ].join("\n");
    }
    return [
      "**Field protocol & what to measure first:**",
      `• **On parcel ${f?.id ?? "P-07"}:** measure **${f?.medir_primero ?? "surface material composition and fine-scale traversability"}** to raise evidence $E$ from ${f?.E.toFixed(2) ?? "0.80"} to 1.00 and narrow the $[L, U]$ interval.`,
      `• **0.50 m board shadow check:** at the current slider Sun elevation (${ctx.elevacionSolDeg}°), a 0.50 m vertical post casts a **${sombraActual} m** geometric shadow ($L = h / \\tan(e)$).`,
    ].join("\n");
  }

  // 5. Fórmulas / método / escala 60 m
  if (
    q.includes("formul") ||
    q.includes("fórmul") ||
    q.includes("60") ||
    q.includes("horn") ||
    q.includes("rugos") ||
    q.includes("rough") ||
    q.includes("f1") ||
    q.includes("f8") ||
    q.includes("f9") ||
    q.includes("f16")
  ) {
    if (lang === "es") {
      return [
        "**Método físico de TERRA-X (20 fórmulas, escala común de 60 m):**",
        "• **Escala común (60 m/píxel sin interpolar hacia abajo):** LOLA 20 m se promedia en bloques exactos de 3 × 3; Copernicus GLO-30 se reproyecta a UTM a 60 m por promedio.",
        "• **Huella del relieve:** pendiente de Horn en ventana 3 × 3 (F8), rugosidad RMS restando un plano en ventanas circulares de 200, 400, 800 y 1.600 m (F9), y fracción en sombra promediada en azimut $\\bar{f}(e)$ de 1,5° a 10° (F16).",
        "• **Puntaje honesto:** distancia de Wasserstein $W_1$ normalizada por IQR sobre 101 cuantiles (F14, F15) y límites $L = C \\cdot E$, $U = L + (1 - E)$ (F17, F18).",
      ].join("\n");
    }
    return [
      "**TERRA-X physical method (20 formulas, 60 m common scale):**",
      "• **Common scale (60 m/pixel, no downward interpolation):** LOLA 20 m is averaged in exact 3 × 3 blocks; Copernicus GLO-30 is average-resampled to 60 m UTM.",
      "• **Terrain footprint:** Horn 3 × 3 slope (F8), plane-detrended circular-window RMS roughness at 200, 400, 800, and 1,600 m (F9), and azimuth-averaged shadow fraction $\\bar{f}(e)$ from 1.5° to 10° (F16).",
      "• **Honest scoring:** IQR-normalized Wasserstein $W_1$ distance over 101 quantiles (F14, F15) and bounds $L = C \\cdot E$, $U = L + (1 - E)$ (F17, F18).",
    ].join("\n");
  }

  // Respuesta general contextualizada a la página actual
  if (lang === "es") {
    return [
      `Soy el asistente **SI (Super Intelligence)** de TERRA-X. Estoy viendo la pantalla **${ctx.pagina}** con la candidata **${f?.id ?? "P-07"}** ($C = ${f?.C?.toFixed(2) ?? "0.78"}$, $E = ${f?.E.toFixed(2) ?? "0.80"}$, límites $[${f?.L.toFixed(2) ?? "0.62"}, ${f?.U.toFixed(2) ?? "0.82"}]$) y el Sol a **${ctx.elevacionSolDeg}°**.`,
      "Puedo explicarte:",
      "1. **La ficha candidata actual** ($C$, $E$, intervalo $[L, U]$ y ventana horaria).",
      "2. **El destino lunar Mons Mouton** (rover VIPER, 320 W, 5.420 Wh, 424 h de noche mínima en verano).",
      "3. **Qué no se transfiere a la Luna** y qué medir primero en campo.",
      "*(Podés cargar tu API key gratuita de Google Gemini con el botón **🔑 API Key** arriba a la derecha para activar respuestas generativas verificadas con `gemini-2.5-flash`).*",
    ].join("\n");
  }
  return [
    `I am the TERRA-X **SI (Super Intelligence)** assistant. You are on **${ctx.pagina}** viewing candidate **${f?.id ?? "P-07"}** ($C = ${f?.C?.toFixed(2) ?? "0.78"}$, $E = ${f?.E.toFixed(2) ?? "0.80"}$, bounds $[${f?.L.toFixed(2) ?? "0.62"}, ${f?.U.toFixed(2) ?? "0.82"}]$) with Sun elevation **${ctx.elevacionSolDeg}°**.`,
    "Ask me about:",
    "1. **The active candidate card** ($C$, $E$, $[L, U]$ bounds, and rehearsal window).",
    "2. **Mons Mouton lunar destination** (VIPER rover, 320 W, 5,420 Wh, 424 h minimum summer night).",
    "3. **What does not transfer to the Moon** and what to measure first in the field.",
    "*(Click **🔑 API Key** in the top-right of this panel to paste your free Google Gemini API key and enable verified generative responses with `gemini-2.5-flash`).*",
  ].join("\n");
}
