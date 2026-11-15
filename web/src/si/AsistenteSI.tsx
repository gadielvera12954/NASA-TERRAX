import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  Compass,
  Copy,
  KeyRound,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Terminal,
  X,
} from "lucide-react";
import { Ficha, Manifest } from "../datos/contract";
import { IndexEntry } from "../datos/integration";
import {
  GeminiModelId,
  MODELOS_GEMINI,
  RespuestaChatSI,
  consultarSI,
  guardarApiKey,
  guardarModelo,
  obtenerApiKeyGuardada,
  obtenerModeloGuardado,
  probarConexionGemini,
} from "./geminiClient";
import {
  AccionRapidaSI,
  ContextoSI,
  extraerDetalleFuente,
} from "./verificadorSI";
import "./asistente-si.css";

interface TurnoChat {
  id: string;
  rol: "user" | "assistant";
  texto: string;
  meta?: RespuestaChatSI;
}

export interface AsistenteSIProps {
  pagina: string;
  ficha?: Ficha;
  manifest?: Manifest;
  indice?: IndexEntry[];
  elevacionSolDeg: number;
  motorEnVivo?: boolean;
  idioma: "en" | "es";
  onNavegar?: (destino: string) => void;
  onSeleccionarCandidata?: (id: string) => void;
  onAjustarSol?: (grados: number) => void;
}

const ESCALERA_REFERENCIA = [
  { id: "CTRL-MM", nombre: "Mons Mouton crop (Pos. Ctrl)", C: 1.0, L: 0.8, U: 1.0, etq: "Supported" },
  { id: "P-07", nombre: "Payunia P-07 (#1 Analog)", C: 0.886, L: 0.709, U: 0.909, etq: "Supported" },
  { id: "CTRL-MM-R1", nombre: "Mons Mouton +2m noise", C: 0.792, L: 0.633, U: 0.833, etq: "With gaps" },
  { id: "P-09", nombre: "Payunia P-09 (#2 Analog)", C: 0.714, L: 0.571, U: 0.771, etq: "With gaps" },
  { id: "CTRL-MM-R2", nombre: "Mons Mouton +5m noise", C: 0.632, L: 0.505, U: 0.705, etq: "With gaps" },
  { id: "P-19", nombre: "Payunia P-19", C: 0.625, L: 0.5, U: 0.7, etq: "Insufficient" },
  { id: "P-23", nombre: "Payunia P-23", C: 0.606, L: 0.484, U: 0.684, etq: "Insufficient" },
  { id: "CTRL-MM-R3", nombre: "Mons Mouton +10m noise", C: 0.508, L: 0.406, U: 0.606, etq: "Insufficient" },
  { id: "CTRL-MEDANOS", nombre: "Médanos del Chaco (Neg. Ctrl)", C: 0.918, L: 0.735, U: 0.935, etq: "Incompatible" },
];

function renderProsa(texto: string): React.ReactNode {
  const lineas = texto.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className="si-prose">
      {lineas.map((linea, idx) => {
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
      })}
    </div>
  );
}

