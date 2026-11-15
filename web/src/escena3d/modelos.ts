/** Loads the Blender-built models (modelos/construir_modelos.py) once and hands out clones. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const cache = new Map<string, Promise<THREE.Group>>();

export type NombreModelo = "rover" | "tablita" | "mons_mouton" | "payunia" | "marte_jezero";

/** One real relief mesh, as registered by modelos/construir_modelos.py under `terrenos`. */
export interface TerrenoReal {
  archivo: string;
  sha256: string;
  normales: string;
  grilla: string;
  cuerpo: "luna" | "tierra" | "marte";
  pixel_m: number;
  pixel_malla_m: number;
  filas: number;
  columnas: number;
  z_min_m: number;
  z_max_m: number;
  fuentes: { id: string; sha256: string | null; url?: string }[];
  candidata?: { id: string; nombre: string; fila: number; col: number; parcela_km: number };
  /** Every ranked parcel whose 3 × 3 km square fits inside this crop (grid row/col of its centre). */
  parcelas?: { id: string; fila: number; col: number; etiqueta?: string | null; orden?: number | null }[];
  /** Named site at the centre of the crop (Mars: Perseverance landing site). */
  sitio?: { id: string; nombre: string; lat_deg: number; lon_deg: number; fuente: string };
}

/**
 * Side walls of a relief mesh down to a flat base, like a tabletop terrain model.
 * Built from the mesh's own border vertices, so it follows the real edge profile. Display only.
 */
export function zocalo(malla: THREE.Mesh, profundidad: number, material: THREE.Material): THREE.Mesh | null {
  const pos = malla.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return null;
  malla.geometry.computeBoundingBox();
  const caja = malla.geometry.boundingBox!;
  const eps = 1e-3 * Math.max(caja.max.x - caja.min.x, caja.max.z - caja.min.z);
  const fondo = caja.min.y - profundidad;
  const bordes: { fijo: "x" | "z"; valor: number }[] = [
    { fijo: "x", valor: caja.min.x },
    { fijo: "x", valor: caja.max.x },
    { fijo: "z", valor: caja.min.z },
    { fijo: "z", valor: caja.max.z },
  ];
  const v: number[] = [];
  const porBorde: THREE.Vector3[][] = bordes.map(() => []);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    bordes.forEach((b, k) => {
      if (Math.abs((b.fijo === "x" ? x : z) - b.valor) < eps) porBorde[k].push(new THREE.Vector3(x, pos.getY(i), z));
    });
  }
  for (const [k, b] of bordes.entries()) {
    const pts = porBorde[k];
    pts.sort((a, c) => (b.fijo === "x" ? a.z - c.z : a.x - c.x));
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k];
      const c = pts[k + 1];
      v.push(a.x, a.y, a.z, c.x, c.y, c.z, c.x, fondo, c.z);
      v.push(a.x, a.y, a.z, c.x, fondo, c.z, a.x, fondo, a.z);
    }
  }
  if (!v.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.name = "zocalo";
  return m;
}

let terrenos: Promise<Record<string, TerrenoReal>> | null = null;
/** `terrenos` of modelos.json (Moon and Earth relief built from the 60 m grids). */
export function leerTerrenos(): Promise<Record<string, TerrenoReal>> {
  if (!terrenos) {
    terrenos = fetch("/modelos/modelos.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("unavailable");
        return r.json() as Promise<{ terrenos?: Record<string, TerrenoReal> }>;
      })
      .then((m) => {
        if (!m.terrenos) throw new Error("unavailable");
        return m.terrenos;
      });
    terrenos.catch(() => (terrenos = null));
  }
  return terrenos;
}

export function cargarModelo(nombre: NombreModelo): Promise<THREE.Group> {
  let p = cache.get(nombre);
  if (!p) {
    p = new GLTFLoader().loadAsync(`/modelos/${nombre}.glb`).then((g) => g.scene);
    p.catch(() => cache.delete(nombre));
    cache.set(nombre, p);
  }
  return p.then((escena) => {
    const copia = escena.clone(true);
    // Materials are shared between clones: copy them so one view can light a panel without touching another.
    copia.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) m.material = (m.material as THREE.Material).clone();
    });
    return copia;
  });
}

/** The three solar panels by the side angle they were modelled with (0°, 90°, 180°). */
export function panelesDelRover(rover: THREE.Object3D): Map<number, THREE.MeshStandardMaterial[]> {
  const out = new Map<number, THREE.MeshStandardMaterial[]>();
  rover.traverse((o) => {
    const m = /^panel_(\d+)$/.exec(o.name);
    if (!m) return;
    const celdas: THREE.MeshStandardMaterial[] = [];
    o.traverse((h) => {
      const mat = (h as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat && mat.name.startsWith("panel_celda")) celdas.push(mat);
    });
    out.set(Number(m[1]), celdas);
  });
  return out;
}

export function sombras(obj: THREE.Object3D, proyecta: boolean, recibe: boolean) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = proyecta;
      m.receiveShadow = recibe;
    }
  });
}

export function liberar(escena: THREE.Object3D) {
  escena.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

export function hayWebgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Unit vector towards the Sun in three.js axes (X east, Y up, −Z grid north). */
export function direccionSol(azGrillaDeg: number, elDeg: number): THREE.Vector3 {
  const a = (azGrillaDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a));
}
