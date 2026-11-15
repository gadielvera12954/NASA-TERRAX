/**
 * The TERRA-X guide: a small chat, grounded in the published data (see geminiClient.ts).
 * One panel, no settings. Ctrl K opens it; Esc closes it.
 */
import { Fragment, lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowUp, Box, RotateCcw, Sparkles, X } from "lucide-react";
import type { Modelo3DSI } from "./Visor3DSI";
import { Ficha, Manifest } from "../datos/contract";
import { IndexEntry } from "../datos/integration";
import { EntradaRanking, readRanking } from "../datos/ranking";
import { RespuestaChatSI, consultarSI } from "./geminiClient";
import { AccionRapidaSI, ContextoSI } from "./verificadorSI";
import { AperturaSI, EVENTO_SI } from "./abrirSI";
import { bienvenidaSI, normalizarContextoSI, sugerenciasSI } from "./contextoSI";
import { explicarMotorSI } from "./motorSI";
import { analizarPuntoSI, compararEscenariosSI, ErrorMotorSI, estadoSI, ResultadoMotorSI } from "../datos/siMotor";
import { readFicha } from "../datos/integration";
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
  /** 3D views shown with this reply (from the model's tags, the question's words or a gallery button). */
  modelos3d?: Modelo3DSI[];
}

// three.js only loads when the guide first shows a 3D view.
const Visor3DSI = lazy(() => import("./Visor3DSI"));

const GALERIA: { id: Modelo3DSI; en: string; es: string; textoEn: string; textoEs: string }[] = [
  { id: "moon", en: "Mons Mouton", es: "Mons Mouton",
    textoEn: "This is Mons Mouton, the destination, from NASA LOLA relief on the 60 m grid. Drag to orbit, scroll to zoom. Look at how a Sun a few degrees above the horizon leaves whole crater floors in shadow: that is why the rover's parking spot decides how long its night lasts.",
    textoEs: "Este es Mons Mouton, el destino, con el relieve NASA LOLA en la grilla de 60 m. Arrastrá para girar y usá la rueda para acercar. Mirá cómo un Sol a pocos grados del horizonte deja fondos de cráter enteros en sombra: por eso el lugar donde se estaciona el rover decide cuánto dura su noche." },
  { id: "payunia", en: "Payunia", es: "Payunia",
    textoEn: "This is Payunia (Mendoza, Argentina), where the 40 Earth parcels are, from Copernicus DEM relief on the same 60 m grid. Compare its slopes and grazing-light shadows with the Moon; gravity, vacuum and dust do not transfer.",
    textoEs: "Esta es Payunia (Mendoza, Argentina), donde están las 40 parcelas terrestres, con el relieve Copernicus DEM en la misma grilla de 60 m. Compará sus pendientes y sombras de luz rasante con la Luna; la gravedad, el vacío y el polvo no se reproducen." },
  { id: "mars", en: "Jezero (Mars)", es: "Jezero (Marte)",
    textoEn: "This is Jezero crater on Mars, the Perseverance landing area, from the team's published relief. It is shown for comparison only: the ranking scores Earth sites against the Moon.",
    textoEs: "Este es el cráter Jezero en Marte, la zona de aterrizaje de Perseverance, con el relieve publicado por el equipo. Se muestra solo para comparar: el ranking puntúa sitios terrestres contra la Luna." },
  { id: "rover", en: "Rover", es: "Rover",
    textoEn: "This is the rover template: a generic shape with VIPER's public dimensions and panels on three sides, not an official NASA model. With the Sun this low, which panel faces it matters as much as where the rover parks.",
    textoEs: "Esta es la plantilla del rover: una forma genérica con las medidas públicas de VIPER y paneles en tres lados, no un modelo oficial de la NASA. Con el Sol tan bajo, importa tanto qué panel mira al Sol como dónde se estaciona." },
];

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

function Marca({ grande }: { grande?: boolean }) {
  return (
    <span className={grande ? "si-avatar grande" : "si-avatar"} aria-hidden="true">
      <img src="/terra-x.svg" width={grande ? 30 : 22} height={grande ? 30 : 22} alt="" />
    </span>
  );
}

