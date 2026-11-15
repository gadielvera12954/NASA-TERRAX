/**
 * Data layer of the 3D lab.
 *
 * Two sources answer the same question ("what happens to a rover parked HERE?"):
 *  - the live engine (servidor/, Python): the real motor/ code, 360-azimuth ray-cast over LOLA
 *    relief out to 300 km, any date covered by DE421, custom vehicle;
 *  - the browser (this file): the same formulas F3–F7 over the exported files only
 *    (horizontes.bin with 72 azimuths + the Sun series with margin in /laboratorio).
 * Every result says which one produced it. No number is invented here: constants come from
 * /laboratorio/indice.json, which is written from parametros.yaml.
 */

export interface TerrenoInfo {
  filas: number;
  columnas: number;
  pixel_m: number;
  pixel_malla_m: number;
  x0_m: number;
  y0_m: number;
  z_min_m: number;
  z_max_m: number;
  proyeccion: { tipo: string; radio_m: number; lon0_deg: number };
  fuentes: { id: string; sha256: string | null; url?: string }[];
}
export interface Horizontes {
  nAz: number;
  ancho: number;
  alto: number;
  convergencia: number;
  pixelM: number;
  datos: Uint8Array;
}
export interface SerieSol {
  lunacion: { nombre: string; desde: string; hasta: string };
  lugar: { lat: number; lon: number; nombre: string };
  t0_utc: string;
  paso_s: number;
  n: number;
  i0: number;
  i1: number;
  azimut_deg: number[];
  elevacion_deg: number[];
}
export interface Vehiculo {
  plantilla: string;
  panel_w: number;
  lados_deg: number[];
  bateria_wh: number;
  supervivencia_h: number;
  p_surv_w: number;
  consumo_w: number;
  consumo_sensibilidad_w: number[];
  reserva_frac: number;
  bateria_inicial_frac: number;
  pendiente_max_deg: number;
}
export interface IndiceLab {
  vehiculo: Vehiculo;
  limite_refugio_h: number;
  radio_angular_sol_deg: number;
  campo: {
    lugar: { nombre: string; lat: number; lon: number; alt_m: number };
    fecha: string;
    tablita_alto_m: number;
    tablita_ancho_min_m: number;
    e_min_deg: number;
    e_max_deg: number;
    meta_error_frac: number;
  };
  parametros_sha256: string;
}
export interface Resultado {
  sol_en_paneles_frac: number;
  sobre_p_surv_frac: number;
  potencia_media_w: number;
  tramo_oscuro_mas_largo_h: number;
  noche_geometrica_h: number;
  bateria_minima_wh: number;
  bateria_minima_frac: number;
  condiciones: { oscuridad: boolean; bateria: boolean; pendiente: boolean };
  en_riesgo: boolean;
  consumo_w: number;
  pendiente_local_deg: number;
}
export interface SerieEscenario {
  t0_utc: string;
  paso_s: number;
  n: number;
  i0: number;
  i1: number;
  azimut_deg: number[];
  elevacion_deg: number[];
  horizonte_deg: number[];
  disco_visible: number[];
  potencia_w: number[];
  paneles_w: number[][];
  bateria_wh: number[];
}
export interface Escenario {
  origen: "motor-en-vivo" | "navegador";
  punto: {
    fila: number;
    col: number;
    lat: number;
    lon: number;
    convergencia_deg: number;
    altura_m: number | null;
    pendiente_deg: number | null;
    horizonte: { tipo: string; n_az: number; detalle: string };
  };
  periodo: { lunacion: string | null; desde: string; hasta: string };
  vehiculo: {
    panel_w: number;
    bateria_wh: number;
    consumo_w: number;
    p_surv_w: number;
    reserva_frac: number;
    lados_deg: number[];
  };
  limite_refugio_h: number;
  resultado: Resultado;
  serie: SerieEscenario;
  horizonte_grilla_deg: number[] | null;
  calculo_ms: number;
}
export interface PedidoEscenario {
  fila: number;
  col: number;
  lunacion?: string;
  desde?: string;
  hasta?: string;
  consumo_w: number;
  panel_w: number;
  bateria_wh: number;
}
export interface EstadoMotor {
  motor: string;
  version: string;
  parametros_sha256: string;
  relieve: { grillas_reales: boolean; capas: number; margen_km: number };
  hora_utc: string;
}
export interface SolAhora {
  hora_utc: string;
  luna: { nombre: string; azimut_deg: number; elevacion_deg: number; sobre_horizonte_liso: boolean };
  tierra: { nombre: string; azimut_deg: number; elevacion_aparente_deg: number };
}
export interface SombraCampo {
  lugar: { nombre: string; lat: number; lon: number; alt_m: number };
  fecha: string;
  hora_local: string;
  alto_m: number;
  meta_error_frac: number;
  prediccion: {
    hora_utc: string;
    azimut_deg: number;
    elevacion_geometrica_deg: number;
    elevacion_aparente_deg: number;
    en_rango_h2: boolean;
    rango_h2_deg: [number, number];
    sombra_m: number | null;
    penumbra_m: number | null;
    ancho_minimo_m: number | null;
    tolerancia_deg: number | null;
  };
  comparacion: null | {
    sombra_medida_m: number;
    sombra_calculada_m: number;
    sombra_corregida_m: number;
    error_frac: number;
    error_corregido_frac: number;
    en_rango_h2: boolean;
    avisos: string[];
    pasa: boolean;
    meta: number;
  };
}

