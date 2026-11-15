/**
 * The TERRA-X guide: a small chat, grounded in the published data (see geminiClient.ts).
 * One panel, no settings. Ctrl K opens it; Esc closes it.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, X } from "lucide-react";
import { Ficha, Manifest } from "../datos/contract";
import { IndexEntry } from "../datos/integration";
import { EntradaRanking, readRanking } from "../datos/ranking";
import { NOMBRE_MODELO, RespuestaChatSI, consultarSI } from "./geminiClient";
import { AccionRapidaSI, ContextoSI } from "./verificadorSI";
import "./asistente-si.css";

interface Props {
  pagina: string;
  ficha?: Ficha;
  manifest?: Manifest;
  indice?: IndexEntry[];
  elevacionSolDeg: number;
  motorEnVivo?: boolean;
  idioma: "en" | "es";
  onNavegar?: (destino: string) => void;
  onSeleccionarCandidata?: (id: string) => void;
  onAjustarSol?: (deg: number) => void;
}
interface Turno {
  id: string;
  rol: "user" | "assistant";
  texto: string;
  meta?: RespuestaChatSI;
}

/** Bold, inline code and bullet lists; nothing else, on purpose. */
function Prosa({ texto }: { texto: string }) {
  const lineas = texto.split(/\r?\n/);
  const bloques: { tipo: "p" | "ul"; items: string[] }[] = [];
  for (const l of lineas) {
    const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m) {
      const u = bloques[bloques.length - 1];
      if (u && u.tipo === "ul") u.items.push(m[1]);
      else bloques.push({ tipo: "ul", items: [m[1]] });
    } else if (l.trim()) bloques.push({ tipo: "p", items: [l.trim()] });
  }
  const inline = (s: string) =>
    s
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .map((t, i) =>
        t.startsWith("**") ? (
          <strong key={i}>{t.slice(2, -2)}</strong>
        ) : t.startsWith("`") ? (
          <code key={i}>{t.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{t}</Fragment>
        ),
      );
  return (
    <>
      {bloques.map((b, i) =>
        b.tipo === "ul" ? (
          <ul key={i}>
            {b.items.map((x, j) => (
              <li key={j}>{inline(x)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inline(b.items[0])}</p>
        ),
      )}
    </>
  );
}

function Marca() {
  return (
    <img src="/terra-x.svg" width="22" height="22" alt="" aria-hidden="true" />
  );
}

export default function AsistenteSI(p: Props) {
  const es = p.idioma === "es";
  const t = (en: string, esp: string) => (es ? esp : en);
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [ranking, setRanking] = useState<EntradaRanking[]>([]);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    readRanking()
      .then((r) => setRanking(r.entradas))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: "end" });
  }, [turnos, parcial, abierto]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
        setTimeout(() => inputRef.current?.focus(), 30);
      } else if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ctx: ContextoSI = {
    pagina: p.pagina,
    ficha: p.ficha,
    manifest: p.manifest,
    indice: p.indice,
    ranking,
    elevacionSolDeg: p.elevacionSolDeg,
    motorEnVivo: p.motorEnVivo,
  };

  const ejecutar = (a: AccionRapidaSI) => {
    if (a.tipo === "navegar") p.onNavegar?.(String(a.valor));
    else if (a.tipo === "seleccionar_candidata")
      p.onSeleccionarCandidata?.(String(a.valor));
    else if (a.tipo === "ajustar_sol") p.onAjustarSol?.(Number(a.valor));
  };

  const enviar = async (texto: string) => {
    const limpia = texto.trim();
    if (!limpia || cargando) return;
    const historial = turnos.map((x) => ({
      rol: x.rol === "user" ? ("user" as const) : ("model" as const),
      texto: x.texto,
    }));
    setTurnos((prev) => [
      ...prev,
      { id: `u${Date.now()}`, rol: "user", texto: limpia },
    ]);
    setEntrada("");
    setParcial("");
    setCargando(true);
    try {
      const r = await consultarSI(limpia, ctx, p.idioma, historial, setParcial);
      setTurnos((prev) => [
        ...prev,
        { id: `a${Date.now()}`, rol: "assistant", texto: r.texto, meta: r },
      ]);
    } finally {
      setParcial("");
      setCargando(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const id = p.ficha?.id ?? "P-27";
  const sugerencias = [
    t(
      `What can a crew rehearse at ${id}, and what can't it?`,
      `¿Qué puede ensayar un equipo en ${id} y qué no?`,
    ),
    t(
      "Why does a low Sun matter so much on the Moon?",
      "¿Por qué importa tanto el Sol bajo en la Luna?",
    ),
    t(
      "How do you know the ranking is not rigged?",
      "¿Cómo sé que el ranking no está arreglado?",
    ),
    t(
      "What do C and E mean, in simple words?",
      "¿Qué significan C y E, en palabras simples?",
    ),
  ];
  const n = (v: number, d: number) =>
    v.toLocaleString(p.idioma, {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    });

  return (
    <div className="si-raiz">
      <button
        type="button"
        className="si-trigger"
        aria-expanded={abierto}
        aria-controls="terrax-guia"
        onClick={() => {
          setAbierto((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 60);
        }}
      >
        <Marca />
        <span>{t("Ask TERRA-X", "Preguntale a TERRA-X")}</span>
        <kbd className="si-trigger-kbd">Ctrl K</kbd>
      </button>

      <section
        id="terrax-guia"
        className="si-console"
        data-open={abierto ? "true" : "false"}
        aria-label={t("TERRA-X guide (SI)", "Guía de TERRA-X (SI)")}
        aria-hidden={!abierto}
      >
        <header className="si-cabeza">
          <div className="si-titulo">
            <Marca />
            <div>
              <strong>{t("TERRA-X guide", "Guía de TERRA-X")}</strong>
              <span className="si-contexto mono">
                {p.ficha
                  ? `${p.ficha.id} · ${p.ficha.lugar.nombre}`
                  : t("no candidate open", "sin candidata abierta")}{" "}
                · {t("Sun", "Sol")} {n(p.elevacionSolDeg, 1)}°
              </span>
            </div>
          </div>
          <div className="si-botones">
            {turnos.length > 0 && (
              <button
                type="button"
                className="si-icono"
                onClick={() => setTurnos([])}
                aria-label={t("New conversation", "Conversación nueva")}
                title={t("New conversation", "Conversación nueva")}
              >
                <RotateCcw size={16} />
              </button>
            )}
            <button
              type="button"
              className="si-icono"
              onClick={() => setAbierto(false)}
              aria-label={t("Close", "Cerrar")}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="si-mensajes" role="log" aria-live="polite">
          {turnos.length === 0 && (
            <div className="si-bienvenida">
              <p>
                {t(
                  "I explain what you are looking at, in plain words, using only the published data. Every number I say is checked against the candidate card before you see it.",
                  "Te explico lo que estás viendo, en palabras simples y solo con los datos publicados. Cada cifra que digo se compara con la ficha antes de que la veas.",
                )}
              </p>
              <div className="si-sugerencias">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="si-chip"
                    onClick={() => enviar(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turnos.map((x) => (
            <div
              key={x.id}
              className={
                x.rol === "user" ? "si-turno usuario" : "si-turno guia"
              }
            >
              <Prosa texto={x.texto} />
              {x.meta && x.meta.acciones.length > 0 && (
                <div className="si-acciones">
                  {x.meta.acciones.map((a, i) => (
                    <button
                      key={i}
                      type="button"
                      className="si-chip accion"
                      onClick={() => ejecutar(a)}
                    >
                      {es ? a.etiquetaEs : a.etiquetaEn}
                    </button>
                  ))}
                </div>
              )}
              {x.meta && (
                <p className="si-meta mono">
                  {x.meta.origen === "gemini"
                    ? `${NOMBRE_MODELO} · ${n(x.meta.latenciaMs / 1000, 1)} s · ${x.meta.verificacion.numerosExtraidos.length} ${t("figures checked against the data", "cifras comprobadas con los datos")}`
                    : t(
                        "Answer built from the card only",
                        "Respuesta armada solo con la ficha",
                      )}
                  {x.meta.aviso ? ` · ${x.meta.aviso}` : ""}
                </p>
              )}
            </div>
          ))}
          {cargando && (
            <div className="si-turno guia">
              {parcial ? (
                <Prosa texto={parcial} />
              ) : (
                <span
                  className="si-puntos"
                  aria-label={t("Thinking", "Pensando")}
                >
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          )}
          <div ref={finRef} />
        </div>

        <form
          className="si-composer"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(entrada);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            placeholder={t(
              "Ask about this candidate, the Moon, the method…",
              "Preguntá por esta candidata, la Luna, el método…",
            )}
            aria-label={t("Your question", "Tu pregunta")}
            autoComplete="off"
            maxLength={600}
          />
          <button
            type="submit"
            className="si-enviar"
            disabled={!entrada.trim() || cargando}
            aria-label={t("Send", "Enviar")}
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </form>
      </section>
    </div>
  );
}
