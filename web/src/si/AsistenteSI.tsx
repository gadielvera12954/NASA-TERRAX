import React, { useEffect, useRef, useState } from "react";
import { Ficha, Manifest } from "../datos/contract";
import {
  GeminiModelId,
  MODELOS_GEMINI,
  RespuestaChatSI,
  consultarSI,
  guardarApiKey,
  guardarModelo,
  obtenerApiKeyGuardada,
  obtenerModeloGuardado,
} from "./geminiClient";
import { ContextoSI } from "./verificadorSI";
import "./asistente-si.css";

interface MensajeUI {
  id: string;
  rol: "user" | "assistant";
  texto: string;
  meta?: RespuestaChatSI;
}

export interface AsistenteSIProps {
  pagina: string;
  ficha?: Ficha;
  manifest?: Manifest;
  elevacionSolDeg: number;
  motorEnVivo?: boolean;
  idioma: "en" | "es";
  onNavegar?: (destino: string) => void;
}

function renderTextoSimple(texto: string): React.ReactNode {
  const lineas = texto.split("\n").filter((l) => l.trim().length > 0);
  return lineas.map((linea, idx) => {
    const partes = linea.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <p key={idx}>
        {partes.map((p, i) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return <strong key={i}>{p.slice(2, -2)}</strong>;
          }
          if (p.startsWith("`") && p.endsWith("`")) {
            return <code key={i}>{p.slice(1, -1)}</code>;
          }
          return <React.Fragment key={i}>{p}</React.Fragment>;
        })}
      </p>
    );
  });
}

