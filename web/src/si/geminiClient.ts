import {
  AccionRapidaSI,
  ContextoSI,
  ResultadoVerificacionSI,
  WidgetTipoSI,
  extraerDetalleFuente,
  respuestaDeterministaRica,
  verificarRespuestaSI,
} from "./verificadorSI";

export type GeminiModelId =
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite"
  | "gemini-4-hydrogen"
  | "gemini-3.5-flash-lite";

export interface ModeloGeminiInfo {
  id: GeminiModelId;
  nombre: string;
  badge: string;
  etiquetaEn: string;
  etiquetaEs: string;
  api: "generateContent" | "interactions";
}

export const MODELOS_GEMINI: ModeloGeminiInfo[] = [
  {
    id: "gemini-2.5-flash",
    nombre: "Gemini 2.5 Flash",
    badge: "RECOMMENDED · FREE TIER",
    etiquetaEn:
      "Best free model on Google AI Studio: fast reasoning, 1M context, SSE streaming, up to 1,500 free req/day",
    etiquetaEs:
      "Mejor modelo gratuito en Google AI Studio: razonamiento rápido, 1M contexto, streaming SSE, 1.500 req/día gratis",
    api: "generateContent",
  },
  {
    id: "gemini-2.5-flash-lite",
    nombre: "Gemini 2.5 Flash-Lite",
    badge: "MAX FREE QUOTA",
    etiquetaEn:
      "Lowest latency and highest free daily quota on Google AI Studio",
    etiquetaEs:
      "Menor latencia y máxima cuota diaria gratuita en Google AI Studio",
    api: "generateContent",
  },
  {
    id: "gemini-4-hydrogen",
    nombre: "Gemini 4 Hydrogen",
    badge: "INTERACTIONS API",
    etiquetaEn:
      "Next-gen 1M unified context via v1/interactions (auto-falls back to 2.5 Flash if needed)",
    etiquetaEs:
      "Contexto unificado 1M vía v1/interactions (cae automáticamente a 2.5 Flash si hace falta)",
    api: "interactions",
  },
  {
    id: "gemini-3.5-flash-lite",
    nombre: "Gemini 3.5 Flash-Lite",
    badge: "FAST · INTERACTIONS",
    etiquetaEn: "High-throughput lightweight model via v1/interactions",
    etiquetaEs: "Modelo liviano de alto rendimiento vía v1/interactions",
    api: "interactions",
  },
];

const STORAGE_KEY_API = "terrax_gemini_api_key";
const STORAGE_KEY_MODEL = "terrax_gemini_model";

export function obtenerApiKeyGuardada(): string {
  try {
    const local = localStorage.getItem(STORAGE_KEY_API)?.trim();
    if (local) return local;
  } catch {
    // ignore storage errors
  }
  const envKey = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env?.VITE_GEMINI_API_KEY;
  return envKey?.trim() ?? "";
}

export function guardarApiKey(key: string): void {
  try {
    const limpia = key.trim();
    if (limpia) {
      localStorage.setItem(STORAGE_KEY_API, limpia);
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
  } catch {
    // ignore storage errors
  }
}

export function obtenerModeloGuardado(): GeminiModelId {
  try {
    const guardado = localStorage.getItem(
      STORAGE_KEY_MODEL,
    ) as GeminiModelId | null;
    if (guardado && MODELOS_GEMINI.some((m) => m.id === guardado)) {
      return guardado;
    }
  } catch {
    // ignore
  }
  return "gemini-2.5-flash";
}

export function guardarModelo(modelo: GeminiModelId): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODEL, modelo);
  } catch {
    // ignore
  }
}