const RAD = Math.PI / 180;
const BASE = (import.meta.env.VITE_MOTOR_URL as string | undefined) ?? "";

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error("unavailable");
  return (await r.json()) as T;
}
function unaVez<T>(f: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    if (!p)
      p = f().catch((e) => {
        p = null;
        throw e;
      });
    return p;
  };
}

/* ------------------------------------------------------------------ static exports */
export const leerTerrenoInfo = unaVez(async () => {
  const m = await json<{ terreno: TerrenoInfo }>("/modelos/modelos.json");
  return m.terreno;
});
export const leerIndiceLab = unaVez(() => json<IndiceLab>("/laboratorio/indice.json"));
const series = new Map<string, Promise<SerieSol>>();
export function leerSerieSol(lunacion: string): Promise<SerieSol> {
  if (!/^[a-z]+$/.test(lunacion)) return Promise.reject(new Error("invalid"));
  let p = series.get(lunacion);
  if (!p) {
    p = json<SerieSol>(`/laboratorio/sol_${lunacion}.json`);
    p.catch(() => series.delete(lunacion));
    series.set(lunacion, p);
  }
  return p;
}

/** horizontes.bin, TXHZ v1 (esquemas/horizontes_bin.md). */
export const leerHorizontes = unaVez(async (): Promise<Horizontes> => {
  const r = await fetch("/data/destino/horizontes.bin");
  if (!r.ok) throw new Error("unavailable");
  const buf = await r.arrayBuffer();
  const v = new DataView(buf);
  const magia = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magia !== "TXHZ" || v.getUint8(4) !== 1) throw new Error("horizontes.bin: unknown format");
  const nAz = v.getUint16(8, true);
  if (v.getUint16(10, true) !== 128 || v.getUint16(12, true) !== 10)
    throw new Error("horizontes.bin: unsupported variant");
  const ancho = v.getUint32(16, true);
  const alto = v.getUint32(20, true);
  if (buf.byteLength !== 32 + nAz * alto * ancho) throw new Error("horizontes.bin: wrong size");
  return {
    nAz,
    ancho,
    alto,
    convergencia: v.getInt32(24, true) / 1000,
    pixelM: v.getUint32(28, true) / 1000,
    datos: new Uint8Array(buf, 32),
  };
});

/** Contract lookup rule: nearest azimuth, ties upward. */
export function indiceAzimut(azGrilla: number, nAz: number): number {
  const k = Math.floor(azGrilla / (360 / nAz) + 0.5) % nAz;
  return (k + nAz) % nAz;
}

