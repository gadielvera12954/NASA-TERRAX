/** SI adapter only: scientific routes and computations remain owned by Jean. */
import { Escenario } from "./laboratorio";

export interface PedidoMotorSI {
  fila: number;
  col: number;
  lunacion?: string;
  desde?: string;
  hasta?: string;
  consumo_w?: number;
  panel_w?: number;
  bateria_wh?: number;
  horizonte?: "auto" | "relieve" | "liso";
}

export interface EscenarioMotorSI extends Pick<Escenario, "origen" | "punto" | "periodo" | "vehiculo" | "resultado"> {
  scenario_id?: string;
  meta: { parametros_sha256: string; motor_version: string; producto?: string };
}

export type ResultadoMotorSI =
  | { escenario: EscenarioMotorSI; error?: never }
  | { error: string; escenario?: never };

export class ErrorMotorSI extends Error {
  constructor(public motivo: "contexto" | "conexion" | "contrato" | "comparacion", mensaje: string) {
    super(mensaje);
  }
}

const BASE = ((import.meta.env.VITE_MOTOR_URL as string | undefined) ?? "").replace(/\/$/, "");
const registro = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finito = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Copies only supported inputs. A site ID is never treated as a grid position. */
export function validarPedidoSI(v: unknown): PedidoMotorSI {
  if (!registro(v) || !Number.isInteger(v.fila) || !Number.isInteger(v.col)
    || (v.fila as number) < 0 || (v.col as number) < 0) {
    throw new ErrorMotorSI("contexto", "A real grid row and column are required.");
  }
  const p: PedidoMotorSI = { fila: v.fila as number, col: v.col as number };
  if (v.lunacion === "verano" || v.lunacion === "invierno") p.lunacion = v.lunacion;
  else if (v.lunacion != null) throw new ErrorMotorSI("contexto", "Unsupported lunation.");
  else {
    if (typeof v.desde !== "string" || typeof v.hasta !== "string"
      || !/^\d{4}-\d{2}-\d{2}$/.test(v.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(v.hasta)
      || !Number.isFinite(Date.parse(v.desde)) || !Number.isFinite(Date.parse(v.hasta))
      || new Date(v.desde).toISOString().slice(0, 10) !== v.desde || new Date(v.hasta).toISOString().slice(0, 10) !== v.hasta
      || Date.parse(v.hasta) <= Date.parse(v.desde)) {
      throw new ErrorMotorSI("contexto", "A lunation or an explicit date range is required.");
    }
    p.desde = v.desde; p.hasta = v.hasta;
  }
  for (const [k, min, max] of [["consumo_w", 10, 500], ["panel_w", 50, 2000], ["bateria_wh", 500, 50000]] as const) {
    if (v[k] == null) continue;
    if (!finito(v[k]) || v[k] < min || v[k] > max) throw new ErrorMotorSI("contexto", `Invalid ${k}.`);
    p[k] = v[k];
  }
  if (v.horizonte != null) {
    if (!["auto", "relieve", "liso"].includes(String(v.horizonte))) throw new ErrorMotorSI("contexto", "Invalid horizon.");
    p.horizonte = v.horizonte as PedidoMotorSI["horizonte"];
  }
  return p;
}

/** Validate the scientific fields used in the explanation and their provenance. */
export function validarEscenarioSI(v: unknown, pedido: PedidoMotorSI, requiereId = false): EscenarioMotorSI {
  if (!registro(v) || v.origen !== "motor-en-vivo" || !registro(v.punto)
    || v.punto.fila !== pedido.fila || v.punto.col !== pedido.col
    || !registro(v.resultado) || !registro(v.periodo) || !registro(v.meta) || !registro(v.vehiculo)
    || typeof v.meta.parametros_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(v.meta.parametros_sha256)
    || typeof v.meta.motor_version !== "string" || !v.meta.motor_version.trim()
    || typeof v.periodo.desde !== "string" || typeof v.periodo.hasta !== "string"
    || (pedido.lunacion ? v.periodo.lunacion !== pedido.lunacion
      : v.periodo.desde !== pedido.desde || v.periodo.hasta !== pedido.hasta)
    || (requiereId && (typeof v.scenario_id !== "string" || !/^[a-f0-9]{64}$/i.test(v.scenario_id)))) {
    throw new ErrorMotorSI("contrato", "The engine response does not match the requested scenario or lacks provenance.");
  }
  for (const k of ["noche_geometrica_h", "tramo_oscuro_mas_largo_h", "potencia_media_w", "bateria_minima_wh"]) {
    if (!finito(v.resultado[k])) throw new ErrorMotorSI("contrato", "Missing or invalid engine metric.");
  }
  for (const k of ["consumo_w", "panel_w", "bateria_wh"] as const) {
    if (pedido[k] !== undefined && v.vehiculo[k] !== pedido[k]) throw new ErrorMotorSI("contrato", "The engine used different vehicle parameters.");
  }
  if (!registro(v.resultado.condiciones) || typeof v.resultado.en_riesgo !== "boolean"
    || ["oscuridad", "bateria", "pendiente"].some(k => typeof (v.resultado as Record<string, unknown> & { condiciones: Record<string, unknown> }).condiciones[k] !== "boolean")) {
    throw new ErrorMotorSI("contrato", "Missing engine verdict conditions.");
  }
  return v as unknown as EscenarioMotorSI;
}

async function post(ruta: string, cuerpo: unknown): Promise<unknown> {
  const control = new AbortController();
  const reloj = window.setTimeout(() => control.abort(), 30000);
  try {
    const r = await fetch(BASE + ruta, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo), signal: control.signal, cache: "no-store",
    });
    if (ruta.endsWith("comparar") && [404, 405, 501].includes(r.status)) {
      throw new ErrorMotorSI("comparacion", "The batch comparison endpoint is not available yet.");
    }
    if (!r.ok) throw new ErrorMotorSI("conexion", "The engine could not complete this request.");
    if (!(r.headers.get("content-type") ?? "").includes("json")) throw new ErrorMotorSI("conexion", "The engine is unavailable.");
    return await r.json();
  } catch (e) {
    if (e instanceof ErrorMotorSI) throw e;
    throw new ErrorMotorSI("conexion", "The engine is unreachable or timed out.");
  } finally {
    window.clearTimeout(reloj);
  }
}