export function construirInstruccionSistema(
  ctx: ContextoSI,
  lang: "en" | "es",
): string {
  const f = ctx.ficha;
  const det = extraerDetalleFuente(f);

  const fichaCompleta = f
    ? JSON.stringify(
        {
          id: f.id,
          etiqueta: f.etiqueta,
          maqueta: f.maqueta,
          lugar: f.lugar,
          C: f.C,
          E: f.E,
          L: f.L,
          U: f.U,
          requisitos: det?.requisitos ?? null,
          propiedades: det?.propiedades ?? null,
          robustez: det?.robustez ?? null,
          dimensiones: f.dimensiones,
          horario_muestra: f.horario.slice(0, 4),
          no_transfiere: f.no_transfiere,
          medir_primero: f.medir_primero,
          resumen: f.resumen,
        },
        null,
        2,
      )
    : "null";

  return [
    "You are the TERRA-X Mission SI (Super Intelligence) Console for the 2026 NASA Space Apps Challenge.",
    "STRICT SCIENTIFIC & HACKATHON RULES (NEVER VIOLATE):",
    "1. Always write 'SI' (Super Intelligence), NEVER write 'AI' or 'IA'.",
    "2. You ONLY explain precomputed deterministic physics data; you NEVER calculate new rankings or invent numbers.",
    "3. Every number in your output MUST appear in the VERIFIED TELEMETRY below. An automated post-processor extracts every number you write and blocks your response if any number is unverified.",
    "4. NEVER write 'X% similar to the Moon' or 'X% similar to Mars'. Always separate Compatibility (C) and Evidence (E) with algebraic bounds L = C * E and U = L + (1 - E).",
    "5. NEVER claim an Earth site reproduces lunar gravity (1/6 g), vacuum, or certifies a lunar mission.",
    "6. Respond in " +
      (lang === "es" ? "Spanish (español)" : "English") +
      " using 3 to 5 crisp, technical bullet points (`• **Heading:** ...`).",
    "7. At the very end of your response, you MAY append 1 or 2 interactive tags on their own line from this exact list when relevant:",
    "   [WIDGET:TELEMETRY] (shows the interactive C/E/[L,U] & property breakdown card)",
    "   [WIDGET:LIGHT_CURVE] (shows the interactive 1.5°–10° grazing-light curve SVG)",
    "   [WIDGET:RANKING] (shows the interactive candidate & control ranking table)",
    "   [ACTION:NAVIGATE:lab] | [ACTION:NAVIGATE:compare] | [ACTION:NAVIGATE:card] | [ACTION:NAVIGATE:explore]",
    "   [ACTION:SELECT_CANDIDATE:P-07] | [ACTION:SELECT_CANDIDATE:P-09] | [ACTION:SELECT_CANDIDATE:CTRL-MEDANOS]",
    "   [ACTION:SET_SUN:1.5] | [ACTION:SET_SUN:3.5] | [ACTION:SET_SUN:7.0]",
    "",
    "=== VERIFIED TELEMETRY ===",
    `- Active screen: ${ctx.pagina} | Current Sun slider: ${ctx.elevacionSolDeg} deg (0.5 m board shadow = ${(0.5 / Math.tan((ctx.elevacionSolDeg * Math.PI) / 180)).toFixed(2)} m)`,
    "- Common scale: 60 m/pixel without downward interpolation (LOLA 20 m averaged in 3x3 blocks; Copernicus GLO-30 average-resampled to 60 m UTM). Parcels are 3 x 3 km (50 x 50 px) with 30 km relief margin.",
    "- Formulas F1–F20: Horn 3x3 slope (F8), circular plane-detrended RMS roughness at 200, 400, 800, 1600 m (F9), azimuth-averaged shadow fraction f_bar(e) from 1.5 deg to 10 deg every 0.5 deg over 72 azimuths (F16), IQR-normalized Wasserstein W1 over 101 quantiles (F14, F15), bounds L = C*E and U = L + (1 - E) (F17, F18).",
    "- Lunar destination: Mons Mouton (84.6 deg S, 31.0 deg E, 30 x 30 km crop at 60 m). Rover template (NASA VIPER): 320 W solar panels on 3 sides, 5420 Wh battery, 50 h darkness survival limit (108.4 W survival draw, F6).",
    "- Validated lunar results: Spearman correlation 0.985 and RMSE 2.5 percentage points against NASA LOLA AVGVISIB (10000 points). In central 30 x 30 km Mons Mouton crop, shortest continuous night is 424 h in summer and 622 h in winter (0% refuges under 50 h limit; 85% sunlit ridges lie 20 to 24 km west).",
    "- Candidate ranking in indice.json (threshold 0.70): #1 CTRL-MM (C=1.0, E=0.8, L=0.80, U=1.00, positive control), #2 P-07 (C=0.8863, E=0.8, L=0.709, U=0.909, supported analog, 100% #1 across 1000 Dirichlet alpha=100 perturbations), #3 CTRL-MM-R1 (C=0.7917, L=0.6333, U=0.8333), #4 P-09 (C=0.714, E=0.8, L=0.5712, U=0.7712, with gaps), #5 CTRL-MM-R2 (C=0.6317, L=0.5053, U=0.7053), #6 P-19 (C=0.6247, L=0.4997, U=0.6997), #7 P-23 (C=0.6055, L=0.4844, U=0.6844), #8 CTRL-MM-R3 (C=0.5078, L=0.4062, U=0.6062), #9 P-01 (C=0.2249), #10 P-15 (C=0.1234), #11 P-03 (C=0.118), #12 P-12 (C=0.1142), CTRL-MEDANOS (C=0.9183 relief, rejected as incompatible due to vegetation NDVI > 0.20).",
    `- Active Candidate Card:\n${fichaCompleta}`,
  ].join("\n");
}

