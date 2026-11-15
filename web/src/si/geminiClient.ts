import {
  ContextoSI,
  ResultadoVerificacionSI,
  respuestaDeterministaSI,
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
  etiquetaEn: string;
  etiquetaEs: string;
  api: "generateContent" | "interactions";
}

export const MODELOS_GEMINI: ModeloGeminiInfo[] = [
  {
    id: "gemini-2.5-flash",
    nombre: "Gemini 2.5 Flash (Recommended · Free Tier)",
    etiquetaEn: "Best free model on Google AI Studio (fast reasoning, 1M context, 1,500 req/day free)",
    etiquetaEs: "Mejor modelo gratuito en Google AI Studio (razonamiento rápido, 1M contexto, 1.500 req/día gratis)",
    api: "generateContent",
  },
  {
    id: "gemini-2.5-flash-lite",
    nombre: "Gemini 2.5 Flash-Lite (Max Free Quota)",
    etiquetaEn: "Fastest & highest free quota on Google AI Studio for rapid Q&A",
    etiquetaEs: "El más veloz y con mayor cuota gratuita en Google AI Studio",
    api: "generateContent",
  },
  {
    id: "gemini-4-hydrogen",
    nombre: "Gemini 4 Hydrogen (Interactions API)",
    etiquetaEn: "Next-gen 1M context model via v1/interactions (falls back to 2.5 Flash if needed)",
    etiquetaEs: "Modelo 1M vía v1/interactions (con respaldo automático a 2.5 Flash)",
    api: "interactions",
  },
  {
    id: "gemini-3.5-flash-lite",
    nombre: "Gemini 3.5 Flash-Lite (Interactions API)",
    etiquetaEn: "High-throughput lightweight model via v1/interactions",
    etiquetaEs: "Modelo liviano de alta velocidad vía v1/interactions",
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
    const guardado = localStorage.getItem(STORAGE_KEY_MODEL) as GeminiModelId | null;
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
  const fichaResumen = f
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
          dimensiones: f.dimensiones,
          horario: f.horario,
          no_transfiere: f.no_transfiere,
          medir_primero: f.medir_primero,
          resumen: f.resumen,
        },
        null,
        2,
      )
    : "null";

  return [
    "You are the TERRA-X SI (Super Intelligence) scientific guide for the 2026 NASA Space Apps Challenge.",
    "STRICT COMPLIANCE RULES (NEVER VIOLATE):",
    "1. Always write 'SI' (Super Intelligence), NEVER write 'AI' or 'IA'.",
    "2. You ONLY explain precomputed deterministic data; you NEVER calculate new scores or invent any number.",
    "3. Every single number you mention MUST come strictly from the VERIFIED CONTEXT below. If a value is not in the context, state that it is 'Unknown' ('Desconocido') and reduces evidence E.",
    "4. NEVER say 'X% similar to the Moon' or 'X% similar to Mars'. Always explain Compatibility (C) and Evidence (E) separately, with decision bounds L = C * E and U = L + (1 - E).",
    "5. NEVER claim an Earth test certifies a lunar mission or reproduces lunar gravity (1/6 g) or vacuum.",
    "6. Keep answers concise (3 to 6 short bullet points or sentences), clear for non-specialists, and respond in " +
      (lang === "es" ? "Spanish (español)." : "English."),
    "",
    "=== VERIFIED CONTEXT ===",
    `- Current UI screen: ${ctx.pagina}`,
    `- Current Sun elevation slider: ${ctx.elevacionSolDeg} deg (0.5 m vertical board casts ${(0.5 / Math.tan((ctx.elevacionSolDeg * Math.PI) / 180)).toFixed(2)} m geometric shadow)`,
    `- Common terrain scale: 60 m per pixel without downward interpolation (LOLA 20 m averaged in 3x3 blocks; Copernicus GLO-30 average-resampled to 60 m UTM).`,
    `- Parcel size: 3 x 3 km (50 x 50 pixels) with 30 km relief margin for horizon raycasting (72 azimuths for terrain footprint, 360 azimuths for rover).`,
    `- Grazing-light comparison range: Sun elevation from 1.5 deg to 10 deg in 0.5 deg steps (F16).`,
    `- Roughness windows (F9): circular plane-detrended RMS residuals at 200, 400, 800, and 1600 m.`,
    `- Lunar destination: Mons Mouton (84.6 deg S, 31.0 deg E, 30 x 30 km crop at 60 m).`,
    `- Rover template (NASA VIPER public figures): 320 W solar panels on 3 sides, 5420 Wh battery, 50 h survival without Sun (108.4 W survival power draw, F6).`,
    `- Validated lunar results: Spearman correlation 0.985 and RMSE 2.5 percentage points against NASA LOLA AVGVISIB (10000 points). In the central 30 x 30 km crop, minimum continuous darkness is 424 h in summer and 622 h in winter (0% refuges under 50 h threshold; 85% sunlit ridges lie ~20 to 24 km west).`,
    `- Active Candidate Card JSON:\n${fichaResumen}`,
  ].join("\n");
}

