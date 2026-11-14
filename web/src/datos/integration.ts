import { Ficha, Manifest, validFicha, validManifest } from "./contract";
type ObjectValue = Record<string, unknown>;
function object(v: unknown): v is ObjectValue {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function strings(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
async function json(path: string): Promise<unknown> {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error("unavailable");
  return r.json();
}
const stateNames: Record<string, string> = {
  fuerte: "Strong",
  debil: "Weak",
  desconocido: "Unknown",
  no_comparable: "Not comparable",
};
const terms: Record<string, string> = {
  energia: "Solar power profile",
  contraste_sombras: "Shadow contrast",
  gravedad: "Gravity",
  vacio: "Vacuum",
  radiacion: "Radiation",
  polvo: "Dust",
  tiempo: "Time scales",
  material: "Surface material composition",
  transitabilidad_fina: "Fine-scale traversability",
};
/** Normalize copies for presentation; preserve all upstream scientific exports. */
export function adaptManifest(v: unknown): Manifest {
  if (validManifest(v)) return v;
  if (
    !object(v) ||
    typeof v.proyecto !== "string" ||
    typeof v.version !== "string" ||
    typeof v.fecha !== "string" ||
    typeof v.maqueta !== "boolean" ||
    !Array.isArray(v.fuentes)
  )
    throw new Error("invalid manifest");
  const fuentes = v.fuentes.map((f) => {
    if (
      !object(f) ||
      typeof f.id !== "string" ||
      typeof f.licencia !== "string" ||
      !(f.sha256 === null || typeof f.sha256 === "string")
    )
      throw new Error("invalid source");
    return {
      id: f.id,
      nombre: f.id,
      licencia: f.licencia,
      sha256: f.sha256 ?? "",
    };
  });
  return {
    proyecto: v.proyecto,
    version: v.version,
    fecha: v.fecha,
    maqueta: v.maqueta,
    fuentes,
  };
}
export function adaptFicha(v: unknown): Ficha {
  if (validFicha(v)) return { ...v, source: v };
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    !v.id ||
    typeof v.nombre !== "string" ||
    typeof v.region !== "string" ||
    typeof v.etiqueta !== "string" ||
    typeof v.maqueta !== "boolean" ||
    !object(v.lugar) ||
    !object(v.dimensiones) ||
    !strings(v.medir_primero) ||
    !strings(v.no_transfiere) ||
    !Array.isArray(v.horario)
  )
    throw new Error("invalid card");
  const dimensions: Record<string, string> = {};
  for (const key of [
    "relieve",
    "iluminacion",
    "materiales",
    "temperatura",
    "agua_hielo",
    "polvo_viento",
    "biologia",
    "operaciones_roboticas",
  ]) {
    const d = v.dimensiones[key];
    if (!object(d) || typeof d.valor !== "string" || !stateNames[d.valor])
      throw new Error("invalid dimension");
    dimensions[key] = stateNames[d.valor];
  }
  const supported = v.etiqueta === "analogo_sostenido";
  const normalized = {
    ...v,
    C: v.C === null ? 0 : v.C,
    etiqueta: supported
      ? "sostenido"
      : v.etiqueta === "no_podemos_concluir"
        ? "no_puede"
        : v.etiqueta,
    lugar: { ...v.lugar, nombre: v.nombre, region: v.region },
    dimensiones: dimensions,
    medir_primero: v.medir_primero.map((s) => terms[s] ?? s).join("; "),
    no_transfiere: v.no_transfiere.map((s) => terms[s] ?? s),
    resumen:
      v.etiqueta === "incompatible"
        ? "This candidate does not meet the requirements."
        : supported
          ? "The available evidence supports this candidate within the model limits."
          : "Read the evidence and remaining uncertainties before choosing this candidate.",
  };
  if (!validFicha(normalized)) throw new Error("invalid normalized card");
  return { ...normalized, C: v.C === null ? null : normalized.C, source: v };
}
export async function readManifest() {
  return adaptManifest(await json("/data/manifest.json"));
}
export async function readFicha(id = "P-07") {
  if (!/^[\w-]+$/.test(id)) throw new Error("invalid id");
  return adaptFicha(await json(`/data/fichas/${id}.json`));
}
export interface IndexEntry {
  id: string;
  nombre: string;
}
export async function readIndex(): Promise<IndexEntry[]> {
  const v = await json("/data/fichas/indice.json");
  if (
    !object(v) ||
    !Array.isArray(v.candidatas) ||
    !v.candidatas.every(
      (c) =>
        object(c) &&
        typeof c.id === "string" &&
        /^[\w-]+$/.test(c.id) &&
        typeof c.nombre === "string",
    )
  )
    throw new Error("invalid index");
  return v.candidatas as IndexEntry[];
}
