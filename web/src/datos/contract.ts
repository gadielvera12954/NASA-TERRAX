export interface Manifest {
  proyecto: string;
  version: string;
  maqueta: boolean;
  fecha: string;
  fuentes: { id: string; nombre: string; licencia: string; sha256: string }[];
}
export interface Ficha {
  id: string;
  etiqueta: string;
  maqueta: boolean;
  lugar: { lat: number; lon: number; region: string; nombre: string };
  C: number;
  E: number;
  L: number;
  U: number;
  dimensiones: Record<string, string>;
  horario: { fecha: string; desde: string; hasta: string }[];
  no_transfiere: string[];
  medir_primero: string;
  resumen: string;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validManifest(value: unknown): value is Manifest {
  return (
    record(value) &&
    typeof value.proyecto === "string" &&
    typeof value.version === "string" &&
    typeof value.fecha === "string" &&
    typeof value.maqueta === "boolean" &&
    Array.isArray(value.fuentes) &&
    value.fuentes.every(
      (f) =>
        record(f) &&
        ["id", "nombre", "licencia", "sha256"].every(
          (k) => typeof f[k] === "string",
        ),
    )
  );
}
export function validFicha(value: unknown): value is Ficha {
  if (!record(value) || !record(value.lugar) || !record(value.dimensiones))
    return false;
  return (
    ["id", "etiqueta", "medir_primero", "resumen"].every(
      (k) => typeof value[k] === "string",
    ) &&
    typeof value.maqueta === "boolean" &&
    ["C", "E", "L", "U"].every(
      (k) =>
        typeof value[k] === "number" &&
        Number.isFinite(value[k]) &&
        (value[k] as number) >= 0 &&
        (value[k] as number) <= 1,
    ) &&
    (value.L as number) <= (value.U as number) &&
    typeof value.lugar.lat === "number" &&
    Math.abs(value.lugar.lat) <= 90 &&
    typeof value.lugar.lon === "number" &&
    Math.abs(value.lugar.lon) <= 180 &&
    typeof value.lugar.nombre === "string" &&
    typeof value.lugar.region === "string" &&
    Object.values(value.dimensiones).every((v) => typeof v === "string") &&
    Array.isArray(value.horario) &&
    value.horario.every(
      (h) =>
        record(h) &&
        ["fecha", "desde", "hasta"].every((k) => typeof h[k] === "string"),
    ) &&
    Array.isArray(value.no_transfiere) &&
    value.no_transfiere.every((v) => typeof v === "string")
  );
}
export async function readJson<T>(
  url: string,
  validate: (value: unknown) => value is T,
): Promise<T> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error("unavailable");
  const value: unknown = await response.json();
  if (!validate(value)) throw new Error("invalid");
  return value;
}