async function llamarGenerateContent(
  apiKey: string,
  modelo: string,
  instruccionSistema: string,
  mensajeUsuario: string,
  historial: { rol: "user" | "model"; texto: string }[],
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelo,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
        maxOutputTokens: 700,
      },
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Gemini API (${resp.status}): ${errBody.slice(0, 180)}`);
  }

  const data = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const texto =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!texto) {
    throw new Error("Empty response from Gemini generateContent");
  }
  return texto;
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

export interface RespuestaChatSI {
  texto: string;
  origen: "gemini-api" | "determinista-local" | "respaldo-verificado";
  modeloUsado: string;
  verificacion: ResultadoVerificacionSI;
  aviso?: string;
}

export async function consultarSI(
  pregunta: string,
  ctx: ContextoSI,
  lang: "en" | "es",
  historial: { rol: "user" | "model"; texto: string }[],
  apiKeyOverride?: string,
  modeloOverride?: GeminiModelId,
): Promise<RespuestaChatSI> {
  const apiKey = (apiKeyOverride ?? obtenerApiKeyGuardada()).trim();
  const modelo = modeloOverride ?? obtenerModeloGuardado();

  // Si no hay API key cargada todavía, respondemos con el motor determinista verificado (Opción C Doc 04)
  if (!apiKey) {
    const textoLocal = respuestaDeterministaSI(pregunta, ctx, lang);
    return {
      texto: textoLocal,
      origen: "determinista-local",
      modeloUsado: "deterministic-verified",
      verificacion: verificarRespuestaSI(textoLocal, ctx),
    };
  }

  const instruccion = construirInstruccionSistema(ctx, lang);
  let textoGenerado = "";
  let modeloReal: string = modelo;

  try {
    const infoModelo = MODELOS_GEMINI.find((m) => m.id === modelo);
    if (infoModelo?.api === "interactions") {
      try {
        textoGenerado = await llamarInteractionsApi(
          apiKey,
          modelo,
          instruccion,
          pregunta,
        );
      } catch {
        // Respaldo automático a gemini-2.5-flash en generateContent si la clave gratuita de AI Studio no tiene v1/interactions activo
        modeloReal = "gemini-2.5-flash";
        textoGenerado = await llamarGenerateContent(
          apiKey,
          "gemini-2.5-flash",
          instruccion,
          pregunta,
          historial,
        );
      }
    } else {
      textoGenerado = await llamarGenerateContent(
        apiKey,
        modelo,
        instruccion,
        pregunta,
        historial,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const respaldo = respuestaDeterministaSI(pregunta, ctx, lang);
    return {
      texto: respaldo,
      origen: "respaldo-verificado",
      modeloUsado: "deterministic-fallback",
      verificacion: verificarRespuestaSI(respaldo, ctx),
      aviso:
        lang === "es"
          ? `No se pudo conectar con Gemini (${msg}). Se muestra la explicación determinista verificada.`
          : `Could not reach Gemini (${msg}). Showing the verified deterministic explanation.`,
    };
  }

  // Pasamos el texto de Gemini por el verificador determinista (Doc 04 §8)
  const verif = verificarRespuestaSI(textoGenerado, ctx);
  if (!verif.valido) {
    const respaldo = respuestaDeterministaSI(pregunta, ctx, lang);
    return {
      texto: respaldo,
      origen: "respaldo-verificado",
      modeloUsado: modeloReal,
      verificacion: verificarRespuestaSI(respaldo, ctx),
      aviso:
        lang === "es"
          ? `El verificador SI bloqueó una cifra no presente en la ficha (${verif.resumenVerificacion}). Se muestra la explicación verificada.`
          : `SI verifier blocked a number not present in the card (${verif.resumenVerificacion}). Showing the verified explanation.`,
    };
  }

  return {
    texto: textoGenerado,
    origen: "gemini-api",
    modeloUsado: modeloReal,
    verificacion: verif,
  };
}