/** 16-bit grayscale PNG (refugios_*.png: continuous hours without Sun; 65535 = no data). */
export async function leerPng16(url: string): Promise<{ ancho: number; alto: number; datos: Uint16Array }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("unavailable");
  const b = new Uint8Array(await r.arrayBuffer());
  const v = new DataView(b.buffer);
  let i = 8;
  let ancho = 0;
  let alto = 0;
  const trozos: Uint8Array[] = [];
  while (i < b.length) {
    const n = v.getUint32(i);
    const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (tipo === "IHDR") {
      ancho = v.getUint32(i + 8);
      alto = v.getUint32(i + 12);
      if (b[i + 16] !== 16 || b[i + 17] !== 0 || b[i + 20] !== 0)
        throw new Error("only 16-bit grayscale, non-interlaced PNG");
    } else if (tipo === "IDAT") trozos.push(b.subarray(i + 8, i + 8 + n));
    i += 12 + n;
  }
  if (typeof DecompressionStream === "undefined") throw new Error("no DecompressionStream");
  const flujo = new Blob(trozos as BlobPart[]).stream().pipeThrough(new DecompressionStream("deflate"));
  const crudo = new Uint8Array(await new Response(flujo).arrayBuffer());
  const paso = 1 + 2 * ancho;
  const datos = new Uint16Array(ancho * alto);
  const previa = new Uint8Array(2 * ancho);
  const linea = new Uint8Array(2 * ancho);
  for (let f = 0; f < alto; f++) {
    const filtro = crudo[f * paso];
    for (let x = 0; x < 2 * ancho; x++) {
      const c = crudo[f * paso + 1 + x];
      const a = x >= 2 ? linea[x - 2] : 0;
      const up = previa[x];
      const ul = x >= 2 ? previa[x - 2] : 0;
      let val = c;
      if (filtro === 1) val = c + a;
      else if (filtro === 2) val = c + up;
      else if (filtro === 3) val = c + ((a + up) >> 1);
      else if (filtro === 4) {
        const p = a + up - ul;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - ul);
        val = c + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul);
      }
      linea[x] = val & 255;
    }
    for (let x = 0; x < ancho; x++) datos[f * ancho + x] = (linea[2 * x] << 8) | linea[2 * x + 1];
    previa.set(linea);
  }
  return { ancho, alto, datos };
}

/* ------------------------------------------------------------------ geometry */
/** South polar stereographic inverse (motor/horizonte/geometria.py). */
export function latLonDePixel(info: TerrenoInfo, fila: number, col: number) {
  const x = info.x0_m + col * info.pixel_m;
  const y = info.y0_m - fila * info.pixel_m;
  const rho = Math.hypot(x, y);
  const lat = (2 * Math.atan(rho / (2 * info.proyeccion.radio_m)) - Math.PI / 2) / RAD;
  let lon = Math.atan2(x, y) / RAD + info.proyeccion.lon0_deg;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const conv = ((((lon - info.proyeccion.lon0_deg + 180) % 360) + 360) % 360) - 180;
  return { lat, lon, conv };
}
type V3 = [number, number, number];
function baseEnu(lat: number, lon: number): { e: V3; n: V3; u: V3 } {
  const sl = Math.sin(lat * RAD);
  const cl = Math.cos(lat * RAD);
  const so = Math.sin(lon * RAD);
  const co = Math.cos(lon * RAD);
  return { e: [-so, co, 0], n: [-sl * co, -sl * so, cl], u: [cl * co, cl * so, sl] };
}
/** Sun seen from another point of the body: same direction, different local frame. */
function trasladarSol(az: number, el: number, desde: ReturnType<typeof baseEnu>, hasta: ReturnType<typeof baseEnu>) {
  const ce = Math.cos(el * RAD);
  const se = ce * Math.sin(az * RAD);
  const sn = ce * Math.cos(az * RAD);
  const su = Math.sin(el * RAD);
  const s: V3 = [0, 1, 2].map((k) => desde.e[k] * se + desde.n[k] * sn + desde.u[k] * su) as V3;
  const dot = (a: V3) => a[0] * s[0] + a[1] * s[1] + a[2] * s[2];
  const el2 = Math.asin(Math.max(-1, Math.min(1, dot(hasta.u)))) / RAD;
  const az2 = ((Math.atan2(dot(hasta.e), dot(hasta.n)) / RAD) % 360 + 360) % 360;
  return { az: az2, el: el2 };
}

