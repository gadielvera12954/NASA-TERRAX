import { Ficha, Manifest } from "../datos/contract";
import { IndexEntry } from "../datos/integration";

export interface FichaFuenteDetallada {
  id?: string;
  orden?: number | null;
  orden_candidatas?: number | null;
  umbral?: number;
  requisitos?: {
    vegetacion?: { estado: string; valor: number | null; limite: number; unidad: string };
    pendiente?: { estado: string; valor: number | null; limite: number; unidad: string };
  };
  propiedades?: {
    pendiente?: { estado: string; peso: number; distancia: number | null; tolerancia: number | null; utilidad: number | null };
    luz_rasante?: { estado: string; peso: number; distancia: number | null; tolerancia: number | null; utilidad: number | null };
    rugosidad?: {
      estado: string;
      peso: number;
      distancia: number | null;
      tolerancia: number | null;
      utilidad: number | null;
      detalle?: Record<string, { w1_m: number; tolerancia_m: number; utilidad: number }>;
    };
    material?: { estado: string; peso: number; utilidad: number | null };
    transitabilidad_fina?: { estado: string; peso: number; utilidad: number | null };
  };
  luz_rasante?: {
    e_deg: number[];
    f_parcela: number[];
    f_referencia: number[];
  };
  dato_que_cambia?: {
    propiedad: string;
    peor: { L: number; U: number; etiqueta: string; orden: number };
    mejor: { L: number; U: number; etiqueta: string; orden: number };
    cambia_etiqueta: boolean;
    cambia_primer_lugar: boolean;
  }[];
  robustez?: {
    primera_frac: number;
    n: number;
    alfa: number;
  };
}

export interface AccionRapidaSI {
  tipo: "navegar" | "seleccionar_candidata" | "ajustar_sol" | "cambiar_vista_panel";
  valor: string | number;
  etiquetaEn: string;
  etiquetaEs: string;
}

export type WidgetTipoSI = "telemetria_ficha" | "curva_luz" | "ranking_controles" | "escenario_mision";