export const AsistenteSI: React.FC<AsistenteSIProps> = ({
  pagina,
  ficha,
  manifest,
  elevacionSolDeg,
  motorEnVivo,
  idioma,
  onNavegar,
}) => {
  const es = idioma === "es";
  const [abierto, setAbierto] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => obtenerApiKeyGuardada());
  const [borradorKey, setBorradorKey] = useState<string>(() =>
    obtenerApiKeyGuardada(),
  );
  const [modelo, setModelo] = useState<GeminiModelId>(() =>
    obtenerModeloGuardado(),
  );
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeUI[]>([]);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctx: ContextoSI = {
    pagina,
    ficha,
    manifest,
    elevacionSolDeg,
    motorEnVivo,
  };

  useEffect(() => {
    if (abierto) {
      finRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes, abierto]);

  useEffect(() => {
    const alPresionarEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && abierto) {
        setAbierto(false);
      }
    };
    window.addEventListener("keydown", alPresionarEsc);
    return () => window.removeEventListener("keydown", alPresionarEsc);
  }, [abierto]);

  const enviarPregunta = async (textoPregunta: string) => {
    const limpia = textoPregunta.trim();
    if (!limpia || cargando) return;

    const msgUsuario: MensajeUI = {
      id: `u-${Date.now()}`,
      rol: "user",
      texto: limpia,
    };

    const historialPrevio = mensajes.map((m) => ({
      rol: m.rol === "user" ? ("user" as const) : ("model" as const),
      texto: m.texto,
    }));

    setMensajes((prev) => [...prev, msgUsuario]);
    setEntrada("");
    setCargando(true);

    try {
      const resp = await consultarSI(
        limpia,
        ctx,
        idioma,
        historialPrevio,
        apiKey,
        modelo,
      );
      const msgAsistente: MensajeUI = {
        id: `a-${Date.now()}`,
        rol: "assistant",
        texto: resp.texto,
        meta: resp,
      };
      setMensajes((prev) => [...prev, msgAsistente]);
    } finally {
      setCargando(false);
    }
  };

  const preguntasSugeridas = es
    ? [
        `Explicá la ficha ${ficha?.id ?? "P-07"} (C, E y límites L–U)`,
        "¿Por qué hay 0% de refugios en el centro de Mons Mouton?",
        "¿Qué no se transfiere de la Tierra a la Luna?",
        "¿Qué hay que medir primero en campo?",
        "¿Cómo funcionan la escala de 60 m y las 20 fórmulas?",
      ]
    : [
        `Explain candidate ${ficha?.id ?? "P-07"} (C, E & L–U bounds)`,
        "Why 0% refuges in central Mons Mouton?",
        "What does not transfer from Earth to the Moon?",
        "What should we measure first in the field?",
        "How do the 60 m scale and 20 formulas work?",
      ];

  const atajosNavegacion = [
    { id: "explore", label: es ? "Ir a Explorar" : "Go to Explore" },
    { id: "card", label: es ? `Abrir ficha ${ficha?.id ?? "P-07"}` : `Open ${ficha?.id ?? "P-07"} Card` },
    { id: "compare", label: es ? "Comparar 2 Mundos" : "Compare 2 Worlds" },
    { id: "lab", label: es ? "Laboratorio 3D" : "3D Lunar Lab" },
    { id: "checks", label: es ? "Verificación" : "Verification" },
  ];

  const tieneKey = Boolean(apiKey.trim());
  const infoModeloActual =
    MODELOS_GEMINI.find((m) => m.id === modelo) ?? MODELOS_GEMINI[0];

  return (
    <>
      <button
        type="button"
        className="si-fab"
        aria-expanded={abierto}
        aria-controls="terrax-si-assistant"
        onClick={() => {
          const siguiente = !abierto;
          setAbierto(siguiente);
          if (siguiente) {
            setTimeout(() => inputRef.current?.focus(), 80);
          }
        }}
      >
        <span
          className={`si-fab-dot ${tieneKey ? "live" : ""}`}
          aria-hidden="true"
        />
        <span>{es ? "Asistente SI" : "SI Guide"}</span>
        <span className="si-fab-badge">
          {tieneKey ? modelo.replace("gemini-", "") : es ? "Verificado" : "Verified"}
        </span>
      </button>

      <aside
        id="terrax-si-assistant"
        className="si-panel"
        data-open={abierto ? "true" : "false"}
        aria-label={
          es
            ? "Asistente SI (Super Intelligence) de TERRA-X"
            : "TERRA-X SI (Super Intelligence) Assistant"
        }
      >
        <div className="si-header">
          <div className="si-title-group">
            <h2 className="si-title">
              <span>TERRA-X · SI GUIDE</span>
            </h2>
            <span className="si-subtitle">
              {tieneKey
                ? `${infoModeloActual.id} · ${es ? "Verificador activo" : "Fact-checker active"}`
                : es
                  ? "Modo determinista verificado · Listo para API Key"
                  : "Verified deterministic mode · Ready for API Key"}
            </span>
          </div>
          <div className="si-header-actions">
            <button
              type="button"
              className={`si-icon-btn ${tieneKey ? "key-active" : ""}`}
              onClick={() => setMostrarConfig((v) => !v)}
              title={
                es
                  ? "Configurar API Key gratuita de Google Gemini y elegir modelo"
                  : "Configure free Google Gemini API Key and choose model"
              }
            >
              🔑 {tieneKey ? (es ? "Key activa" : "Key active") : "API Key"}
            </button>
            <button
              type="button"
              className="si-icon-btn"
              onClick={() => setAbierto(false)}
              aria-label={es ? "Cerrar asistente SI" : "Close SI assistant"}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="si-context-bar">
          <span>
            {es ? "Ficha:" : "Card:"}{" "}
            <strong>{ficha ? `${ficha.id} (${ficha.lugar.nombre})` : "P-07"}</strong>
          </span>
          {ficha && (
            <span>
              C=<strong>{ficha.C?.toFixed(2) ?? "—"}</strong> · E=
              <strong>{ficha.E.toFixed(2)}</strong> · [
              <strong>
                {ficha.L.toFixed(2)}–{ficha.U.toFixed(2)}
              </strong>
              ]
            </span>
          )}
          <span>
            {es ? "Sol:" : "Sun:"} <strong>{elevacionSolDeg}°</strong>
          </span>
        </div>

        {mostrarConfig && (
          <div className="si-config-drawer">
            <label>
              {es
                ? "Google AI Studio · Gemini API Key (gratuita)"
                : "Google AI Studio · Gemini API Key (free tier)"}
              <input
                type="password"
                value={borradorKey}
                onChange={(e) => setBorradorKey(e.target.value)}
                placeholder="AIzaSy..."
                autoComplete="off"
              />
            </label>
            <label>
              {es ? "Modelo Gemini gratuito" : "Free Gemini model"}
              <select
                value={modelo}
                onChange={(e) => {
                  const nuevo = e.target.value as GeminiModelId;
                  setModelo(nuevo);
                  guardarModelo(nuevo);
                }}
              >
                {MODELOS_GEMINI.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            <p className="si-config-note">
              {es ? infoModeloActual.etiquetaEs : infoModeloActual.etiquetaEn}.{" "}
              {es
                ? "Tu clave se guarda únicamente en este navegador (localStorage) y nunca se sube al repositorio."
                : "Your key is saved only in this browser (localStorage) and never uploaded to the repository."}
            </p>
            <div className="si-config-actions">
              <button
                type="button"
                className="si-icon-btn"
                onClick={() => {
                  setBorradorKey("");
                  setApiKey("");
                  guardarApiKey("");
                }}
              >
                {es ? "Borrar clave" : "Clear key"}
              </button>
              <button
                type="button"
                className="si-send-btn"
                style={{ minHeight: "32px", padding: "0 12px" }}
                onClick={() => {
                  const limpia = borradorKey.trim();
                  setApiKey(limpia);
                  guardarApiKey(limpia);
                  setMostrarConfig(false);
                }}
              >
                {es ? "Guardar API Key" : "Save API Key"}
              </button>
            </div>
          </div>
        )}

        <div className="si-messages" role="log" aria-live="polite">
          {mensajes.length === 0 && (
            <div className="si-msg assistant">
              {renderTextoSimple(
                es
                  ? `Soy el guía **SI (Super Intelligence)** de TERRA-X. Explico las fichas candidatas, el destino lunar Mons Mouton y qué no se transfiere, **sin inventar cifras**.\n• **Modelo preseleccionado:** \`${modelo}\` (el mejor modelo gratuito de Gemini para respuestas rápidas y razonamiento sobre la ficha).\n• Tocá **🔑 API Key** arriba para pegar tu clave gratuita de Google AI Studio, o elegí una pregunta abajo.`
                  : `I am the TERRA-X **SI (Super Intelligence)** guide. I explain candidate cards, the Mons Mouton lunar destination, and non-transferable limits — **never inventing numbers**.\n• **Preselected model:** \`${modelo}\` (best free-tier Gemini model for fast grounded explanations).\n• Click **🔑 API Key** above to paste your free Google AI Studio key, or pick a question below.`,
              )}
              <div className="si-msg-meta">
                <span className="si-verif-pill">
                  ✓ {es ? "SI con correa · F1–F20" : "Leashed SI · F1–F20"}
                </span>
                <span>
                  {es ? "La SI explica; nunca calcula" : "SI explains; never computes"}
                </span>
              </div>
            </div>
          )}

          {mensajes.map((m) => (
            <div key={m.id} className={`si-msg ${m.rol}`}>
              {renderTextoSimple(m.texto)}
              {m.meta && (
                <div className="si-msg-meta">
                  <span className="si-verif-pill">
                    ✓{" "}
                    {es
                      ? `Verificado (${m.meta.verificacion.numerosExtraidos.length} cifras comprobadas)`
                      : `Verified (${m.meta.verificacion.numerosExtraidos.length} numbers checked)`}
                  </span>
                  <span>
                    {m.meta.origen === "gemini-api"
                      ? m.meta.modeloUsado
                      : es
                        ? "Motor determinista"
                        : "Deterministic engine"}
                  </span>
                </div>
              )}
              {m.meta?.aviso && (
                <div className="si-warn-note">{m.meta.aviso}</div>
              )}
            </div>
          ))}

          {cargando && (
            <div className="si-msg assistant">
              <p>
                {es
                  ? `Consultando ${tieneKey ? modelo : "ficha verificada"} y comprobando cifras contra la ficha…`
                  : `Querying ${tieneKey ? modelo : "verified card"} and checking numbers against card data…`}
              </p>
            </div>
          )}
          <div ref={finRef} />
        </div>

        <div className="si-chips" aria-label={es ? "Preguntas rápidas" : "Quick questions"}>
          {preguntasSugeridas.map((q) => (
            <button
              key={q}
              type="button"
              className="si-chip"
              onClick={() => enviarPregunta(q)}
            >
              {q}
            </button>
          ))}
        </div>

        {onNavegar && (
          <div
            className="si-nav-shortcuts"
            aria-label={es ? "Atajos de página" : "Page shortcuts"}
          >
            {atajosNavegacion.map((nav) => (
              <button
                key={nav.id}
                type="button"
                className="si-nav-btn"
                onClick={() => onNavegar(nav.id)}
              >
                {nav.label} →
              </button>
            ))}
          </div>
        )}

        <form
          className="si-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            enviarPregunta(entrada);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder={
              es
                ? `Preguntá sobre ${ficha?.id ?? "P-07"}, Mons Mouton o límites…`
                : `Ask about ${ficha?.id ?? "P-07"}, Mons Mouton, or limits…`
            }
            aria-label={
              es ? "Tu pregunta para el asistente SI" : "Your question for the SI assistant"
            }
          />
          <button
            type="submit"
            className="si-send-btn"
            disabled={cargando || !entrada.trim()}
          >
            {es ? "Preguntar" : "Ask"}
          </button>
        </form>
      </aside>
    </>
  );
};

export default AsistenteSI;
