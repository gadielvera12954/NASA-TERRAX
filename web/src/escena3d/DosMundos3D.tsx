import { CameraActions, CameraControls, turnCamera } from "./CameraControls";
/**
 * Two worlds, one stage, under the same Sun angle: one world on the left of the curtain, one on the right.
 * Pairs: Moon | Earth (default), Mars | Earth, Moon | Mars.
 *
 * Two modes share the camera, the Sun and the curtain:
 * - "plano" (close-up, metres, Moon | Earth only): the same rover and the same calibration board on
 *   flat ground. Physics here: shadow length h / tan(e), panel power F4, fall time √(2h/g).
 * - "real" (relief, kilometres): real Mons Mouton (NASA LOLA, 60 m grid), real Payunia around
 *   candidate P-27 (Copernicus GLO-30 → UTM 19S at 60 m) and real Jezero crater on Mars around the
 *   Perseverance landing site (USGS HRSC + MOLA, 200 m native), 30 × 30 km each, built in Blender by
 *   modelos/construir_modelos.py. The same local Sun elevation and azimuth light both (geometric
 *   mode); the shadows are the renderer's shadows of the display mesh. No number of the app comes
 *   from these meshes. Each scene adds its sky, the Sun disc at its true apparent size, a 5 km
 *   ruler, a north arrow and the site markers.
 *
 * What is illustration: ground colours, sky colours, haze and the amount of sky light.
 */
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/Language";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  cargarModelo,
  direccionSol,
  hayWebgl,
  leerTerrenos,
  liberar,
  panelesDelRover,
  sombras,
  zocalo,
  type TerrenoReal,
} from "./modelos";
import { CONSTANTES, diametroSolDeg, MODELO, NOMBRES, PARES, type Mundo as Cuerpo, type Par } from "./mundos";

export type ModoTerreno = "plano" | "real";
export type EstadoTerreno = "cargando" | "listo" | "sin-datos";

export interface PropsMundos {
  elevacion: number;
  azimut: number;
  /** Rover heading, degrees clockwise from north. */
  rumbo: number;
  /** 0–100: share of the view that shows the left world. */
  corte: number;
  /** Power of each panel (W) keyed by its side angle; lights the cells on the Moon side. */
  potencia: Record<number, number>;
  panelW: number;
  /** Increments start a drop test. */
  caida: number;
  alturaCaida: number;
  gLuna: number;
  gTierra: number;
  animar: boolean;
  onCaida?: (t: { luna: number | null; tierra: number | null }) => void;
  etiqueta: string;
  textoAcercar: string;
  textoAlejar: string;
  /** "plano": close-up stage in metres (default, Moon | Earth only). "real": real relief, 30 × 30 km per world. */
  terreno?: ModoTerreno;
  /** Which two worlds, left | right. Changing it needs a new component (use it in the `key`). */
  par?: Par;
  /** Height of the calibration board, metres. Default 0.50 m, the field-kit board. */
  alturaObjetoM?: number;
  /** Vertical exaggeration of the real relief. Display only, always labelled. Default 1. */
  exageracion?: number;
  onTerrenoEstado?: (estado: EstadoTerreno) => void;
  /** Embedded in a host that draws its own labels and controls (team workspace): no buttons, no caption. */
  incrustado?: boolean;
}

/** Height of tablita.glb as modelled (campo.tablita_alto_m). */
const TABLITA_MODELO_M = 0.5;
const ALTURA_MIN_M = 0.01;
const ALTURA_MAX_M = 50;

/** Camera, light and shadow box of each mode. "plano" is in metres, "real" in kilometres. */
const VISTAS = {
  plano: { objetivo: 1.25, distancia: 12.5, alto: 3.3, min: 4, max: 60, luz: 160, caja: 55, lejos: 400, bias: -0.0004, normal: 0.03 },
  real: { objetivo: 0, distancia: 41, alto: 22, min: 9, max: 90, luz: 90, caja: 23, lejos: 200, bias: -0.00025, normal: 0.05 },
} as const;

/**
 * Look of each world. Light intensities keep the ratio of sunlight above the air (Mars gets
 * 586/1361 of the Moon's); colours, haze and sky light are illustration.
 */