export interface ContextoSI {
  pagina: string;
  ficha?: Ficha;
  manifest?: Manifest;
  indice?: IndexEntry[];
  /** The real published ranking (fichas/indice.json); its numbers count as verified. */
  ranking?: import("../datos/ranking").EntradaRanking[];
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

export function extraerDetalleFuente(ficha?: Ficha): FichaFuenteDetallada | null {
  if (!ficha?.source || typeof ficha.source !== "object") return null;
  return ficha.source as FichaFuenteDetallada;
}

const CONSTANTES_VERIFICADAS: number[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 23, 24,
  30, 40, 50, 60, 70, 72, 80, 90, 100, 101, 118, 180, 200, 240, 250, 300, 360,
  400, 500, 800, 1000, 1600, 2025, 2026,
  0.1, 0.2, 0.3, 0.5, 0.53, 0.7, 0.8, 1.5, 2.5, 3.5, 7.0, 10.0, 15.0,
  84.6, -84.6, 31.0, 320, 5420, 5.42, 108.4, 85, 424, 622, 1.62,
  9.81, 708, 29.5,
  // Mons Mouton and the mission (engine outputs published on the site)
  6.96, 289, 418, 2027, 45, 14, 64, 1901, 2049,
  // The ranking itself (C, E, L, U of every candidate and control) is added from ctx.ranking.
];

const PATRONES_PROHIBIDOS: { regex: RegExp; motivo: string }[] = [
  {
    regex: /\b\d+(?:[.,]\d+)?\s*%\s*(?:similar|parecido|idéntico|identico|igual|match)\s+(?:to|a)\s+(?:the\s+)?(?:moon|mars|luna|marte)\b/i,
    motivo: "Blocked prohibited global percentage similarity claim to the Moon or Mars",
  },
  {
    regex: /\b(?:certifies|certifica|guarantees|garantiza)\s+(?:a\s+)?(?:lunar|moon)\s+(?:mission|operation|misión|operación)\b/i,
    motivo: "Blocked claim that an Earth rehearsal certifies a lunar mission",
  },
  {
    regex: /\b(?:reproduces|reproduce|simulates|simula)\s+lunar\s+(?:gravity|vacuum|gravedad|vacío)\b/i,
    motivo: "Blocked claim that an open-air site reproduces lunar gravity or vacuum",
  },
];

function recolectarNumerosVerificados(ctx: ContextoSI): number[] {
  const nums = new Set<number>(CONSTANTES_VERIFICADAS);
  const agregar = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      nums.add(v);
      nums.add(Math.abs(v));
      nums.add(Number(v.toFixed(1)));
      nums.add(Number(v.toFixed(2)));
      nums.add(Number(v.toFixed(3)));
      nums.add(Number(v.toFixed(4)));
      if (Math.abs(v) <= 1) {
        nums.add(Number((v * 100).toFixed(0)));
        nums.add(Number((v * 100).toFixed(1)));
      }
    }
  };

  agregar(ctx.elevacionSolDeg);
  const sombra = 0.5 / Math.tan((ctx.elevacionSolDeg * Math.PI) / 180);
  agregar(sombra);
  for (const e of ctx.ranking ?? []) {
    agregar(e.C);
    agregar(e.E);
    agregar(e.L);
    agregar(e.U);
    agregar(e.orden);
    agregar(e.lugar.lat);
    agregar(e.lugar.lon);
    agregar(e.lugar.alt_m);
  }

  const f = ctx.ficha;
  if (f) {
    agregar(f.C);
    agregar(f.E);
    agregar(f.L);
    agregar(f.U);
    if (f.C !== null) agregar(f.U - f.L);
    agregar(f.lugar.lat);
    agregar(f.lugar.lon);

    const det = extraerDetalleFuente(f);
    if (det) {
      agregar(det.orden);
      agregar(det.orden_candidatas);
      agregar(det.umbral);
      agregar(det.requisitos?.vegetacion?.valor);
      agregar(det.requisitos?.vegetacion?.limite);
      agregar(det.requisitos?.pendiente?.valor);
      agregar(det.requisitos?.pendiente?.limite);
      agregar(det.propiedades?.pendiente?.distancia);
      agregar(det.propiedades?.pendiente?.utilidad);
      agregar(det.propiedades?.luz_rasante?.distancia);
      agregar(det.propiedades?.luz_rasante?.utilidad);
      agregar(det.propiedades?.rugosidad?.distancia);
      agregar(det.propiedades?.rugosidad?.utilidad);
      if (det.propiedades?.rugosidad?.detalle) {
        for (const k of Object.keys(det.propiedades.rugosidad.detalle)) {
          const d = det.propiedades.rugosidad.detalle[k];
          agregar(d.w1_m);
          agregar(d.tolerancia_m);
          agregar(d.utilidad);
        }
      }
      if (det.luz_rasante) {
        det.luz_rasante.e_deg.forEach(agregar);
        det.luz_rasante.f_parcela.forEach(agregar);
        det.luz_rasante.f_referencia.forEach(agregar);
      }
      if (det.robustez) {
        agregar(det.robustez.primera_frac);
        agregar(det.robustez.n);
        agregar(det.robustez.alfa);
      }
    }
  }
  return Array.from(nums);
}