const WidgetTelemetriaFicha: React.FC<{
  ficha?: Ficha;
  es: boolean;
}> = ({ ficha, es }) => {
  const det = extraerDetalleFuente(ficha);
  const c = ficha?.C ?? 0.886;
  const e = ficha?.E ?? 0.8;
  const l = ficha?.L ?? 0.709;
  const u = ficha?.U ?? 0.909;

  const utilPend = det?.propiedades?.pendiente?.utilidad ?? 0.955;
  const utilLuz = det?.propiedades?.luz_rasante?.utilidad ?? 0.86;
  const utilRug = det?.propiedades?.rugosidad?.utilidad ?? 0.822;

  return (
    <div className="si-widget">
      <div className="si-widget-head">
        <span>
          {ficha?.id ?? "P-07"} · {es ? "BANDA DE DECISIÓN [L, U]" : "DECISION BOUNDS [L, U]"}
        </span>
        <span>
          C={c.toFixed(3)} · E={e.toFixed(2)}
        </span>
      </div>
      <div className="si-lu-bar-wrap">
        <div className="si-lu-track" role="img" aria-label={`L=${l.toFixed(3)} to U=${u.toFixed(3)}`}>
          <div
            className="si-lu-band"
            style={{
              left: `${Math.max(0, Math.min(100, l * 100))}%`,
              width: `${Math.max(2, Math.min(100, (u - l) * 100))}%`,
            }}
          />
          <div
            className="si-lu-c-marker"
            style={{ left: `${Math.max(0, Math.min(99, c * 100))}%` }}
            title={`C = ${c.toFixed(3)}`}
          />
          <div className="si-lu-threshold" title="Threshold 0.70" />
        </div>
        <div className="si-lu-legend">
          <span>L = {l.toFixed(3)}</span>
          <span>{es ? "Umbral 0,70" : "Threshold 0.70"}</span>
          <span>U = {u.toFixed(3)}</span>
        </div>
      </div>
      <div className="si-prop-grid">
        <div className="si-prop-cell">
          <small>{es ? "Pendiente F8 (0,30)" : "Slope F8 (0.30)"}</small>
          <strong>{(utilPend * 100).toFixed(1)}%</strong>
        </div>
        <div className="si-prop-cell">
          <small>{es ? "Luz rasante F16 (0,30)" : "Grazing light F16 (0.30)"}</small>
          <strong>{(utilLuz * 100).toFixed(1)}%</strong>
        </div>
        <div className="si-prop-cell">
          <small>{es ? "Rugosidad F9 (0,20)" : "Roughness F9 (0.20)"}</small>
          <strong>{(utilRug * 100).toFixed(1)}%</strong>
        </div>
      </div>
    </div>
  );
};

const WidgetCurvaLuz: React.FC<{
  ficha?: Ficha;
  elevacionSolDeg: number;
  es: boolean;
  onAjustarSol?: (deg: number) => void;
}> = ({ ficha, elevacionSolDeg, es, onAjustarSol }) => {
  const det = extraerDetalleFuente(ficha);
  const eDeg = det?.luz_rasante?.e_deg ?? [
    1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
  ];
  const fParc = det?.luz_rasante?.f_parcela ?? [
    0.688, 0.606, 0.532, 0.465, 0.405, 0.351, 0.302, 0.259, 0.221, 0.187, 0.158, 0.132, 0.11, 0.091, 0.075, 0.061, 0.05, 0.04,
  ];
  const fRef = det?.luz_rasante?.f_referencia ?? [
    0.691, 0.605, 0.528, 0.459, 0.397, 0.341, 0.292, 0.248, 0.21, 0.177, 0.148, 0.123, 0.101, 0.083, 0.068, 0.055, 0.044, 0.035,
  ];

  const W = 380;
  const H = 108;
  const padX = 26;
  const padY = 14;
  const xOf = (deg: number) => padX + ((deg - 1.5) / 8.5) * (W - padX * 2);
  const yOf = (f: number) => H - padY - (f / 0.75) * (H - padY * 2);

  const pathParcela = eDeg
    .map((d, i) => `${i === 0 ? "M" : "L"}${xOf(d).toFixed(1)},${yOf(fParc[i] ?? 0).toFixed(1)}`)
    .join(" ");
  const pathRef = eDeg
    .map((d, i) => `${i === 0 ? "M" : "L"}${xOf(d).toFixed(1)},${yOf(fRef[i] ?? 0).toFixed(1)}`)
    .join(" ");

  const xActual = xOf(Math.max(1.5, Math.min(10, elevacionSolDeg)));

  return (
    <div className="si-widget">
      <div className="si-widget-head">
        <span>
          {es
            ? `CURVA DE SOMBRA RASANTE f̄(e) · ${ficha?.id ?? "P-07"} vs MONS MOUTON`
            : `GRAZING-LIGHT SHADOW CURVE f̄(e) · ${ficha?.id ?? "P-07"} vs MONS MOUTON`}
        </span>
        <span>{elevacionSolDeg}°</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "108px", display: "block", cursor: onAjustarSol ? "pointer" : "default" }}
        onClick={(e) => {
          if (!onAjustarSol) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          const degBruto = 1.5 + ((relX - padX) / (W - padX * 2)) * 8.5;
          const paso = Math.round(Math.max(1.5, Math.min(10, degBruto)) * 2) / 2;
          onAjustarSol(paso);
        }}
      >
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="rgba(141,173,224,0.25)" />
        <line
          x1={xActual}
          y1={padY}
          x2={xActual}
          y2={H - padY}
          stroke="#ffd166"
          strokeDasharray="3 2"
        />
        <path d={pathRef} fill="none" stroke="#9fb6dc" strokeWidth="1.8" strokeDasharray="4 3" />
        <path d={pathParcela} fill="none" stroke="#5ce1a6" strokeWidth="2.2" />
        <text x={padX} y={H - 2} fill="#7f97bf" fontSize="9" fontFamily="monospace">
          1.5° (69% shadow)
        </text>
        <text x={W - padX} y={H - 2} fill="#7f97bf" fontSize="9" fontFamily="monospace" textAnchor="end">
          10.0° (4% shadow)
        </text>
      </svg>
      <div className="si-lu-legend">
        <span style={{ color: "#5ce1a6" }}>
          — {ficha?.id ?? "P-07"} ({es ? "Tierra" : "Earth"})
        </span>
        <span style={{ color: "#9fb6dc" }}>-- Mons Mouton (LOLA 60 m)</span>
        <span>{es ? "Clic para mover el Sol" : "Click chart to move Sun"}</span>
      </div>
    </div>
  );
};