function extraerEtiquetasAccion(
  textoCrudo: string,
  widgetsPorDefecto: WidgetTipoSI[],
  accionesPorDefecto: AccionRapidaSI[],
): {
  textoLimpio: string;
  widgets: WidgetTipoSI[];
  acciones: AccionRapidaSI[];
} {
  const widgets = new Set<WidgetTipoSI>();
  const acciones: AccionRapidaSI[] = [];

  if (/\[WIDGET:TELEMETRY\]/i.test(textoCrudo)) widgets.add("telemetria_ficha");
  if (/\[WIDGET:LIGHT_CURVE\]/i.test(textoCrudo)) widgets.add("curva_luz");
  if (/\[WIDGET:RANKING\]/i.test(textoCrudo)) widgets.add("ranking_controles");

  const navMatches = textoCrudo.matchAll(/\[ACTION:NAVIGATE:([a-z]+)\]/gi);
  for (const m of navMatches) {
    const dest = m[1].toLowerCase();
    const labels: Record<string, [string, string]> = {
      lab: ["Open 3D Lunar Lab", "Abrir Laboratorio Lunar 3D"],
      compare: ["Open Two Worlds 3D", "Abrir Dos Mundos 3D"],
      card: ["Open Candidate Card", "Abrir Ficha Candidata"],
      explore: ["Browse Candidates", "Explorar Candidatas"],
      checks: ["Open Verification", "Abrir Verificación"],
    };
    const [en, es] = labels[dest] ?? [`Go to ${dest}`, `Ir a ${dest}`];
    acciones.push({ tipo: "navegar", valor: dest, etiquetaEn: en, etiquetaEs: es });
  }

  const candMatches = textoCrudo.matchAll(
    /\[ACTION:SELECT_CANDIDATE:([A-Z0-9-]+)\]/gi,
  );
  for (const m of candMatches) {
    const id = m[1].toUpperCase();
    acciones.push({
      tipo: "seleccionar_candidata",
      valor: id,
      etiquetaEn: `Load ${id}`,
      etiquetaEs: `Cargar ${id}`,
    });
  }

  const sunMatches = textoCrudo.matchAll(/\[ACTION:SET_SUN:([\d.]+)\]/gi);
  for (const m of sunMatches) {
    const deg = Number(m[1]);
    if (Number.isFinite(deg) && deg >= 1.5 && deg <= 10) {
      acciones.push({
        tipo: "ajustar_sol",
        valor: deg,
        etiquetaEn: `Set Sun to ${deg}°`,
        etiquetaEs: `Sol a ${deg}°`,
      });
    }
  }

  const textoLimpio = textoCrudo
    .replace(/\[WIDGET:[^\]]+\]/gi, "")
    .replace(/\[ACTION:[^\]]+\]/gi, "")
    .trim();

  return {
    textoLimpio,
    widgets:
      widgets.size > 0 ? Array.from(widgets) : widgetsPorDefecto.slice(0, 1),
    acciones: acciones.length > 0 ? acciones : accionesPorDefecto,
  };
}