/* ------------------------------------------------------------------ formulas F3–F7 */
/** F3: visible fraction of the solar disc above a horizon of height e_h. */
export function fraccionDisco(e: number, eh: number, rho: number): number {
  const x = Math.max(-1, Math.min(1, (e - eh) / rho));
  return Math.max(0, Math.min(1, 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI));
}
/** F4: vertical panels; azimuth difference between the Sun and each panel normal. */
export function potenciaPaneles(e: number, azSol: number, rumbo: number, lados: number[], panelW: number, fsol: number) {
  return lados.map((a) => {
    const c = Math.cos(e * RAD) * Math.cos((azSol - rumbo - a) * RAD);
    return c > 1e-12 ? panelW * c * fsol : 0;
  });
}
/** F15 (Sæmundsson): refraction in degrees for a geometric elevation, standard conditions. */
export function refraccionDeg(e: number): number {
  if (e <= -1) return 0;
  return 1.02 / Math.tan((e + 10.3 / (e + 5.11)) * RAD) / 60;
}
/** F19: length of the fuzzy shadow tip. */
export function penumbraM(alto: number, e: number, rho: number): number {
  return alto * (1 / Math.tan((e - rho) * RAD) - 1 / Math.tan((e + rho) * RAD));
}
function tramos(m: boolean[] | Uint8Array): [number, number][] {
  const out: [number, number][] = [];
  let a = -1;
  for (let i = 0; i <= m.length; i++) {
    const on = i < m.length && !!m[i];
    if (on && a < 0) a = i;
    if (!on && a >= 0) {
      out.push([a, i - 1]);
      a = -1;
    }
  }
  return out;
}
export function tramosDe(valores: number[], prueba: (v: number, i: number) => boolean): [number, number][] {
  return tramos(valores.map(prueba));
}

