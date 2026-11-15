/** The published ranking (fichas/indice.json): every candidate and control with its verdict and scores. */
export interface EntradaRanking {
  id: string;
  nombre: string;
  control: string | null;
  etiqueta: string;
  orden: number | null;
  C: number | null;
  E: number;
  L: number;
  U: number;
  lugar: { lat: number; lon: number; alt_m: number | null };
}
export interface Ranking {
  region: string;
  umbral: number;
  entradas: EntradaRanking[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function entrada(v: unknown): EntradaRanking | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || !/^[\w-]+$/.test(o.id) || typeof o.etiqueta !== "string") return null;
  const lugar = (typeof o.lugar === "object" && o.lugar !== null ? o.lugar : {}) as Record<string, unknown>;
  const E = num(o.E);
  const L = num(o.L);
  const U = num(o.U);
  if (E === null || L === null || U === null) return null;
  return {
    id: o.id,
    nombre: typeof o.nombre === "string" ? o.nombre.replace(" (maqueta)", "") : o.id,
    control: typeof o.control === "string" ? o.control : null,
    etiqueta: o.etiqueta,
    orden: num(o.orden),
    C: num(o.C),
    E,
    L,
    U,
    lugar: { lat: num(lugar.lat) ?? 0, lon: num(lugar.lon) ?? 0, alt_m: num(lugar.alt_m) },
  };
}

let cache: Promise<Ranking> | undefined;

/** Ranked ones first (by `orden`), then the rest by C, incompatibles last. Read once per session. */
export function readRanking(): Promise<Ranking> {
  cache ??= (async () => {
    const r = await fetch("/data/fichas/indice.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("unavailable");
    const v = (await r.json()) as Record<string, unknown>;
    const vistos = new Set<string>();
    const entradas: EntradaRanking[] = [];
    for (const lista of [v.candidatas, v.controles]) {
      if (!Array.isArray(lista)) continue;
      for (const x of lista) {
        const e = entrada(x);
        if (e && !vistos.has(e.id)) {
          vistos.add(e.id);
          entradas.push(e);
        }
      }
    }
    entradas.sort((a, b) => {
      const ia = a.etiqueta === "incompatible" ? 1 : 0;
      const ib = b.etiqueta === "incompatible" ? 1 : 0;
      if (ia !== ib) return ia - ib;
      if (a.orden !== null && b.orden !== null) return a.orden - b.orden;
      if (a.orden !== null) return -1;
      if (b.orden !== null) return 1;
      return (b.C ?? -1) - (a.C ?? -1);
    });
    return { region: typeof v.region === "string" ? v.region : "", umbral: num(v.umbral) ?? 0.7, entradas };
  })();
  return cache;
}