async function llamarStreamGenerateContent(
  apiKey: string,
  modelo: string,
  instruccionSistema: string,
  mensajeUsuario: string,
  historial: { rol: "user" | "model"; texto: string }[],
  onDelta?: (acumulado: string) => void,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelo,
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const contents = [
    ...historial.slice(-6).map((h) => ({
      role: h.rol,
      parts: [{ text: h.texto }],
    })),
    {
      role: "user",
      parts: [{ text: mensajeUsuario }],
    },
  ];

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: instruccionSistema }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: 750,
      },
    }),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 140)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let acumulado = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lineas = buffer.split("\n");
    buffer = lineas.pop() ?? "";

    for (const linea of lineas) {
      const trim = linea.trim();
      if (!trim.startsWith("data:")) continue;
      const jsonStr = trim.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const chunk = JSON.parse(jsonStr) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const delta =
          chunk.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("") ?? "";
        if (delta) {
          acumulado += delta;
          if (onDelta) {
            onDelta(
              acumulado
                .replace(/\[WIDGET:[^\]]*\]?/gi, "")
                .replace(/\[ACTION:[^\]]*\]?/gi, "")
                .trim(),
            );
          }
        }
      } catch {
        // ignore partial JSON line
      }
    }
  }

  if (!acumulado.trim()) {
    throw new Error("Empty SSE stream from Gemini");
  }
  return acumulado.trim();
}