/** Same procedure as motor/destino/simulacion.simular_punto, over the exported files. */
export async function simularEnNavegador(p: PedidoEscenario): Promise<Escenario> {
  const t0 = performance.now();
  if (!p.lunacion) throw new Error("custom-dates-need-engine");
  const [info, idx, hz, sol] = await Promise.all([
    leerTerrenoInfo(),
    leerIndiceLab(),
    leerHorizontes(),
    leerSerieSol(p.lunacion),
  ]);
  const { lat, lon, conv } = latLonDePixel(info, p.fila, p.col);
  const centro = baseEnu(sol.lugar.lat, sol.lugar.lon);
  const aqui = baseEnu(lat, lon);
  const n = sol.n;
  const az: number[] = new Array(n);
  const el: number[] = new Array(n);
  const eh: number[] = new Array(n);
  const fs: number[] = new Array(n);
  const pot: number[] = new Array(n);
  const lados = idx.vehiculo.lados_deg;
  const paneles: number[][] = lados.map(() => new Array(n));
  const pSurv = p.bateria_wh / idx.vehiculo.supervivencia_h; // F6
  const pixeles = hz.alto * hz.ancho;
  const perfil: number[] = [];
  for (let k = 0; k < hz.nAz; k++) perfil.push((hz.datos[k * pixeles + p.fila * hz.ancho + p.col] - 128) / 10);
  for (let i = 0; i < n; i++) {
    const s = trasladarSol(sol.azimut_deg[i], sol.elevacion_deg[i], centro, aqui);
    az[i] = s.az;
    el[i] = s.el;
    eh[i] = perfil[indiceAzimut((s.az + conv + 360) % 360, hz.nAz)];
    fs[i] = fraccionDisco(s.el, eh[i], idx.radio_angular_sol_deg);
    const pp = potenciaPaneles(s.el, s.az, s.az - 45, lados, p.panel_w, fs[i]);
    pp.forEach((w, k) => (paneles[k][i] = w));
    pot[i] = pp.reduce((a, b) => a + b, 0);
  }
  const pasoH = sol.paso_s / 3600;
  const bat: number[] = new Array(n + 1);
  bat[0] = p.bateria_wh * idx.vehiculo.bateria_inicial_frac;
  for (let i = 0; i < n; i++) bat[i + 1] = Math.min(p.bateria_wh, Math.max(0, bat[i] + (pot[i] - p.consumo_w) * pasoH));
  const { i0, i1 } = sol;
  const toca = ([a, b]: [number, number]) => a <= i1 - 1 && b >= i0;
  const oscuros = tramosDe(pot, (v) => v < pSurv).filter(toca);
  const noches = tramosDe(el, (v, i) => v < eh[i]).filter(toca);
  const largo = (l: [number, number][]) => l.reduce((m, [a, b]) => Math.max(m, (b - a + 1) * pasoH), 0);
  let s0 = i0;
  let s1 = i1 - 1;
  for (const [a, b] of oscuros) {
    s0 = Math.min(s0, a);
    s1 = Math.max(s1, b);
  }
  let eMin = Infinity;
  for (let i = s0; i <= s1 + 1; i++) eMin = Math.min(eMin, bat[i]);
  const ventana = pot.slice(i0, i1);
  const tramoH = largo(oscuros);
  const cond = {
    oscuridad: tramoH > idx.limite_refugio_h,
    bateria: eMin < idx.vehiculo.reserva_frac * p.bateria_wh,
    pendiente: false,
  };
  const r1 = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    origen: "navegador",
    punto: {
      fila: p.fila,
      col: p.col,
      lat: r1(lat, 5),
      lon: r1(lon, 5),
      convergencia_deg: r1(conv, 3),
      altura_m: null,
      pendiente_deg: null,
      horizonte: { tipo: "relieve", n_az: hz.nAz, detalle: `horizontes.bin (${hz.nAz} azimuths)` },
    },
    periodo: { lunacion: p.lunacion, desde: sol.lunacion.desde, hasta: sol.lunacion.hasta },
    vehiculo: {
      panel_w: p.panel_w,
      bateria_wh: p.bateria_wh,
      consumo_w: p.consumo_w,
      p_surv_w: r1(pSurv, 2),
      reserva_frac: idx.vehiculo.reserva_frac,
      lados_deg: lados,
    },
    limite_refugio_h: idx.limite_refugio_h,
    resultado: {
      sol_en_paneles_frac: r1(ventana.filter((v) => v > 0).length / ventana.length, 4),
      sobre_p_surv_frac: r1(ventana.filter((v) => v >= pSurv).length / ventana.length, 4),
      potencia_media_w: r1(ventana.reduce((a, b) => a + b, 0) / ventana.length, 1),
      tramo_oscuro_mas_largo_h: tramoH,
      noche_geometrica_h: largo(noches),
      bateria_minima_wh: r1(eMin, 1),
      bateria_minima_frac: r1(eMin / p.bateria_wh, 4),
      condiciones: cond,
      en_riesgo: cond.oscuridad || cond.bateria || cond.pendiente,
      consumo_w: p.consumo_w,
      pendiente_local_deg: 0,
    },
    serie: {
      t0_utc: sol.t0_utc,
      paso_s: sol.paso_s,
      n,
      i0,
      i1,
      azimut_deg: az,
      elevacion_deg: el,
      horizonte_deg: eh,
      disco_visible: fs,
      potencia_w: pot,
      paneles_w: paneles,
      bateria_wh: bat.slice(0, n),
    },
    horizonte_grilla_deg: perfil,
    calculo_ms: Math.round(performance.now() - t0),
  };
}

/* ------------------------------------------------------------------ live engine */
async function pedir<T>(ruta: string, cuerpo?: unknown, ms = 30000): Promise<T> {
  const control = new AbortController();
  const reloj = window.setTimeout(() => control.abort(), ms);
  try {
    const r = await fetch(BASE + ruta, {
      method: cuerpo === undefined ? "GET" : "POST",
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: control.signal,
      cache: "no-store",
    });
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("json")) throw new Error("engine-unreachable");
    const j = await r.json();
    if (!r.ok) throw new ErrorMotor(typeof j?.error === "string" ? j.error : "engine error", r.status);
    return j as T;
  } finally {
    window.clearTimeout(reloj);
  }
}
export class ErrorMotor extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function estadoMotor(): Promise<EstadoMotor | null> {
  try {
    const e = await pedir<EstadoMotor>("/api/estado", undefined, 2500);
    return e && e.motor === "terra-x" ? e : null;
  } catch {
    return null;
  }
}
export const pedirEscenario = (p: PedidoEscenario) => pedir<Escenario>("/api/destino/punto", p);
export const pedirSolAhora = () => pedir<SolAhora>("/api/sol/ahora", undefined, 8000);
export const pedirSombra = (cuerpo: Record<string, unknown>) => pedir<SombraCampo>("/api/campo/sombra", cuerpo, 15000);