const ESTILO: Record<Cuerpo, {
  suelo: number;
  zocalo: number;
  luz: number;
  intensidad: number;
  radioSombra: number;
  hemi: [number, number, number] | null;
  ambiente: number;
  niebla: boolean;
}> = {
  luna: { suelo: 0xcfcfcc, zocalo: 0x3a3a3a, luz: 0xffffff, intensidad: 17, radioSombra: 1, hemi: null, ambiente: 0.035, niebla: false },
  tierra: { suelo: 0x9a7b5c, zocalo: 0x4a3828, luz: 0xffe6c4, intensidad: 8, radioSombra: 5, hemi: [0x9fc0f0, 0x8f7a64, 1.5], ambiente: 0, niebla: true },
  marte: {
    suelo: 0xb5774f, zocalo: 0x5a3020, luz: 0xfff1e0, intensidad: (17 * CONSTANTES.marte.irradianciaWm2) / CONSTANTES.luna.irradianciaWm2,
    radioSombra: 3, hemi: [0xc9a27e, 0x6b3a22, 0.55], ambiente: 0, niebla: true,
  },
};

interface Mundo {
  tipo: Cuerpo;
  escena: THREE.Scene;
  luz: THREE.DirectionalLight;
  plano: THREE.Group;
  real: THREE.Group;
  /** Sky dome, Sun disc: in the scene (not scaled by the exaggeration), visible with the relief. */
  cielo: THREE.Group;
  domo: THREE.Mesh | null;
  disco: THREE.Mesh;
  halo: THREE.Sprite;
  /** Labels inside `real`: their height is divided by the exaggeration so they keep their shape. */
  rotulos: { sprite: THREE.Sprite; ancho: number; alto: number }[];
  rover: THREE.Group | null;
  tablita: THREE.Group | null;
  celdas: Map<number, THREE.MeshStandardMaterial[]>;
  bola: THREE.Mesh;
  cinta: THREE.Group;
  g: number;
}
interface Motor extends CameraActions {
  actualizar: (p: PropsMundos) => void;
  destruir: () => void;
}

function acercarCamara(camara: THREE.PerspectiveCamera, controles: OrbitControls, factor: number) {
  const v = camara.position.clone().sub(controles.target);
  const largo = Math.min(controles.maxDistance, Math.max(controles.minDistance, v.length() * factor));
  camara.position.copy(controles.target).add(v.setLength(largo));
  controles.update();
}

export function alturaValida(h: number | undefined): number {
  if (h === undefined || !Number.isFinite(h)) return TABLITA_MODELO_M;
  return Math.min(ALTURA_MAX_M, Math.max(ALTURA_MIN_M, h));
}

const TABLITA: [number, number, number] = [-1.9, 0, 2.0];
const BOLA: [number, number] = [-0.6, -2.6];