const WidgetEscaleraRanking: React.FC<{
  actualId?: string;
  es: boolean;
  onSeleccionar?: (id: string) => void;
}> = ({ actualId, es, onSeleccionar }) => {
  return (
    <div className="si-widget">
      <div className="si-widget-head">
        <span>
          {es
            ? "ESCALERA DE CONTROLES Y CANDIDATAS (CLIC PARA CARGAR)"
            : "CONTROL & CANDIDATE LADDER (CLICK TO LOAD)"}
        </span>
        <span>W₁ · 60 m</span>
      </div>
      <div className="si-rank-list">
        {ESCALERA_REFERENCIA.map((r) => (
          <button
            key={r.id}
            type="button"
            className="si-rank-row"
            data-active={actualId === r.id ? "true" : "false"}
            onClick={() => onSeleccionar?.(r.id)}
          >
            <span className="si-rank-id">{r.id}</span>
            <span>{r.nombre}</span>
            <span className="si-rank-nums">
              C={r.C.toFixed(2)} [{r.L.toFixed(2)}–{r.U.toFixed(2)}]
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const AsistenteSI: React.FC<AsistenteSIProps> = ({
  pagina,
  ficha,
  manifest,
  indice,
  elevacionSolDeg,
  motorEnVivo,
  idioma,
  onNavegar,
  onSeleccionarCandidata,
  onAjustarSol,
}) => {
  const es = idioma === "es";
  const [abierto, setAbierto] = useState(false);
  const [instantaneo, setInstantaneo] = useState(false);
  const [acoplado, setAcoplado] = useState(false);
  const [pestana, setPestana] = useState<"chat" | "escenarios" | "telemetria">("chat");
  const [mostrarKeySheet, setMostrarKeySheet] = useState(false);

  const [apiKey, setApiKey] = useState<string>(() => obtenerApiKeyGuardada());
  const [borradorKey, setBorradorKey] = useState<string>(() => obtenerApiKeyGuardada());
  const [modelo, setModelo] = useState<GeminiModelId>(() => obtenerModeloGuardado());
  const [estadoTest, setEstadoTest] = useState<{
    probando: boolean;
    ok?: boolean;
    texto?: string;
  }>({ probando: false });

  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [parcialStream, setParcialStream] = useState<string>("");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [turnos, setTurnos] = useState<TurnoChat[]>([]);

  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctx: ContextoSI = {
    pagina,
    ficha,
    manifest,
    indice,
    elevacionSolDeg,
    motorEnVivo,
  };

  useEffect(() => {
    if (abierto && pestana === "chat") {
      finRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turnos, parcialStream, abierto, pestana]);

  // Atajo de teclado Ctrl+K / Cmd+K con apertura instantánea (0ms, regla de emil-design-eng)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInstantaneo(true);
        setAbierto((prev) => {
          const sig = !prev;
          if (sig) setTimeout(() => inputRef.current?.focus(), 20);
          return sig;
        });
      } else if (e.key === "Escape" && abierto) {
        setInstantaneo(false);
        setAbierto(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  const ejecutarAccion = (acc: AccionRapidaSI) => {
    if (acc.tipo === "navegar" && onNavegar) {
      onNavegar(String(acc.valor));
    } else if (acc.tipo === "seleccionar_candidata") {
      if (onSeleccionarCandidata) {
        onSeleccionarCandidata(String(acc.valor));
      } else {
        const url = new URL(location.href);
        url.searchParams.set("candidate", String(acc.valor));
        location.href = url.toString();
      }
    } else if (acc.tipo === "ajustar_sol" && onAjustarSol) {
      onAjustarSol(Number(acc.valor));
    }
  };

  const enviarConsulta = async (preguntaTexto: string) => {
    const limpia = preguntaTexto.trim();
    if (!limpia || cargando) return;

    setPestana("chat");
    const turnoUsuario: TurnoChat = {
      id: `u-${Date.now()}`,
      rol: "user",
      texto: limpia,
    };

    const historial = turnos.map((t) => ({
      rol: t.rol === "user" ? ("user" as const) : ("model" as const),
      texto: t.texto,
    }));

    setTurnos((prev) => [...prev, turnoUsuario]);
    setEntrada("");
    setParcialStream("");
    setCargando(true);

    try {
      const resp = await consultarSI(
        limpia,
        ctx,
        idioma,
        historial,
        apiKey,
        modelo,
        (delta) => setParcialStream(delta),
      );
      setTurnos((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          rol: "assistant",
          texto: resp.texto,
          meta: resp,
        },
      ]);
    } finally {
      setParcialStream("");
      setCargando(false);
    }
  };

  const probarKey = async () => {
    const limpia = borradorKey.trim();
    setEstadoTest({
      probando: true,
      texto: es ? "Comprobando conexión con Gemini…" : "Testing Gemini connection…",
    });
    const res = await probarConexionGemini(limpia, modelo);
    if (res.ok) {
      setApiKey(limpia);
      guardarApiKey(limpia);
      setEstadoTest({
        probando: false,
        ok: true,
        texto: es
          ? `Conectado a ${res.modeloUsado} (${res.latenciaMs} ms)`
          : `Connected to ${res.modeloUsado} (${res.latenciaMs} ms)`,
      });
    } else {
      setEstadoTest({
        probando: false,
        ok: false,
        texto: res.detalle,
      });
    }
  };

  const escenariosMision = [
    {
      id: "nav-rasante",
      titulo: es
        ? "1. Navegación óptica con luz rasante (Sol a 2,0° en P-07)"
        : "1. Low-Angle Optical Navigation (2.0° Grazing Sun on P-07)",
      desc: es
        ? "Configura la parcela #1 de Payunia (P-07), ajusta el Sol a 2,0° (60,6% en sombra) y abre el desglose de telemetría."
        : "Loads #1 Payunia parcel (P-07), sets Sun elevation to 2.0° (60.6% shadow coverage), and opens the telemetry breakdown.",
      alEjecutar: () => {
        onSeleccionarCandidata?.("P-07");
        onAjustarSol?.(2.0);
        onNavegar?.("card");
        enviarConsulta(
          es
            ? "Explicá la respuesta a la luz rasante f̄(e) de P-07 a 2,0° de Sol frente a Mons Mouton"
            : "Explain the grazing-light response f̄(e) of P-07 at 2.0° Sun compared with Mons Mouton",
        );
      },
    },
    {
      id: "viper-noche",
      titulo: es
        ? "2. Supervivencia nocturna del rover VIPER (320 W / 5.420 Wh)"
        : "2. VIPER Rover Polar Night Survival (320 W / 5,420 Wh)",
      desc: es
        ? "Abre el Laboratorio Lunar 3D en Mons Mouton (84,6°S, 31,0°E) y explica por qué el centro tiene 424 h de noche en verano."
        : "Opens the 3D Lunar Lab at Mons Mouton (84.6°S, 31.0°E) and explains why the central crop has 424 h minimum summer darkness.",
      alEjecutar: () => {
        onNavegar?.("lab");
        enviarConsulta(
          es
            ? "¿Por qué hay 0% de refugios en el centro de Mons Mouton con el límite de 50 h del VIPER?"
            : "Why are there 0% refuges in central Mons Mouton under VIPER's 50 h battery limit?",
        );
      },
    },
    {
      id: "auditoria-controles",
      titulo: es
        ? "3. Auditoría de controles (CTRL-MM, R1..R3 y CTRL-MEDANOS)"
        : "3. Control Ladder Audit (CTRL-MM, R1..R3 & CTRL-MEDANOS)",
      desc: es
        ? "Muestra cómo caen las copias con ruido de 2, 5 y 10 m y por qué Médanos del Chaco queda rechazado por vegetación."
        : "Shows how the 2, 5, and 10 m noise controls degrade and why Médanos del Chaco is rejected by the NDVI gate.",
      alEjecutar: () => {
        onNavegar?.("compare");
        enviarConsulta(
          es
            ? "Comparar el ranking de todas las candidatas y controles de validación"
            : "Compare the ranking of all candidates and validation controls",
        );
      },
    },
    {
      id: "protocolo-campo",
      titulo: es
        ? "4. Protocolo de campo y verificación de sombra (tablita de 0,50 m)"
        : "4. Field Protocol & 0.50 m Board Shadow Verification",
      desc: es
        ? "Ajusta el Sol a 3,5°, abre la Guía de Campo y detalla qué medir primero para cerrar el 0,20 de evidencia faltante."
        : "Sets Sun to 3.5°, opens the Field Guide, and details what to measure first to close the missing 0.20 evidence.",
      alEjecutar: () => {
        onAjustarSol?.(3.5);
        onNavegar?.("guide");
        enviarConsulta(
          es
            ? "¿Qué debemos medir primero en campo en P-07 y cuánto mide la sombra de la tablita de 0,50 m?"
            : "What should we measure first in the field at P-07 and how long is the 0.50 m board shadow?",
        );
      },
    },
  ];

  const promptsRapidos = es
    ? [
        `Telemetría de ${ficha?.id ?? "P-07"}`,
        "Curva de luz rasante f̄(e)",
        "Ranking y controles",
        "Mons Mouton y VIPER (424 h)",
      ]
    : [
        `${ficha?.id ?? "P-07"} Telemetry`,
        "Grazing-light curve f̄(e)",
        "Ranking & controls",
        "Mons Mouton & VIPER (424 h)",
      ];

  const tieneKey = Boolean(apiKey.trim());
  const modeloActual =
    MODELOS_GEMINI.find((m) => m.id === modelo) ?? MODELOS_GEMINI[0];

  return (
    <div className="si-console-root">
      <button
        type="button"
        className="si-trigger"
        aria-expanded={abierto}
        aria-controls="terrax-si-console"
        onClick={() => {
          setInstantaneo(false);
          const sig = !abierto;
          setAbierto(sig);
          if (sig) setTimeout(() => inputRef.current?.focus(), 80);
        }}
      >
        <span className={`si-trigger-status ${tieneKey ? "live" : ""}`} />
        <Sparkles size={15} />
        <span>{es ? "Consola SI" : "SI Console"}</span>
        <span className="si-trigger-kbd">Ctrl K</span>
      </button>

      <aside
        id="terrax-si-console"
        className="si-console"
        data-open={abierto ? "true" : "false"}
        data-instant={instantaneo ? "true" : "false"}
        data-docked={acoplado ? "true" : "false"}
        aria-label={
          es
            ? "Consola SI (Super Intelligence) de TERRA-X"
            : "TERRA-X SI (Super Intelligence) Console"
        }
      >
        {/* Top Bar */}
        <header className="si-top">
          <div className="si-brand-row">
            <div className="si-brand-icon">
              <Terminal size={15} />
            </div>
            <div className="si-brand-text">
              <h2 className="si-brand-title">
                <span>TERRA-X · SI COPILOT</span>
              </h2>
              <span className="si-brand-sub">
                {tieneKey
                  ? `${modeloActual.nombre} · ${es ? "Verificador F1–F20 activo" : "F1–F20 Verifier active"}`
                  : es
                    ? "Motor determinista verificado · Listo para Gemini API Key"
                    : "Verified deterministic engine · Ready for Gemini API Key"}
              </span>
            </div>
          </div>

          <div className="si-top-controls">
            <button
              type="button"
              className={`si-ctrl-btn ${tieneKey ? "live-key" : mostrarKeySheet ? "active" : ""}`}
              onClick={() => setMostrarKeySheet((v) => !v)}
              title={
                es
                  ? "Configurar API Key gratuita de Google Gemini y modelo"
                  : "Configure free Google Gemini API Key and model"
              }
            >
              <KeyRound size={13} />
              <span>{tieneKey ? (es ? "Gemini activo" : "Gemini active") : "API Key"}</span>
            </button>
            <button
              type="button"
              className="si-ctrl-btn"
              onClick={() => setAcoplado((v) => !v)}
              title={
                acoplado
                  ? es
                    ? "Modo ventana flotante"
                    : "Floating console mode"
                  : es
                    ? "Acoplar como panel lateral"
                    : "Dock as right-hand inspector"
              }
              aria-label={acoplado ? "Float panel" : "Dock panel"}
            >
              {acoplado ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              type="button"
              className="si-ctrl-btn"
              onClick={() => {
                setInstantaneo(false);
                setAbierto(false);
              }}
              aria-label={es ? "Cerrar consola SI" : "Close SI console"}
            >
              <X size={14} />
            </button>
          </div>
        </header>

        {/* Subbar: Tabs + Live Context Telemetry */}
        <div className="si-subbar">
          <div className="si-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={pestana === "chat"}
              className="si-tab"
              onClick={() => setPestana("chat")}
            >
              <Sparkles size={12} />
              <span>{es ? "Copiloto" : "Copilot"}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === "escenarios"}
              className="si-tab"
              onClick={() => setPestana("escenarios")}
            >
              <Compass size={12} />
              <span>{es ? "Escenarios" : "Scenarios"}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pestana === "telemetria"}
              className="si-tab"
              onClick={() => setPestana("telemetria")}
            >
              <Activity size={12} />
              <span>{es ? "Telemetría" : "Telemetry"}</span>
            </button>
          </div>

          <div className="si-telemetry-pill">
            <span>
              <strong>{ficha?.id ?? "P-07"}</strong>
            </span>
            <span>
              <Sun size={11} style={{ verticalAlign: "-1px" }} />{" "}
              <strong>{elevacionSolDeg}°</strong>
            </span>
          </div>
        </div>

        {/* Collapsible Gemini API Key & Free Model Selector */}
        {mostrarKeySheet && (
          <div className="si-key-sheet">
            <div className="si-key-grid">
              <label className="si-field-label">
                <span>
                  {es
                    ? "Google AI Studio · Clave de API gratuita (GEMINI_API_KEY)"
                    : "Google AI Studio · Free API Key (GEMINI_API_KEY)"}
                </span>
                <div className="si-input-group">
                  <input
                    type="password"
                    value={borradorKey}
                    onChange={(e) => setBorradorKey(e.target.value)}
                    placeholder="AIzaSy..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="si-ctrl-btn active"
                    onClick={probarKey}
                    disabled={estadoTest.probando}
                    style={{ height: "34px", flexShrink: 0 }}
                  >
                    {estadoTest.probando
                      ? es
                        ? "Probando…"
                        : "Testing…"
                      : es
                        ? "Probar y guardar"
                        : "Test & Save"}
                  </button>
                </div>
              </label>

              <div className="si-field-label">
                <span>
                  {es
                    ? "Seleccioná el modelo gratuito de Gemini"
                    : "Select Free-Tier Gemini Model"}
                </span>
                <div className="si-model-cards">
                  {MODELOS_GEMINI.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="si-model-card"
                      data-selected={modelo === m.id ? "true" : "false"}
                      onClick={() => {
                        setModelo(m.id);
                        guardarModelo(m.id);
                      }}
                    >
                      <span className="si-model-card-name">{m.nombre}</span>
                      <span className="si-model-card-badge">{m.badge}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="si-key-footer">
              <span
                className={`si-test-status ${
                  estadoTest.ok === true ? "ok" : estadoTest.ok === false ? "err" : ""
                }`}
              >
                {estadoTest.texto ??
                  (es ? modeloActual.etiquetaEs : modeloActual.etiquetaEn)}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                {tieneKey && (
                  <button
                    type="button"
                    className="si-ctrl-btn"
                    onClick={() => {
                      setBorradorKey("");
                      setApiKey("");
                      guardarApiKey("");
                      setEstadoTest({
                        probando: false,
                        texto: es ? "Clave eliminada" : "API Key cleared",
                      });
                    }}
                  >
                    {es ? "Borrar clave" : "Clear key"}
                  </button>
                )}
                <button
                  type="button"
                  className="si-ctrl-btn"
                  onClick={() => {
                    const limpia = borradorKey.trim();
                    setApiKey(limpia);
                    guardarApiKey(limpia);
                    setMostrarKeySheet(false);
                  }}
                >
                  {es ? "Listo" : "Done"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewport Content by Tab */}
        <div className="si-viewport" role="log" aria-live="polite">
          {pestana === "escenarios" && (
            <div className="si-scenario-list">
              <div className="si-turn-assistant">
                {renderProsa(
                  es
                    ? "**Traductor de escenarios de misión (Documento 03 y 04):** elegí un escenario operativo y la Consola SI configurará automáticamente la candidata, el ángulo solar y la pantalla correspondiente."
                    : "**Mission Scenario Translator (Documents 03 & 04):** select an operational scenario below and the SI Console will automatically configure the candidate parcel, Sun angle, and active view.",
                )}
              </div>
              {escenariosMision.map((esc) => (
                <button
                  key={esc.id}
                  type="button"
                  className="si-scenario-card"
                  onClick={esc.alEjecutar}
                >
                  <div className="si-scenario-title">
                    <span>{esc.titulo}</span>
                    <ArrowUpRight size={14} />
                  </div>
                  <span className="si-scenario-desc">{esc.desc}</span>
                </button>
              ))}
            </div>
          )}

          {pestana === "telemetria" && (
            <>
              <WidgetTelemetriaFicha ficha={ficha} es={es} />
              <WidgetCurvaLuz
                ficha={ficha}
                elevacionSolDeg={elevacionSolDeg}
                es={es}
                onAjustarSol={onAjustarSol}
              />
              <WidgetEscaleraRanking
                actualId={ficha?.id ?? "P-07"}
                es={es}
                onSeleccionar={onSeleccionarCandidata}
              />
            </>
          )}

          {pestana === "chat" && (
            <>
              {turnos.length === 0 && (
                <div className="si-turn-assistant">
                  {renderProsa(
                    es
                      ? [
                          `**Consola SI lista sobre \`${ficha?.id ?? "P-07"}\` (${ficha?.lugar.nombre ?? "Payunia"}) · Sol a ${elevacionSolDeg}°.**`,
                          `• **Modelo preseleccionado:** \`${modelo}\` con **streaming en tiempo real** y verificador numérico contra la ficha (\`verificarRespuestaSI\`).`,
                          "• Tocá **API Key** arriba para pegar tu clave gratuita de Google AI Studio (`AIza...`), o usá los controles interactivos de abajo.",
                        ].join("\n")
                      : [
                          `**SI Console locked onto \`${ficha?.id ?? "P-07"}\` (${ficha?.lugar.nombre ?? "Payunia"}) · Sun at ${elevacionSolDeg}°.**`,
                          `• **Preselected model:** \`${modelo}\` with **real-time SSE streaming** and deterministic numeric verification (\`verificarRespuestaSI\`).`,
                          "• Click **API Key** above to paste your free Google AI Studio key (`AIza...`), or interact directly with the telemetry below.",
                        ].join("\n"),
                  )}
                  <WidgetTelemetriaFicha ficha={ficha} es={es} />
                  <div className="si-turn-actions">
                    <button
                      type="button"
                      className="si-action-pill"
                      onClick={() =>
                        enviarConsulta(
                          es
                            ? "Comparar el ranking de todas las candidatas y controles"
                            : "Compare the ranking of all candidates and controls",
                        )
                      }
                    >
                      <Layers size={12} />
                      <span>{es ? "Ver escalera de 13 candidatas" : "Inspect 13-candidate ladder"}</span>
                    </button>
                    <button
                      type="button"
                      className="si-action-pill"
                      onClick={() =>
                        enviarConsulta(
                          es
                            ? "Mostrar curva de luz rasante f̄(e) de 1,5° a 10°"
                            : "Show grazing-light curve f̄(e) from 1.5° to 10°",
                        )
                      }
                    >
                      <Sliders size={12} />
                      <span>{es ? "Curva f̄(e) 1,5°–10°" : "f̄(e) Curve 1.5°–10°"}</span>
                    </button>
                  </div>
                </div>
              )}

              {turnos.map((t) => (
                <div key={t.id} className="si-turn">
                  {t.rol === "user" ? (
                    <div className="si-turn-user">{t.texto}</div>
                  ) : (
                    <div className="si-turn-assistant">
                      {renderProsa(t.texto)}

                      {t.meta?.widgets.includes("telemetria_ficha") && (
                        <WidgetTelemetriaFicha ficha={ficha} es={es} />
                      )}
                      {t.meta?.widgets.includes("curva_luz") && (
                        <WidgetCurvaLuz
                          ficha={ficha}
                          elevacionSolDeg={elevacionSolDeg}
                          es={es}
                          onAjustarSol={onAjustarSol}
                        />
                      )}
                      {t.meta?.widgets.includes("ranking_controles") && (
                        <WidgetEscaleraRanking
                          actualId={ficha?.id ?? "P-07"}
                          es={es}
                          onSeleccionar={onSeleccionarCandidata}
                        />
                      )}

                      {t.meta && t.meta.acciones.length > 0 && (
                        <div className="si-turn-actions">
                          {t.meta.acciones.map((acc, i) => (
                            <button
                              key={`${acc.tipo}-${acc.valor}-${i}`}
                              type="button"
                              className="si-action-pill"
                              onClick={() => ejecutarAccion(acc)}
                            >
                              <ArrowUpRight size={12} />
                              <span>{es ? acc.etiquetaEs : acc.etiquetaEn}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {t.meta?.aviso && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "11px",
                            color: "#ffd166",
                          }}
                        >
                          <AlertTriangle size={13} />
                          <span>{t.meta.aviso}</span>
                        </div>
                      )}

                      {t.meta && (
                        <div className="si-turn-foot">
                          <span className="si-verif-badge">
                            <ShieldCheck size={12} />
                            <span>{t.meta.verificacion.resumenVerificacion}</span>
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>
                              {t.meta.origen === "gemini-api"
                                ? `${t.meta.modeloUsado} · ${t.meta.latenciaMs} ms`
                                : es
                                  ? `Determinista · ${t.meta.latenciaMs} ms`
                                  : `Deterministic · ${t.meta.latenciaMs} ms`}
                            </span>
                            <button
                              type="button"
                              className="si-ctrl-btn"
                              style={{ height: "22px", padding: "0 6px" }}
                              onClick={() => {
                                navigator.clipboard?.writeText(t.texto);
                                setCopiadoId(t.id);
                                setTimeout(() => setCopiadoId(null), 1500);
                              }}
                              title={es ? "Copiar respuesta" : "Copy response"}
                            >
                              {copiadoId === t.id ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {cargando && (
                <div className="si-turn-assistant">
                  {parcialStream ? (
                    renderProsa(parcialStream)
                  ) : (
                    <div className="si-prose">
                      <p>
                        {es
                          ? `Consultando ${tieneKey ? modelo : "telemetría verificada"} y auditando cifras contra ${ficha?.id ?? "P-07"}…`
                          : `Querying ${tieneKey ? modelo : "verified telemetry"} and auditing figures against ${ficha?.id ?? "P-07"}…`}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div ref={finRef} />
            </>
          )}
        </div>

        {/* Quick Prompts Strip */}
        <div className="si-prompt-grid">
          {promptsRapidos.map((p) => (
            <button
              key={p}
              type="button"
              className="si-prompt-btn"
              onClick={() => enviarConsulta(p)}
            >
              {p}
            </button>
          ))}
          {turnos.length > 0 && (
            <button
              type="button"
              className="si-prompt-btn"
              onClick={() => setTurnos([])}
              title={es ? "Limpiar conversación" : "Clear conversation"}
            >
              <RotateCcw size={11} style={{ verticalAlign: "-1px" }} />{" "}
              {es ? "Limpiar" : "Clear"}
            </button>
          )}
        </div>

        {/* Input Composer */}
        <form
          className="si-composer"
          onSubmit={(e) => {
            e.preventDefault();
            enviarConsulta(entrada);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder={
              es
                ? `Preguntá o pedí un escenario sobre ${ficha?.id ?? "P-07"}, Mons Mouton, sombras…`
                : `Ask or describe a scenario for ${ficha?.id ?? "P-07"}, Mons Mouton, shadows…`
            }
            aria-label={es ? "Consulta para la Consola SI" : "Query for the SI Console"}
          />
          <button
            type="submit"
            className="si-submit"
            disabled={cargando || !entrada.trim()}
          >
            <Send size={13} />
            <span>{es ? "Enviar" : "Ask"}</span>
          </button>
        </form>
      </aside>
    </div>
  );
};

export default AsistenteSI;