async function llamarInteractionsApi(
  apiKey: string,
  modelo: string,
  instruccionSistema: string,
  mensajeUsuario: string,
): Promise<string> {
  const url = "https://generativelanguage.googleapis.com/v1/interactions";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      "Api-Revision": "2026-05-20",
    },
    body: JSON.stringify({
      model: modelo,
      system_instruction: instruccionSistema,
      input: mensajeUsuario,
      store: false,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Interactions API status ${resp.status}`);
  }

  const data = (await resp.json()) as {
    output_text?: string;
    steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const steps = data.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type === "model_output") {
      const txt = steps[i].content
        ?.map((c) => c.text ?? "")
        .join("")
        .trim();
      if (txt) return txt;
    }
  }
  throw new Error("Empty response from Gemini Interactions API");
}

export async function probarConexionGemini(
  apiKey: string,
  modelo: GeminiModelId,
): Promise<{ ok: boolean; latenciaMs: number; modeloUsado: string; detalle: string }> {
  const limpia = apiKey.trim();
  if (!limpia) {
    return {
      ok: false,
      latenciaMs: 0,
      modeloUsado: modelo,
      detalle: "API Key is empty",
    };
  }
  const t0 = performance.now();
  try {
    const modeloEfectivo =
      modelo === "gemini-4-hydrogen" || modelo === "gemini-3.5-flash-lite"
        ? "gemini-2.5-flash"
        : modelo;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modeloEfectivo,
    )}:generateContent?key=${encodeURIComponent(limpia)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply OK" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    const latenciaMs = Math.round(performance.now() - t0);
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return {
        ok: false,
        latenciaMs,
        modeloUsado: modeloEfectivo,
        detalle: `HTTP ${resp.status}: ${body.slice(0, 100)}`,
      };
    }
    return {
      ok: true,
      latenciaMs,
      modeloUsado: modeloEfectivo,
      detalle: `Connected (${latenciaMs} ms)`,
    };
  } catch (err) {
    return {
      ok: false,
      latenciaMs: Math.round(performance.now() - t0),
      modeloUsado: modelo,
      detalle: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface RespuestaChatSI {
  texto: string;
  origen: "gemini-api" | "determinista-local" | "respaldo-verificado";
  modeloUsado: string;
  latenciaMs: number;
  verificacion: ResultadoVerificacionSI;
  widgets: WidgetTipoSI[];
  acciones: AccionRapidaSI[];
  aviso?: string;
}

export async function consultarSI(
  pregunta: string,
  ctx: ContextoSI,
  lang: "en" | "es",
  historial: { rol: "user" | "model"; texto: string }[],
  apiKeyOverride?: string,
  modeloOverride?: GeminiModelId,
  onDelta?: (parcial: string) => void,
): Promise<RespuestaChatSI> {
  const t0 = performance.now();
  const apiKey = (apiKeyOverride ?? obtenerApiKeyGuardada()).trim();
  const modelo = modeloOverride ?? obtenerModeloGuardado();
  const baseLocal = respuestaDeterministaRica(pregunta, ctx, lang);

  if (!apiKey) {
    return {
      texto: baseLocal.texto,
      origen: "determinista-local",
      modeloUsado: "deterministic-verified",
      latenciaMs: Math.max(1, Math.round(performance.now() - t0)),
      verificacion: verificarRespuestaSI(baseLocal.texto, ctx),
      widgets: baseLocal.widgets,
      acciones: baseLocal.acciones,
    };
  }

  const instruccion = construirInstruccionSistema(ctx, lang);
  let textoCrudo = "";
  let modeloReal: string = modelo;

  try {
    const infoModelo = MODELOS_GEMINI.find((m) => m.id === modelo);
    if (infoModelo?.api === "interactions") {
      try {
        textoCrudo = await llamarInteractionsApi(
          apiKey,
          modelo,
          instruccion,
          pregunta,
        );
      } catch {
        modeloReal = "gemini-2.5-flash";
        textoCrudo = await llamarStreamGenerateContent(
          apiKey,
          "gemini-2.5-flash",
          instruccion,
          pregunta,
          historial,
          onDelta,
        );
      }
    } else {
      textoCrudo = await llamarStreamGenerateContent(
        apiKey,
        modelo,
        instruccion,
        pregunta,
        historial,
        onDelta,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      texto: baseLocal.texto,
      origen: "respaldo-verificado",
      modeloUsado: "deterministic-fallback",
      latenciaMs: Math.round(performance.now() - t0),
      verificacion: verificarRespuestaSI(baseLocal.texto, ctx),
      widgets: baseLocal.widgets,
      acciones: baseLocal.acciones,
      aviso:
        lang === "es"
          ? `Fallo de conexión con Gemini (${msg}). Se muestra la telemetría determinista verificada.`
          : `Gemini connection error (${msg}). Showing verified deterministic telemetry.`,
    };
  }

  const { textoLimpio, widgets, acciones } = extraerEtiquetasAccion(
    textoCrudo,
    baseLocal.widgets,
    baseLocal.acciones,
  );

  const verif = verificarRespuestaSI(textoLimpio, ctx);
  if (!verif.valido) {
    return {
      texto: baseLocal.texto,
      origen: "respaldo-verificado",
      modeloUsado: modeloReal,
      latenciaMs: Math.round(performance.now() - t0),
      verificacion: verificarRespuestaSI(baseLocal.texto, ctx),
      widgets: baseLocal.widgets,
      acciones: baseLocal.acciones,
      aviso:
        lang === "es"
          ? `El verificador SI interceptó una cifra fuera de la ficha (${verif.resumenVerificacion}). Se reemplazó por la explicación determinista verificada.`
          : `SI verifier intercepted an out-of-card figure (${verif.resumenVerificacion}). Replaced with verified deterministic telemetry.`,
    };
  }

  return {
    texto: textoLimpio,
    origen: "gemini-api",
    modeloUsado: modeloReal,
    latenciaMs: Math.round(performance.now() - t0),
    verificacion: verif,
    widgets,
    acciones,
  };
}