/** A text label drawn on a canvas, as a sprite `alto` units tall. */
function rotulo(texto: string, alto: number, fuerte = false): { sprite: THREE.Sprite; ancho: number; alto: number } {
  const lienzo = document.createElement("canvas");
  const ctx = lienzo.getContext("2d")!;
  const px = 44;
  const fuente = `${fuerte ? 650 : 500} ${px}px ${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
  ctx.font = fuente;
  const w = Math.ceil(ctx.measureText(texto).width) + 28;
  lienzo.width = w;
  lienzo.height = px + 22;
  ctx.font = fuente;
  ctx.fillStyle = "rgba(15, 29, 36, 0.86)";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = fuerte ? "#f2b33d" : "#eef2f3";
  ctx.textBaseline = "middle";
  ctx.fillText(texto, 14, lienzo.height / 2 + 2);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false, toneMapped: false }));
  const ancho = (alto * lienzo.width) / lienzo.height;
  sprite.scale.set(ancho, alto, 1);
  sprite.renderOrder = 10;
  return { sprite, ancho, alto };
}

/** Sky dome with a vertical gradient (horizon → zenith). Illustration. */
function domoCielo(horizonte: THREE.Color, cenit: THREE.Color): THREE.Mesh {
  const geo = new THREE.SphereGeometry(420, 32, 16);
  const pos = geo.getAttribute("position");
  const colores: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / 420 / 0.6));
    c.copy(horizonte).lerp(cenit, Math.sqrt(t));
    colores.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colores, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  return m;
}

function crearMundo(tipo: Cuerpo): Mundo {
  const e = ESTILO[tipo];
  const escena = new THREE.Scene();
  const plano = new THREE.Group();
  const real = new THREE.Group();
  const cielo = new THREE.Group();
  real.visible = false;
  cielo.visible = false;
  escena.add(plano, real, cielo);
  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(220, 96),
    new THREE.MeshStandardMaterial({ color: e.suelo, roughness: 1, metalness: 0 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  plano.add(suelo);
  const luz = new THREE.DirectionalLight(e.luz, e.intensidad);
  luz.castShadow = true;
  // 2048 px over 110 m is 5 cm per texel: enough for a 10 cm board, and four times cheaper than 4096.
  // On the 46 km relief box it is 22 m per texel, finer than the display meshes.
  luz.shadow.mapSize.set(2048, 2048);
  luz.shadow.radius = e.radioSombra;
  escena.add(luz, luz.target);
  escena.background = new THREE.Color(0x000000);
  if (e.ambiente) escena.add(new THREE.AmbientLight(0xffffff, e.ambiente));
  if (e.hemi) escena.add(new THREE.HemisphereLight(e.hemi[0], e.hemi[1], e.hemi[2]));
  // Sun disc at its true apparent size (0.53° from Moon and Earth, 0.35° from Mars) and a faint glow.
  const disco = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0xfffbea, fog: false, toneMapped: false }),
  );
  const brillo = document.createElement("canvas");
  brillo.width = brillo.height = 128;
  const g = brillo.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,250,230,0.85)");
  grad.addColorStop(0.25, "rgba(255,240,200,0.25)");
  grad.addColorStop(1, "rgba(255,240,200,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(brillo), fog: false, depthWrite: false, toneMapped: false, transparent: true }));
  cielo.add(disco, halo);
  const bola = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2b33d, roughness: 0.5 }),
  );
  bola.castShadow = true;
  bola.visible = false;
  plano.add(bola);
  const cinta = new THREE.Group();
  plano.add(cinta);
  return {
    tipo, escena, luz, plano, real, cielo, domo: null, disco, halo, rotulos: [], rover: null, tablita: null,
    celdas: new Map(), bola, cinta, g: CONSTANTES[tipo].gravedad,
  };
}

type Altura = (x: number, z: number) => number;

/**
 * Height of the relief mesh under (x, z), mesh coordinates before exaggeration.
 * The display mesh is a regular grid, so its vertices are binned once and read bilinearly:
 * hundreds of outline points cost nothing (ray casts against 125 000 triangles froze slow machines).
 */
function alturas(malla: THREE.Mesh, pasoKm: number): Altura {
  const pos = malla.geometry.getAttribute("position") as THREE.BufferAttribute;
  malla.geometry.computeBoundingBox();
  const b = malla.geometry.boundingBox!;
  const nx = Math.round((b.max.x - b.min.x) / pasoKm) + 1;
  const nz = Math.round((b.max.z - b.min.z) / pasoKm) + 1;
  const h = new Float32Array(nx * nz);
  for (let i = 0; i < pos.count; i++) {
    const ix = Math.round((pos.getX(i) - b.min.x) / pasoKm);
    const iz = Math.round((pos.getZ(i) - b.min.z) / pasoKm);
    if (ix >= 0 && ix < nx && iz >= 0 && iz < nz) h[iz * nx + ix] = pos.getY(i);
  }
  return (x, z) => {
    const fx = Math.min(nx - 1.001, Math.max(0, (x - b.min.x) / pasoKm));
    const fz = Math.min(nz - 1.001, Math.max(0, (z - b.min.z) / pasoKm));
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const tx = fx - x0;
    const tz = fz - z0;
    const a = h[z0 * nx + x0] * (1 - tx) + h[z0 * nx + x0 + 1] * tx;
    const c = h[(z0 + 1) * nx + x0] * (1 - tx) + h[(z0 + 1) * nx + x0 + 1] * tx;
    return a * (1 - tz) + c * tz;
  };
}

/** Grid row/col of the relief mesh → mesh (x, z) in km. */
function xz(info: TerrenoReal, fila: number, col: number): [number, number] {
  const km = info.pixel_m / 1000;
  return [(col - (info.columnas - 1) / 2) * km, (fila - (info.filas - 1) / 2) * km];
}

/** Outline of a square parcel draped on the relief (mesh coordinates, before exaggeration). */
function contorno(altura: Altura, info: TerrenoReal, fila: number, col: number, ladoKm: number, material: THREE.LineBasicMaterial): THREE.LineLoop {
  const medio = ladoKm / 2 / (info.pixel_m / 1000);
  const pts: number[] = [];
  const esquinas: [number, number][] = [
    [fila - medio, col - medio],
    [fila - medio, col + medio],
    [fila + medio, col + medio],
    [fila + medio, col - medio],
  ];
  for (let k = 0; k < 4; k++) {
    const [f0, c0] = esquinas[k];
    const [f1, c1] = esquinas[(k + 1) % 4];
    for (let s = 0; s < 24; s++) {
      const [x, z] = xz(info, f0 + ((f1 - f0) * s) / 24, c0 + ((c1 - c0) * s) / 24);
      pts.push(x, altura(x, z) + 0.035, z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineLoop(geo, material);
}

function crearMotor(
  lienzo: HTMLCanvasElement,
  caja: HTMLElement,
  inicial: PropsMundos,
  onUnavailable: () => void,
  onEstado: (e: EstadoTerreno) => void,
  t: (en: string, es: string) => string,
): Motor {
  let props = inicial;
  let vivo = true;
  let pendiente = true;
  let cuadro = 0;
  let caidaVista = 0;
  let caidaInicio = 0;
  const par: Par = inicial.par ?? "luna-tierra";
  /** The close-up stage (rover, board, drop test) exists only for Moon | Earth: its readouts are Moon/Earth. */
  const conPlano = par === "luna-tierra";
  /** What the parent asked for, and what is on screen (the close-up when the relief cannot load). */
  let modo: ModoTerreno | null = null;
  let visible: ModoTerreno = "plano";

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setScissorTest(true);

  const camara = new THREE.PerspectiveCamera(40, 1, 0.05, 900);
  const controles = new OrbitControls(camara, lienzo);
  // Embedded hosts have no +/− buttons: the wheel zooms there. Elsewhere the wheel belongs to the page.
  controles.enableZoom = Boolean(inicial.incrustado);
  lienzo.style.touchAction = "pan-y";
  controles.maxPolarAngle = Math.PI * 0.495;
  controles.enablePan = false;
  controles.addEventListener("change", () => (pendiente = true));

  const [izq, der] = PARES[par];
  const mundos: [Mundo, Mundo] = [crearMundo(izq), crearMundo(der)];
  const nieblas = new Map<Mundo, THREE.Fog>();
  for (const m of mundos) {
    if (!ESTILO[m.tipo].niebla) continue;
    const f = new THREE.Fog(0xffffff, 60, 260);
    m.escena.fog = f;
    nieblas.set(m, f);
  }
  let clave = "";
  let caidaDicha = "";
  const matCinta = new THREE.LineBasicMaterial({ color: 0xf2b33d });
  const matParcela = new THREE.LineBasicMaterial({ color: 0xf2b33d });
  const matParcelaSuave = new THREE.LineBasicMaterial({ color: 0xf2b33d, transparent: true, opacity: 0.4 });
  const matRegla = new THREE.LineBasicMaterial({ color: 0xeef2f3 });

  function encuadrar(m: ModoTerreno) {
    const v = VISTAS[m];
    // Start with the Sun behind the viewer's shoulder: the shadows run diagonally across the curtain.
    const haciaSol = direccionSol(props.azimut, 0);
    const giro = (-42 * Math.PI) / 180;
    camara.position.set(
      (haciaSol.x * Math.cos(giro) + haciaSol.z * Math.sin(giro)) * v.distancia,
      v.alto,
      (-haciaSol.x * Math.sin(giro) + haciaSol.z * Math.cos(giro)) * v.distancia,
    );
    controles.minDistance = 0;
    controles.maxDistance = Infinity;
    controles.target.set(0, v.objetivo, 0);
    controles.update();
    controles.saveState();
    controles.minDistance = v.min;
    controles.maxDistance = v.max;
    for (const w of mundos) {
      const c = w.luz.shadow.camera;
      c.left = c.bottom = -v.caja;
      c.right = c.top = v.caja;
      c.near = 1;
      c.far = v.lejos;
      c.updateProjectionMatrix();
      w.luz.shadow.bias = v.bias;
      w.luz.shadow.normalBias = v.normal;
      w.cielo.visible = m === "real";
    }
    // Haze, illustrative: metres in the close-up, kilometres on the relief.
    for (const f of nieblas.values()) {
      f.near = m === "real" ? 45 : 60;
      f.far = m === "real" ? 150 : 260;
    }
  }

  function ponerCinta(m: Mundo, largo: number, haciaSombra: THREE.Vector3) {
    for (const h of m.cinta.children) (h as THREE.LineSegments).geometry.dispose();
    m.cinta.clear();
    const L = Math.min(largo, 200);
    const lateral = new THREE.Vector3(-haciaSombra.z, 0, haciaSombra.x);
    const pts: number[] = [];
    const origen = new THREE.Vector3(TABLITA[0], 0.02, TABLITA[2]);
    const fin = origen.clone().addScaledVector(haciaSombra, L);
    pts.push(origen.x, origen.y, origen.z, fin.x, fin.y, fin.z);
    for (let d = 1; d <= Math.floor(L); d++) {
      const p = origen.clone().addScaledVector(haciaSombra, d);
      const medio = d % 5 === 0 ? 0.22 : 0.1;
      pts.push(p.x - lateral.x * medio, p.y, p.z - lateral.z * medio, p.x + lateral.x * medio, p.y, p.z + lateral.z * medio);
    }
    pts.push(fin.x - lateral.x * 0.3, fin.y, fin.z - lateral.z * 0.3, fin.x + lateral.x * 0.3, fin.y, fin.z + lateral.z * 0.3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    m.cinta.add(new THREE.LineSegments(geo, matCinta));
  }

  /** Sky colours by world and Sun elevation. Purely illustrative. */
  function pintarCielo(m: Mundo) {
    const k = Math.min(1, Math.max(0, (props.elevacion - 1.5) / 8.5));
    if (m.tipo === "luna") {
      m.escena.background = new THREE.Color(0x000000);
      return;
    }
    const horizonte = new THREE.Color();
    const cenit = new THREE.Color();
    if (m.tipo === "tierra") {
      horizonte.setRGB(0.86 - 0.36 * k, 0.62 + 0.08 * k, 0.46 + 0.4 * k, THREE.SRGBColorSpace);
      cenit.setRGB(0.18 + 0.12 * k, 0.32 + 0.16 * k, 0.62 + 0.18 * k, THREE.SRGBColorSpace);
    } else {
      // Mars: butterscotch dust sky, darker and greyer with a low Sun.
      horizonte.setRGB(0.62 + 0.14 * k, 0.46 + 0.1 * k, 0.34 + 0.06 * k, THREE.SRGBColorSpace);
      cenit.setRGB(0.36 + 0.12 * k, 0.27 + 0.08 * k, 0.22 + 0.05 * k, THREE.SRGBColorSpace);
    }
    m.escena.background = visible === "real" ? cenit.clone() : horizonte.clone();
    nieblas.get(m)?.color.copy(horizonte);
    if (m.domo) {
      m.cielo.remove(m.domo);
      m.domo.geometry.dispose();
      (m.domo.material as THREE.Material).dispose();
    }
    m.domo = domoCielo(horizonte, cenit);
    m.cielo.add(m.domo);
  }

  function aplicar() {
    const dir = direccionSol(props.azimut, props.elevacion);
    const haciaSombra = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
    const h = alturaValida(props.alturaObjetoM);
    const largo = h / Math.tan((props.elevacion * Math.PI) / 180);
    const v = VISTAS[visible];
    const exag = Math.min(10, Math.max(1, props.exageracion ?? 1));
    mundos.forEach((m, i) => {
      m.luz.position.copy(dir).multiplyScalar(v.luz);
      m.luz.target.position.set(0, 0, 0);
      m.g = m.tipo === "luna" ? props.gLuna : m.tipo === "tierra" ? props.gTierra : CONSTANTES.marte.gravedad;
      if (m.rover) m.rover.rotation.y = -(props.rumbo * Math.PI) / 180;
      if (m.tablita) m.tablita.scale.set(1, h / TABLITA_MODELO_M, 1);
      ponerCinta(m, largo, haciaSombra);
      m.real.scale.set(1, exag, 1);
      for (const r of m.rotulos) r.sprite.scale.set(r.ancho, r.alto / exag, 1);
      for (const [lado, mats] of m.celdas) {
        // Cells glow in proportion to their F4 power on the Moon; elsewhere they stay unlit (not modelled).
        const w = m.tipo === "luna" && i === 0 ? (props.potencia[lado] ?? 0) / props.panelW : 0;
        for (const mat of mats) {
          mat.emissive.set(0x2491ff);
          mat.emissiveIntensity = 2.2 * Math.max(0, Math.min(1, w));
        }
      }
      // Sun disc 300 km away at its true angular size for this world.
      const dist = 300;
      const r = dist * Math.tan(((diametroSolDeg(m.tipo) / 2) * Math.PI) / 180);
      m.disco.position.copy(dir).multiplyScalar(dist);
      m.disco.scale.setScalar(r);
      m.disco.lookAt(0, 0, 0);
      m.halo.position.copy(m.disco.position);
      m.halo.scale.setScalar(r * (m.tipo === "luna" ? 9 : 16));
      m.disco.visible = m.halo.visible = props.elevacion > -0.3;
      pintarCielo(m);
    });
    pendiente = true;
  }

  function avisarReal(e: EstadoTerreno) {
    onEstado(e);
    props.onTerrenoEstado?.(e);
  }

  /** Markers, labels, ruler and north arrow of one relief. Inside `real`, so they follow the exaggeration. */
  function adornar(m: Mundo, malla: THREE.Mesh, info: TerrenoReal) {
    const altura = alturas(malla, info.pixel_malla_m / 1000);
    const etiqueta = (texto: string, x: number, z: number, alto: number, fuerte: boolean) => {
      const y = altura(x, z);
      const pin = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + 2.2, z)]),
        fuerte ? matParcela : matRegla,
      );
      const r = rotulo(texto, alto, fuerte);
      // Anchor the label away from the curtain: leftwards on the left world, rightwards on the right one.
      r.sprite.center.set(mundos[0] === m ? 1 : 0, 0);
      r.sprite.position.set(x, y + 2.2, z);
      m.real.add(pin, r.sprite);
      m.rotulos.push(r);
    };
    if (m.tipo === "tierra" && info.candidata) {
      const c = info.candidata;
      m.real.add(contorno(altura, info, c.fila, c.col, c.parcela_km, matParcela));
      for (const p of info.parcelas ?? []) {
        if (p.id === c.id) continue;
        m.real.add(contorno(altura, info, p.fila, p.col, c.parcela_km, matParcelaSuave));
      }
      const [x, z] = xz(info, c.fila, c.col);
      etiqueta(t(`${c.id} · best candidate`, `${c.id} · mejor candidata`), x, z, 1.1, true);
    } else if (m.tipo === "marte") {
      etiqueta(t("Perseverance landing site", "Sitio de aterrizaje de Perseverance"), 0, 0, 1.1, true);
    } else {
      etiqueta(t("Mons Mouton · centre of the 30 km crop", "Mons Mouton · centro del recorte de 30 km"), 0, 0, 1.1, true);
    }
    // 5 km ruler on the base, along the south edge, and a north arrow at the north-west corner.
    malla.geometry.computeBoundingBox();
    const b = malla.geometry.boundingBox!;
    const base = b.min.y - 0.6;
    const z0 = b.max.z + 0.25;
    const pts: number[] = [b.min.x, base, z0, b.min.x + 5, base, z0];
    for (let k = 0; k <= 5; k++) pts.push(b.min.x + k, base, z0, b.min.x + k, base, z0 + (k % 5 === 0 ? 0.5 : 0.25));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    m.real.add(new THREE.LineSegments(geo, matRegla));
    const r5 = rotulo("5 km", 0.8);
    r5.sprite.position.set(b.min.x + 2.5, base - 0.6, z0 + 0.9);
    m.real.add(r5.sprite);
    m.rotulos.push(r5);
    const flecha = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(b.min.x - 0.8, base, b.min.z + 3), 3, 0xeef2f3, 0.8, 0.45);
    m.real.add(flecha);
    const rn = rotulo(t("N (grid)", "N (grilla)"), 0.7);
    rn.sprite.position.set(b.min.x - 0.8, base + 0.8, b.min.z - 0.4);
    m.real.add(rn.sprite);
    m.rotulos.push(rn);
  }

  let cargaReal: Promise<void> | null = null;
  function cargarReal(): Promise<void> {
    if (cargaReal) return cargaReal;
    avisarReal("cargando");
    cargaReal = leerTerrenos()
      .then((info) =>
        Promise.all(
          mundos.map(async (m) => {
            const nombre = MODELO[m.tipo];
            const ti = info[nombre];
            if (!ti) throw new Error(`missing ${nombre}`);
            const g = await cargarModelo(nombre);
            if (!vivo) return;
            const normales = new THREE.TextureLoader().load(`/modelos/${ti.normales}`, () => (pendiente = true));
            normales.flipY = false;
            normales.colorSpace = THREE.NoColorSpace;
            const material = new THREE.MeshStandardMaterial({
              color: ESTILO[m.tipo].suelo,
              normalMap: normales,
              normalMapType: THREE.ObjectSpaceNormalMap,
              roughness: 1,
              metalness: 0,
            });
            const mallas: THREE.Mesh[] = [];
            g.traverse((o) => {
              const me = o as THREE.Mesh;
              if (me.isMesh) {
                me.material = material;
                mallas.push(me);
              }
            });
            sombras(g, true, true);
            m.real.add(g);
            m.real.scale.set(1, 1, 1);
            m.real.updateMatrixWorld(true);
            if (mallas[0]) {
              // Tabletop model look: walls down to a flat base 0.6 km under the lowest point.
              const mat = new THREE.MeshStandardMaterial({ color: ESTILO[m.tipo].zocalo, roughness: 1, side: THREE.DoubleSide });
              const pared = zocalo(mallas[0], 0.6, mat);
              if (pared) mallas[0].add(pared);
              adornar(m, mallas[0], ti);
            }
          }),
        ),
      )
      .then(() => {
        if (!vivo) return;
        avisarReal("listo");
        aplicar();
      })
      .catch(() => {
        // Stay in "real" as asked, but show the close-up when there is one. Choosing the relief again retries.
        cargaReal = null;
        if (!vivo) return;
        for (const w of mundos) {
          w.real.clear();
          w.rotulos = [];
        }
        mostrar("plano");
        avisarReal("sin-datos");
      });
    return cargaReal;
  }

  function mostrar(m: ModoTerreno) {
    visible = m;
    for (const w of mundos) {
      w.plano.visible = m === "plano";
      w.real.visible = m === "real";
    }
    encuadrar(m);
    aplicar();
  }

  function ponerModo(pedido: ModoTerreno) {
    const m: ModoTerreno = conPlano ? pedido : "real";
    if (m === modo) return;
    modo = m;
    mostrar(m);
    if (m === "real") void cargarReal();
  }

  function iniciarCaida() {
    if (!conPlano) return;
    caidaInicio = performance.now();
    for (const m of mundos) {
      m.bola.visible = true;
      m.bola.position.set(BOLA[0], props.alturaCaida, BOLA[1]);
    }
    const tiempo = (g: number) => Math.sqrt((2 * props.alturaCaida) / g);
    if (!props.animar) {
      for (const m of mundos) m.bola.position.y = 0.11;
      props.onCaida?.({ luna: tiempo(props.gLuna), tierra: tiempo(props.gTierra) });
      caidaInicio = 0;
    } else {
      caidaDicha = "null|null";
      props.onCaida?.({ luna: null, tierra: null });
    }
    pendiente = true;
  }

  function avanzarCaida(ahora: number) {
    const seg = (ahora - caidaInicio) / 1000;
    const fin: (number | null)[] = [null, null];
    mundos.forEach((m, i) => {
      const total = Math.sqrt((2 * props.alturaCaida) / m.g);
      const y = props.alturaCaida - 0.5 * m.g * seg * seg;
      m.bola.position.y = Math.max(0.11, y);
      if (seg >= total) fin[i] = total;
    });
    const dicho = `${fin[0]}|${fin[1]}`;
    if (dicho !== caidaDicha) {
      caidaDicha = dicho;
      props.onCaida?.({ luna: fin[0], tierra: fin[1] });
    }
    if (fin[0] !== null && fin[1] !== null) caidaInicio = 0;
    pendiente = true;
  }

  if (conPlano) {
    for (const [i, m] of mundos.entries()) {
      cargarModelo("rover")
        .then((g) => {
          if (!vivo) return;
          sombras(g, true, true);
          m.rover = g;
          m.celdas = panelesDelRover(g);
          m.plano.add(g);
          aplicar();
        })
        .catch(() => { if (vivo) onUnavailable(); });
      cargarModelo("tablita")
        .then((g) => {
          if (!vivo) return;
          sombras(g, true, true);
          g.position.set(...TABLITA);
          g.userData.mundo = i;
          m.tablita = g;
          m.plano.add(g);
          aplicar();
        })
        .catch(() => { if (vivo) onUnavailable(); });
    }
  }

  const medir = () => {
    const w = Math.max(1, caja.clientWidth);
    const h = Math.max(1, caja.clientHeight);
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    pendiente = true;
  };
  const observador = new ResizeObserver(medir);
  observador.observe(caja);
  medir();

  const tam = new THREE.Vector2();
  const ciclo = (ahora: number) => {
    if (!vivo) return;
    cuadro = requestAnimationFrame(ciclo);
    if (caidaInicio) avanzarCaida(ahora);
    if (!pendiente) return;
    pendiente = false;
    renderer.getSize(tam);
    const x = Math.round((tam.x * props.corte) / 100);
    renderer.setViewport(0, 0, tam.x, tam.y);
    renderer.setScissor(0, 0, x, tam.y);
    renderer.render(mundos[0].escena, camara);
    renderer.setScissor(x, 0, tam.x - x, tam.y);
    renderer.render(mundos[1].escena, camara);
  };
  ponerModo(inicial.terreno ?? "plano");
  cuadro = requestAnimationFrame(ciclo);

  return {
    restablecer() { controles.reset(); pendiente = true; },
    girar(direction) { turnCamera(camara, controles, direction); pendiente = true; },
    acercar(factor) {
      acercarCamara(camara, controles, factor);
      pendiente = true;
    },
    actualizar(p) {
      props = p;
      ponerModo(p.terreno ?? "plano");
      const nueva = [
        p.elevacion, p.azimut, p.rumbo, p.gLuna, p.gTierra, p.panelW, JSON.stringify(p.potencia),
        alturaValida(p.alturaObjetoM), p.exageracion ?? 1,
      ].join("|");
      if (nueva !== clave) {
        clave = nueva;
        aplicar();
      }
      pendiente = true;
      if (p.caida !== caidaVista) {
        caidaVista = p.caida;
        iniciarCaida();
      }
    },
    destruir() {
      vivo = false;
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      controles.dispose();
      for (const m of mundos) {
        m.luz.shadow.map?.dispose();
        liberar(m.escena);
      }
      matCinta.dispose();
      matParcela.dispose();
      matParcelaSuave.dispose();
      matRegla.dispose();
      renderer.dispose();
    },
  };
}

export default function DosMundos3D(props: PropsMundos) {
  const { t, language } = useLanguage();
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const ultimas = useRef(props);
  ultimas.current = props;
  const [sinWebgl, setSinWebgl] = useState(() => !hayWebgl());
  const [estadoReal, setEstadoReal] = useState<EstadoTerreno | null>(null);
  const traducir = useRef(t);
  traducir.current = t;

  useEffect(() => {
    if (sinWebgl || !lienzo.current || !caja.current) return;
    try {
      motor.current = crearMotor(lienzo.current, caja.current, ultimas.current, () => setSinWebgl(true), setEstadoReal,
        (en, es) => traducir.current(en, es));
    } catch {
      setSinWebgl(true);
      return;
    }
    return () => {
      motor.current?.destruir();
      motor.current = null;
    };
  }, [sinWebgl]);

  useEffect(() => {
    motor.current?.actualizar(props);
  });

  const [izq, der] = PARES[props.par ?? "luna-tierra"];
  if (sinWebgl)
    return (
      <>
        <img src="/img/ui_tierra_top.png" alt="" />
        <img
          className="capa-luna-plana"
          style={{ clipPath: `inset(0 ${100 - props.corte}% 0 0)` }}
          src="/img/ui_luna_top.png"
          alt={t("Static illustration of the two environments", "Ilustración estática de los dos entornos")}
        />
        <span className="static-caption">{t("Static illustrations · 3D unavailable", "Ilustraciones estáticas · 3D no disponible")}</span>
      </>
    );
  const exag = Math.min(10, Math.max(1, props.exageracion ?? 1));
  const exagTexto = exag.toLocaleString(language, { maximumFractionDigits: 1 });
  const real = props.terreno === "real" || (props.par ?? "luna-tierra") !== "luna-tierra";
  const nombre = (m: Cuerpo) => `${t(NOMBRES[m].en, NOMBRES[m].es)}: ${t(NOMBRES[m].sitioEn, NOMBRES[m].sitioEs)} (${NOMBRES[m].dem})`;
  return (
    <div
      className="escena escena-mundos"
      ref={caja}
      style={props.incrustado ? { position: "absolute", inset: 0, height: "100%", overflow: "hidden" } : undefined}
    >
      <canvas
        ref={lienzo}
        role="img"
        aria-label={props.etiqueta}
        style={props.incrustado ? { display: "block", width: "100%", height: "100%", cursor: "grab" } : undefined}
      />
      {real && estadoReal === "listo" && !props.incrustado && (
        <span className="static-caption" style={{ right: 10, bottom: 64 }}>
          {t(
            `Real relief, 30 × 30 km each · ${nombre(izq)} | ${nombre(der)} · same Sun angle · vertical ×${exagTexto}`,
            `Relieve real, 30 × 30 km cada uno · ${nombre(izq)} | ${nombre(der)} · mismo ángulo de Sol · vertical ×${exagTexto}`,
          )}
        </span>
      )}
      {!props.incrustado && <CameraControls camera={motor} zoomIn={props.textoAcercar} zoomOut={props.textoAlejar} />}
    </div>
  );
}