export async function analizarPuntoSI(entrada: unknown): Promise<ResultadoMotorSI[]> {
  const pedido = validarPedidoSI(entrada);
  return [{ escenario: validarEscenarioSI(await post("/api/destino/punto", pedido), pedido) }];
}

/** J4 contract from Jean: ordered wrappers with ok/id/escenario and per-item failures. */
export async function compararEscenariosSI(entradas: unknown): Promise<ResultadoMotorSI[]> {
  if (!Array.isArray(entradas) || entradas.length < 2 || entradas.length > 3) throw new ErrorMotorSI("contexto", "Two or three scenarios are required.");
  const pedidos = entradas.map(validarPedidoSI);
  const j = await post("/api/destino/comparar", { escenarios: pedidos, series: false });
  if (!registro(j) || j.origen !== "motor-en-vivo" || !Array.isArray(j.escenarios) || j.escenarios.length !== pedidos.length) {
    throw new ErrorMotorSI("contrato", "The batch response does not match the agreed adapter contract.");
  }
  return j.escenarios.map((v: unknown, i: number) => {
    if (registro(v) && v.id === String.fromCharCode(65 + i) && v.ok === false && typeof v.error === "string") {
      return { error: "The engine could not calculate this scenario." };
    }
    try {
      if (!registro(v) || v.id !== String.fromCharCode(65 + i) || v.ok !== true
        || !registro(v.escenario) || v.scenario_id !== v.escenario.scenario_id) throw new Error("Mismatched scenario wrapper");
      return { escenario: validarEscenarioSI(v.escenario, pedidos[i], true) };
    }
    catch { return { error: "The scenario response could not be verified." }; }
  });
}

export async function estadoSI(): Promise<boolean> {
  const control = new AbortController();
  const reloj = window.setTimeout(() => control.abort(), 2500);
  try {
    const r = await fetch(BASE + "/api/si/estado", { signal: control.signal, cache: "no-store" });
    const j: unknown = await r.json();
    return r.ok && registro(j) && j.disponible === true;
  } catch { return false; }
  finally { window.clearTimeout(reloj); }
}