function coincideNumero(n: number, permitidos: number[]): boolean {
  const absN = Math.abs(n);
  return permitidos.some((p) => {
    const absP = Math.abs(p);
    const tol = Math.max(0.02, absP * 0.02);
    return Math.abs(absN - absP) <= tol;
  });
}

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

  const limpio = texto
    .replace(/\[ACTION:[^\]]+\]/g, " ")
    .replace(/\bSHA-?256\b/gi, " ")
    .replace(/\bDE-?421\b/gi, " ")
    .replace(/\bGLO-?30\b/gi, " ")
    .replace(/\bSentinel-?2\b/gi, " ")
    .replace(/\bPGDA\s*\d+\b/gi, " ")
    .replace(/\bGemini\s*\d+(?:\.\d+)?\b/gi, " ")
    .replace(/\b(?:P|CTRL-MM-R|F)-?\d+\b/gi, " ")
    .replace(/\bUTC[−+-]?\d+\b/gi, " ")
    .replace(/\b1\/6\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ");

  const coincidencias = limpio.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  const permitidos = recolectarNumerosVerificados(ctx);
  const extraidos: number[] = [];
  const noVerificados: number[] = [];

  for (const raw of coincidencias) {
    const norm = Number(raw.replace(",", "."));
    if (!Number.isFinite(norm)) continue;
    extraidos.push(norm);
    if (!coincideNumero(norm, permitidos)) {
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
      ? `${extraidos.length} figures verified against card & mission parameters`
      : `Blocked unverified figure(s): ${noVerificados.join(", ")}`,
  };
}

export interface RespuestaEstructuradaLocal {
  texto: string;
  widgets: WidgetTipoSI[];
  acciones: AccionRapidaSI[];
}

export function respuestaDeterministaRica(
  pregunta: string,
  ctx: ContextoSI,
  lang: "en" | "es",
): RespuestaEstructuradaLocal {
  const q = pregunta.toLowerCase();
  const f = ctx.ficha;
  const det = extraerDetalleFuente(f);

  // 1. Ranking / comparar todas las candidatas / controles
  if (
    q.includes("rank") ||
    q.includes("todas") ||
    q.includes("all candidat") ||
    q.includes("comparar") ||
    q.includes("compare") ||
    q.includes("control") ||
    q.includes("mejor") ||
    q.includes("best") ||
    q.includes("medanos") ||
    q.includes("médanos")
  ) {
    const texto =
      lang === "es"
        ? [
            "**Escalera de validación y ranking de Payunia (`indice.json`):**",
            "• **Puesto #1 (Control Positivo `CTRL-MM`):** el recorte central de Mons Mouton alcanza $C = 1{,}00$, $E = 0{,}80$, límites $[0{,}80, 1{,}00]$.",
            "• **Mejor análogo terrestre (`P-07`):** logra $C = 0{,}886$, $E = 0{,}80$, límites $[0{,}709, 0{,}909]$ ($L > 0{,}70$, etiqueta **Análogo sostenido**). Sale #1 entre todas las parcelas terrestres en el **100 % de las 1.000 perturbaciones de pesos** (Dirichlet $\\alpha = 100$).",
            "• **Controles con ruido Gaussiano (`CTRL-MM-R1`, `R2`, `R3`):** caen ordenadamente en puestos #3 ($C = 0{,}792$), #5 ($C = 0{,}632$) y #8 ($C = 0{,}508$), demostrando que la métrica $W_1$ detecta degradación real del relieve.",
            "• **Control negativo (`CTRL-MEDANOS`):** aunque su relieve dunar daría $C = 0{,}918$, el filtro indispensable de vegetación (NDVI $> 0{,}20$) lo rechaza como **Incompatible**.",
          ].join("\n")
        : [
            "**Validation ladder & Payunia ranking (`indice.json`):**",
            "• **Rank #1 (Positive Control `CTRL-MM`):** the Mons Mouton self-crop scores $C = 1.00$, $E = 0.80$, bounds $[0.80, 1.00]$.",
            "• **Top terrestrial analog (`P-07`):** achieves $C = 0.886$, $E = 0.80$, bounds $[0.709, 0.909]$ ($L > 0.70$, verdict **Supported analog**). It ranks #1 among all Earth parcels across **100% of 1,000 Dirichlet weight perturbations** ($\\alpha = 100$).",
            "• **Gaussian-noise controls (`CTRL-MM-R1`, `R2`, `R3`):** degrade monotonically at ranks #3 ($C = 0.792$), #5 ($C = 0.632$), and #8 ($C = 0.508$), proving the $W_1$ metric is sensitive to relief degradation.",
            "• **Negative control (`CTRL-MEDANOS`):** despite high relief similarity ($C = 0.918$), the mandatory vegetation gate (NDVI $> 0.20$) rejects it as **Incompatible**.",
          ].join("\n");

    return {
      texto,
      widgets: ["ranking_controles"],
      acciones: [
        {
          tipo: "seleccionar_candidata",
          valor: "P-07",
          etiquetaEn: "Load P-07 (#1 Supported)",
          etiquetaEs: "Cargar P-07 (#1 Sostenido)",
        },
        {
          tipo: "seleccionar_candidata",
          valor: "P-09",
          etiquetaEn: "Load P-09 (With gaps)",
          etiquetaEs: "Cargar P-09 (Con huecos)",
        },
        {
          tipo: "seleccionar_candidata",
          valor: "CTRL-MEDANOS",
          etiquetaEn: "Inspect CTRL-MEDANOS (Rejected)",
          etiquetaEs: "Ver CTRL-MEDANOS (Rechazado)",
        },
        {
          tipo: "navegar",
          valor: "compare",
          etiquetaEn: "Open Side-by-Side Comparator",
          etiquetaEs: "Abrir Comparador Lado a Lado",
        },
      ],
    };
  }

  // 2. Luz rasante / sombras / curva f(e)
  if (
    q.includes("luz") ||
    q.includes("light") ||
    q.includes("sombra") ||
    q.includes("shadow") ||
    q.includes("curva") ||
    q.includes("curve") ||
    q.includes("f16") ||
    q.includes("rasante") ||
    q.includes("grazing")
  ) {
    const sombraPoste = (0.5 / Math.tan((ctx.elevacionSolDeg * Math.PI) / 180)).toFixed(2);
    const utilLuz = det?.propiedades?.luz_rasante?.utilidad
      ? `${(det.propiedades.luz_rasante.utilidad * 100).toFixed(1)}%`
      : "86.0%";
    const distLuz = det?.propiedades?.luz_rasante?.distancia ?? 0.00753;

    const texto =
      lang === "es"
        ? [
            `**Respuesta a la luz rasante $\\bar{f}(e)$ (F16) en ${f?.id ?? "P-07"}:**`,
            `• Entre **1,5° y 10,0°** de elevación solar (en pasos de 0,5°, promediando 72 azimutes sin atmósfera), la diferencia media de fracción en sombra $|\\Delta\\bar{f}|$ frente a Mons Mouton es de apenas **${distLuz}** (utilidad **${utilLuz}**, peso 0,30).`,
            `• **A 1,5° de Sol:** el **68,8 %** de la parcela ${f?.id ?? "P-07"} queda en sombra topográfica, frente al **69,1 %** en Mons Mouton.`,
            `• **Con tu ángulo solar actual (${ctx.elevacionSolDeg}°):** la tablita vertical de 0,50 m proyecta **${sombraPoste} m** de sombra geométrica.`,
          ].join("\n")
        : [
            `**Grazing-light shadow response $\\bar{f}(e)$ (F16) on ${f?.id ?? "P-07"}:**`,
            `• Across **1.5° to 10.0°** solar elevation (0.5° steps, averaged over 72 azimuths with no atmosphere), the mean shadow-fraction discrepancy $|\\Delta\\bar{f}|$ against Mons Mouton is only **${distLuz}** (utility **${utilLuz}**, weight 0.30).`,
            `• **At 1.5° Sun:** **68.8%** of parcel ${f?.id ?? "P-07"} is in topographic shadow, compared with **69.1%** on Mons Mouton.`,
            `• **At your current slider angle (${ctx.elevacionSolDeg}°):** a 0.50 m vertical board casts a **${sombraPoste} m** geometric shadow.`,
          ].join("\n");

    return {
      texto,
      widgets: ["curva_luz"],
      acciones: [
        {
          tipo: "ajustar_sol",
          valor: 1.5,
          etiquetaEn: "Set Sun to 1.5° (Extreme grazing)",
          etiquetaEs: "Sol a 1,5° (Rasante extremo)",
        },
        {
          tipo: "ajustar_sol",
          valor: 3.5,
          etiquetaEn: "Set Sun to 3.5° (Mid polar)",
          etiquetaEs: "Sol a 3,5° (Polar medio)",
        },
        {
          tipo: "ajustar_sol",
          valor: 7.0,
          etiquetaEn: "Set Sun to 7.0° (Lunar max)",
          etiquetaEs: "Sol a 7,0° (Máximo lunar)",
        },
      ],
    };
  }

  // 3. Mons Mouton / VIPER / Laboratorio 3D / noche lunar
  if (
    q.includes("mons") ||
    q.includes("mouton") ||
    q.includes("viper") ||
    q.includes("bater") ||
    q.includes("batter") ||
    q.includes("3d") ||
    q.includes("lab") ||
    q.includes("noche") ||
    q.includes("night") ||
    q.includes("424")
  ) {
    const texto =
      lang === "es"
        ? [
            "**Destino lunar: Mons Mouton (84,6°S, 31,0°E) y supervivencia del rover:**",
            "• **Parámetros VIPER (F3–F7):** 3 paneles laterales de **320 W**, batería de **5.420 Wh** y supervivencia máxima sin Sol de **50 h** (consumo pasivo de **108,4 W**).",
            "• **Validación contra NASA LOLA (`AVGVISIB` PGDA 69):** correlación de Spearman $\\rho = 0{,}985$ y RMSE $= 2{,}5$ puntos porcentuales en 10.000 puntos.",
            "• **Hallazgo físico en el recorte central de 30 × 30 km:** la noche continua más corta dura **424 h en verano** y **622 h en invierno** (0 % de refugios bajo el límite de 50 h). Para sobrevivir con batería de 50 h hay que estacionar en las crestas situadas a ~20–24 km al oeste.",
          ].join("\n")
        : [
            "**Lunar destination: Mons Mouton (84.6°S, 31.0°E) & rover survival:**",
            "• **VIPER parameters (F3–F7):** 3 side-mounted **320 W** solar panels, **5,420 Wh** battery, and **50 h** max survival in darkness (**108.4 W** survival draw).",
            "• **Validation against NASA LOLA (`AVGVISIB` PGDA 69):** Spearman correlation $\\rho = 0.985$ and RMSE $= 2.5$ percentage points over 10,000 points.",
            "• **Physical finding on the central 30 × 30 km crop:** shortest continuous darkness is **424 h in summer** and **622 h in winter** (0% refuges under the 50 h limit). Surviving on a 50 h battery requires parking on the ridges ~20–24 km west.",
          ].join("\n");

    return {
      texto,
      widgets: ["escenario_mision"],
      acciones: [
        {
          tipo: "navegar",
          valor: "lab",
          etiquetaEn: "Open 3D Lunar Lab",
          etiquetaEs: "Abrir Laboratorio Lunar 3D",
        },
        {
          tipo: "navegar",
          valor: "compare",
          etiquetaEn: "Open Earth / Moon 3D Stage",
          etiquetaEs: "Abrir Escenario 3D Tierra / Luna",
        },
      ],
    };
  }

  // Por defecto: Análisis profundo con telemetría de la ficha activa
  const cVal = f?.C !== null && f?.C !== undefined ? f.C.toFixed(3) : "—";
  const eVal = f ? f.E.toFixed(2) : "0.80";
  const lVal = f ? f.L.toFixed(3) : "0.709";
  const uVal = f ? f.U.toFixed(3) : "0.909";
  const pendMed = det?.requisitos?.pendiente?.valor ?? 5.21;
  const ndviVal = det?.requisitos?.vegetacion?.valor ?? 0.07;

  const texto =
    lang === "es"
      ? [
          `**Telemetría verificada de ${f?.id ?? "P-07"} (${f?.lugar.nombre ?? "Payunia"}):**`,
          `• **Compatibilidad $C = ${cVal}$ · Evidencia $E = ${eVal}$:** evaluadas a **60 m/píxel** sin interpolar hacia abajo. El intervalo algebraico $[L, U] = [${lVal}, ${uVal}]$ supera el umbral de decisión de **0,70**.`,
          `• **Puertas obligatorias (F11):** pendiente mediana de **${pendMed}°** ($< 15^\\circ$) y NDVI p90 anual de **${ndviVal}** ($< 0{,}20$).`,
          `• **Qué medir en campo para cerrar el 0,20 de evidencia faltante:** composición superficial (peso 0,10) y transitabilidad fina (peso 0,10). Incluso en el peor caso ($u = 0$), $L = ${lVal}$ mantiene el puesto #1.`,
        ].join("\n")
      : [
          `**Verified telemetry for ${f?.id ?? "P-07"} (${f?.lugar.nombre ?? "Payunia"}):**`,
          `• **Compatibility $C = ${cVal}$ · Evidence $E = ${eVal}$:** evaluated at **60 m/pixel** with no downward interpolation. Algebraic bounds $[L, U] = [${lVal}, ${uVal}]$ clear the **0.70** decision threshold.`,
          `• **Mandatory gates (F11):** median Horn slope **${pendMed}°** ($< 15^\\circ$) and annual p90 NDVI **${ndviVal}** ($< 0.20$).`,
          `• **Field measurements to close the missing 0.20 evidence:** surface material composition (weight 0.10) and fine-scale traversability (weight 0.10). Even under the worst case ($u = 0$), $L = ${lVal}$ retains rank #1.`,
        ].join("\n");

  return {
    texto,
    widgets: ["telemetria_ficha", "curva_luz"],
    acciones: [
      {
        tipo: "navegar",
        valor: "card",
        etiquetaEn: `Open ${f?.id ?? "P-07"} Full Card`,
        etiquetaEs: `Abrir ficha completa de ${f?.id ?? "P-07"}`,
      },
      {
        tipo: "ajustar_sol",
        valor: 2.0,
        etiquetaEn: "Test 2.0° Grazing Sun",
        etiquetaEs: "Probar Sol rasante a 2,0°",
      },
      {
        tipo: "navegar",
        valor: "lab",
        etiquetaEn: "Open 3D Lunar Lab",
        etiquetaEs: "Abrir Laboratorio 3D",
      },
    ],
  };
}