export default function AsistenteSI(p: Props) {
  const es = p.idioma === "es";
  const t = (en: string, esp: string) => (es ? esp : en);
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [contextoExterno, setContextoExterno] = useState<Record<string, unknown>>({});
  const [fichaEvento, setFichaEvento] = useState<Ficha>();
  const [fichasComparacion, setFichasComparacion] = useState<Ficha[]>([]);
  const [conectada, setConectada] = useState<boolean | null>(null);
  const [resultadosMotor, setResultadosMotor] = useState<ResultadoMotorSI[]>([]);
  const [ranking, setRanking] = useState<EntradaRanking[]>([]);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const origenRef = useRef<HTMLElement | null>(null);
  const generacionRef = useRef(0);
  const ocupadoRef = useRef(false);
  const pantallaAnteriorRef = useRef({ pagina: p.pagina, id: p.ficha?.id });
  const aperturaExternaRef = useRef(false);

  const cerrar = () => {
    setAbierto(false);
    origenRef.current?.focus();
  };

  useEffect(() => {
    let vigente = true;
    setConectada(null);
    estadoSI().then(v => { if (vigente) setConectada(v); });
    return () => { vigente = false; };
  }, [abierto]);

  useEffect(() => {
    const anterior = pantallaAnteriorRef.current;
    const cambia = anterior.pagina !== p.pagina
      || (!aperturaExternaRef.current && !!anterior.id && !!p.ficha?.id && anterior.id !== p.ficha.id);
    pantallaAnteriorRef.current = { pagina: p.pagina, id: p.ficha?.id ?? anterior.id };
    // Initial async loading of the atlas record must not erase an external opening.
    if (!cambia) return;
    aperturaExternaRef.current = false;
    generacionRef.current++;
    ocupadoRef.current = false;
    setCargando(false);
    setContextoExterno({});
    setTurnos([]);
    setEntrada("");
    setResultadosMotor([]);
  }, [p.pagina, p.ficha?.id]);

  useEffect(() => {
    let vigente = true;
    setFichaEvento(undefined);
    const id = contextoExterno.candidataId;
    if (typeof id === "string" && id !== p.ficha?.id) {
      readFicha(id).then(f => { if (vigente) setFichaEvento(f); }).catch(() => {});
    }
    return () => { vigente = false; };
  }, [contextoExterno, p.ficha?.id]);

  useEffect(() => {
    let vigente = true;
    setFichasComparacion([]);
    const ids = contextoExterno.sitiosComparados;
    if (Array.isArray(ids)) Promise.allSettled(ids.filter((id): id is string => typeof id === "string").map(readFicha))
      .then(resultados => {
        if (vigente) setFichasComparacion(resultados.flatMap(r => r.status === "fulfilled" ? [r.value] : []));
      });
    return () => { vigente = false; };
  }, [contextoExterno]);

  useEffect(() => {
    const abrir = (evento: Event) => {
      const d = (evento as CustomEvent<AperturaSI>).detail;
      if (!d || typeof d.pregunta !== "string") return;
      aperturaExternaRef.current = true;
      generacionRef.current++;
      ocupadoRef.current = false;
      setCargando(false);
      setTurnos([]);
      setResultadosMotor([]);
      origenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setContextoExterno(normalizarContextoSI(d.contexto && typeof d.contexto === "object" && !Array.isArray(d.contexto) ? d.contexto : {}));
      setEntrada(d.pregunta.slice(0, 600));
      setAbierto(true);
    };
    window.addEventListener(EVENTO_SI, abrir);
    return () => { window.removeEventListener(EVENTO_SI, abrir); generacionRef.current++; };
  }, []);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto, contextoExterno]);

  useEffect(() => {
    readRanking()
      .then((r) => setRanking(r.entradas))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ block: "nearest" });
  }, [turnos, abierto]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => {
          if (!v) origenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          else origenRef.current?.focus();
          return !v;
        });
      } else if (e.key === "Escape") {
        setAbierto(false);
        if (document.activeElement?.closest(".si-raiz")) origenRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ctx: ContextoSI = {
    pagina: typeof contextoExterno.pagina === "string" ? contextoExterno.pagina : p.pagina,
    ficha: (contextoExterno.pagina ?? p.pagina) === "lab" ? undefined
      : typeof contextoExterno.candidataId === "string" && contextoExterno.candidataId !== p.ficha?.id ? fichaEvento : p.ficha,
    manifest: p.manifest,
    indice: p.indice,
    ranking,
    elevacionSolDeg: typeof contextoExterno.elevacionSolDeg === "number" && Number.isFinite(contextoExterno.elevacionSolDeg)
      ? contextoExterno.elevacionSolDeg : p.elevacionSolDeg,
    alturaObjetoM: typeof contextoExterno.alturaObjetoM === "number" && Number.isFinite(contextoExterno.alturaObjetoM) && contextoExterno.alturaObjetoM > 0
      ? contextoExterno.alturaObjetoM : undefined,
    instante: typeof contextoExterno.instante === "string" && Number.isFinite(Date.parse(contextoExterno.instante)) ? contextoExterno.instante : undefined,
    motorEnVivo: p.motorEnVivo,
    resultadosMotor,
    fichasComparacion: fichasComparacion.filter(f => Array.isArray(contextoExterno.sitiosComparados) && contextoExterno.sitiosComparados.includes(f.id)),
  };

  const ejecutar = (a: AccionRapidaSI) => {
    if (a.tipo === "navegar") p.onNavegar?.(String(a.valor));
    else if (a.tipo === "seleccionar_candidata")
      p.onSeleccionarCandidata?.(String(a.valor));
    else if (a.tipo === "ajustar_sol") p.onAjustarSol?.(Number(a.valor));
  };

  const enviar = async (texto: string) => {
    const limpia = texto.trim();
    if (!limpia || ocupadoRef.current) return;
    ocupadoRef.current = true;
    const generacion = generacionRef.current;
    const historial = turnos.map((x) => ({
      rol: x.rol === "user" ? ("user" as const) : ("model" as const),
      texto: x.texto,
    }));
    setTurnos((prev) => [
      ...prev,
      { id: `u${Date.now()}`, rol: "user", texto: limpia },
    ]);
    setEntrada("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setCargando(true);
    try {
      const r = await consultarSI(limpia, ctx, p.idioma, historial);
      if (generacion !== generacionRef.current) return;
      if (r.aviso) setConectada(false);
      setTurnos((prev) => [
        ...prev,
        { id: `a${Date.now()}`, rol: "assistant", texto: r.texto, meta: r, modelos3d: r.modelos3d },
      ]);
    } finally {
      if (generacion === generacionRef.current) {
        ocupadoRef.current = false;
        setCargando(false);
        inputRef.current?.focus();
      }
    }
  };

  /** Gallery button: shows a published model at once, with a fixed caption (no request to the model). */
  const mostrar3D = (m: Modelo3DSI) => {
    if (ocupadoRef.current) return;
    const g = GALERIA.find((x) => x.id === m);
    if (!g) return;
    setTurnos((prev) => [
      ...prev,
      { id: `u${Date.now()}`, rol: "user", texto: t(`Show ${g.en} in 3D`, `Mostrame ${g.es} en 3D`) },
      { id: `a${Date.now() + 1}`, rol: "assistant", texto: es ? g.textoEs : g.textoEn, modelos3d: [m] },
    ]);
  };

  const correrMotor = async (comparar: boolean, pedidos?: unknown[]) => {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    const generacion = generacionRef.current;
    setCargando(true);
    const texto = comparar ? t("Compare these scenarios with the engine", "Comparar estos escenarios con el motor")
      : t("Analyze this point with the engine", "Analizar este punto con el motor");
    setTurnos(prev => [...prev, { id: `u${Date.now()}`, rol: "user", texto }]);
    try {
      const resultados = comparar ? await compararEscenariosSI(pedidos ?? contextoExterno.pedidos) : await analizarPuntoSI(contextoExterno.pedido);
      if (generacion !== generacionRef.current) return;
      const respuesta = explicarMotorSI(resultados, p.idioma);
      setResultadosMotor(resultados);
      setTurnos(prev => [...prev, { id: `a${Date.now()}`, rol: "assistant", texto: respuesta.texto, meta: respuesta }]);
    } catch (error) {
      if (generacion !== generacionRef.current) return;
      const textoError = error instanceof ErrorMotorSI && error.motivo === "contexto"
        ? t("The screen has not supplied valid point and period parameters. Open a laboratory point and use Explain with SI.", "La pantalla no envió parámetros válidos de punto y período. Abrí un punto del laboratorio y usá Explicar con SI.")
        : error instanceof ErrorMotorSI && error.motivo === "comparacion"
          ? t("Engine comparison is not available on this server yet. No comparison was calculated.", "La comparación del motor todavía no está disponible en este servidor. No se calculó una comparación.")
          : t("The engine did not return a verifiable result. Check the connection and try again. No calculation is shown.", "El motor no devolvió un resultado verificable. Revisá la conexión e intentá de nuevo. No se muestra un cálculo.");
      setTurnos(prev => [...prev, { id: `a${Date.now()}`, rol: "assistant", texto: textoError }]);
    } finally {
      if (generacion === generacionRef.current) {
        ocupadoRef.current = false; setCargando(false); inputRef.current?.focus();
      }
    }
  };

  const sugerencias = sugerenciasSI(ctx, p.idioma);
  const pedidoActual = contextoExterno.pedido as Record<string, unknown> | undefined;
  const comparacionEstacional = pedidoActual && ["verano", "invierno"].includes(String(pedidoActual.lunacion))
    ? [{ ...pedidoActual, lunacion: "verano" }, { ...pedidoActual, lunacion: "invierno" }] : undefined;
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
          if (abierto) cerrar();
          else { origenRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setAbierto(true); }
        }}
      >
        <Marca />
        <span>{t("Ask the SI", "Preguntale a la SI")}</span>
        <kbd className="si-trigger-kbd">Ctrl K</kbd>
      </button>

      <section
        id="terrax-guia"
        role="dialog"
        className="si-console"
        data-open={abierto ? "true" : "false"}
        aria-label={t("TERRA-X SI assistant", "Asistente SI de TERRA-X")}
        aria-hidden={!abierto}
      >
        <header className="si-cabeza">
          <div className="si-titulo">
            <Marca grande />
            <div>
              <strong>{t("TERRA-X SI assistant", "Asistente SI de TERRA-X")}</strong>
              <span className="si-contexto mono" role="status" data-conectada={conectada === null ? "?" : conectada ? "si" : "no"}>
                {conectada === null ? t("Checking SI connection…", "Comprobando conexión de la SI…")
                  : conectada ? t("SI connected", "SI conectada") : t("SI using local data", "SI con datos locales")}
              </span>
              <span className="si-contexto mono">
                {contextoExterno.pedido
                  ? t("Point parameters loaded", "Parámetros del punto cargados")
                  : contextoExterno.pedidos ? t("Comparison parameters loaded", "Parámetros de comparación cargados") : ctx.ficha
                  ? `${ctx.ficha.id} · ${ctx.ficha.lugar.nombre}`
                  : t("no candidate open", "sin candidata abierta")}{" "}
                · {ctx.pagina === "lab" ? t("Engine inputs", "Entradas del motor") : `${t("Sun", "Sol")} ${n(ctx.elevacionSolDeg, 1)}°`}
              </span>
            </div>
          </div>
          <div className="si-botones">
            {turnos.length > 0 && (
              <button
                type="button"
                className="si-icono"
                onClick={() => {
                  generacionRef.current++; ocupadoRef.current = false;
                  setCargando(false); setTurnos([]); setResultadosMotor([]);
                  inputRef.current?.focus();
                }}
                aria-label={t("New conversation", "Conversación nueva")}
                title={t("New conversation", "Conversación nueva")}
              >
                <RotateCcw size={16} />
              </button>
            )}
            <button
              type="button"
              className="si-icono"
              onClick={cerrar}
              aria-label={t("Close", "Cerrar")}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="si-mensajes" role="log" aria-live="polite">
          {turnos.length === 0 && (
            <div className="si-bienvenida">
              <p className="si-hola">
                <Sparkles size={16} aria-hidden="true" />
                {t("Hi! Ask me about the Moon, the sites or the method.", "¡Hola! Preguntame por la Luna, los sitios o el método.")}
              </p>
              <p>
                {bienvenidaSI(ctx, p.idioma, !!contextoExterno.pedido || !!contextoExterno.pedidos)}
              </p>
              <div className="si-sugerencias">
                {sugerencias.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    className="si-chip"
                    style={{ animationDelay: `${80 + i * 60}ms` }}
                    disabled={cargando}
                    onClick={() => enviar(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="si-galeria" role="group" aria-label={t("See it in 3D", "Verlo en 3D")}>
                <span className="si-galeria-titulo mono"><Box size={13} aria-hidden="true" /> {t("See it in 3D", "Verlo en 3D")}</span>
                <div>
                  {GALERIA.map((g, i) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`si-modelo-btn ${g.id}`}
                      style={{ animationDelay: `${200 + i * 60}ms` }}
                      disabled={cargando}
                      onClick={() => mostrar3D(g.id)}
                    >
                      <i aria-hidden="true" />
                      {es ? g.es : g.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {(!!contextoExterno.pedido || !!contextoExterno.pedidos) && (
            <div className="si-acciones">
              {!!contextoExterno.pedido && <button className="si-chip accion" type="button" disabled={cargando} onClick={() => correrMotor(false)}>
                {t("Analyze this point", "Analizar este punto")}
              </button>}
              {!!contextoExterno.pedidos && <button className="si-chip accion" type="button" disabled={cargando} onClick={() => correrMotor(true)}>
                {t("Compare scenarios with the engine", "Comparar escenarios con el motor")}
              </button>}
              {!contextoExterno.pedidos && comparacionEstacional && <button className="si-chip accion" type="button" disabled={cargando} onClick={() => correrMotor(true, comparacionEstacional)}>
                {t("Compare summer and winter at this point", "Comparar verano e invierno en este punto")}
              </button>}
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
              {x.rol === "assistant" && !!x.modelos3d?.length && (
                <div className={x.modelos3d.length > 1 ? "si-3d-fila doble" : "si-3d-fila"}>
                  <Suspense fallback={<div className="si-3d"><div className="si-3d-lienzo"><span className="si-3d-carga">{t("Loading 3D model…", "Cargando modelo 3D…")}</span></div></div>}>
                    {x.modelos3d.map((m) => (
                      <Visor3DSI key={m} modelo={m} idioma={p.idioma} elevacionSolDeg={ctx.elevacionSolDeg} />
                    ))}
                  </Suspense>
                </div>
              )}
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
                    ? x.meta.modeloUsado
                    : x.meta.origen === "motor" ? (x.meta.resultadosMotor?.some(r => r.escenario)
                      ? t("Calculated by the TERRA-X engine", "Calculado por el motor de TERRA-X")
                      : t("No verified engine result", "Sin resultado verificado del motor")) : t(
                        "Answer built from the card only",
                        "Respuesta armada solo con la ficha",
                      )}
                  {x.meta.aviso ? ` · ${x.meta.aviso}` : ""}
                  {x.meta.verificacion.valido && (x.meta.verificacion.cifrasMotorVerificadas ?? 0) > 0 && <>
                    <br />✓ {x.meta.verificacion.cifrasMotorVerificadas} {t("figures verified against TERRA-X engine data", "cifras verificadas contra datos del motor de TERRA-X")}
                  </>}
                </p>
              )}
              {x.meta?.resultadosMotor?.some(r => r.escenario) && <details className="si-meta mono">
                <summary>{t("Engine provenance", "Procedencia del motor")}</summary>
                {x.meta.resultadosMotor.map((r, i) => r.escenario && <div key={i}>
                  <p>{t("Scenario", "Escenario")} {String.fromCharCode(65 + i)} · {r.escenario.punto.fila}, {r.escenario.punto.col} · {r.escenario.periodo.desde} / {r.escenario.periodo.hasta}</p>
                  <p>scenario_id: <code>{r.escenario.scenario_id ?? t("not supplied by the point endpoint", "no suministrado por el endpoint de punto")}</code></p>
                  <p>{t("Engine", "Motor")}: {r.escenario.meta.motor_version}</p>
                  {typeof r.escenario.punto.horizonte?.detalle === "string" && <p>{r.escenario.punto.horizonte.detalle}</p>}
                  <p>{t("Parameter SHA-256", "SHA-256 de parámetros")}: <code>{r.escenario.meta.parametros_sha256}</code></p>
                </div>)}
              </details>}
            </div>
          ))}
          {cargando && (
            <div className="si-turno guia">
                <span
                  className="si-puntos"
                  aria-label={t("Thinking", "Pensando")}
                >
                  <i />
                  <i />
                  <i />
                </span>
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
          <textarea
            ref={inputRef}
            rows={1}
            value={entrada}
            onChange={(e) => {
              setEntrada(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(140, el.scrollHeight)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                enviar(entrada);
              }
            }}
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
