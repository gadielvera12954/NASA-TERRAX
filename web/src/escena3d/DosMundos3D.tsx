import { CameraActions, CameraControls, turnCamera } from "./CameraControls";
/**
 * Two worlds, one stage, under the same Sun angle: the Moon on the left of the curtain and Earth on the right.
 *
 * Two modes share the camera, the Sun and the curtain:
 * - "plano" (close-up, metres): the same rover and the same calibration board on flat ground.
 *   Physics here: shadow length h / tan(e), panel power F4, fall time √(2h/g).
 * - "real" (relief, kilometres): real Mons Mouton (LOLA, 60 m grid) against real Payunia around
 *   candidate P-27 (Copernicus GLO-30 → UTM 19S at 60 m), 30 × 30 km each, built in Blender by
 *   modelos/construir_modelos.py. The same local Sun elevation and azimuth light both (geometric
 *   mode); the shadows are the renderer's shadows of the 120 m display mesh. No number of the app
 *   comes from these meshes: the engine works on the 60 m grids.
 *
 * What is illustration: ground colours, sky colour, the Earth haze and the amount of sky light.
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
  type TerrenoReal,
} from "./modelos";

export type ModoTerreno = "plano" | "real";
export type EstadoTerreno = "cargando" | "listo" | "sin-datos";

export interface PropsMundos {
  elevacion: number;
  azimut: number;
  /** Rover heading, degrees clockwise from north. */
  rumbo: number;
  /** 0–100: share of the view that shows the Moon. */
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
  /** "plano": close-up stage in metres (default). "real": real relief, 30 × 30 km per world. */
  terreno?: ModoTerreno;
  /** Height of the calibration board, metres. Default 0.50 m, the field-kit board. */
  alturaObjetoM?: number;
  /** Vertical exaggeration of the real relief. Display only, always labelled. Default 1. */
  exageracion?: number;
  onTerrenoEstado?: (estado: EstadoTerreno) => void;
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

interface Mundo {
  escena: THREE.Scene;
  luz: THREE.DirectionalLight;
  plano: THREE.Group;
  real: THREE.Group;
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

function crearMundo(esLuna: boolean): Mundo {
  const escena = new THREE.Scene();
  const plano = new THREE.Group();
  const real = new THREE.Group();
  real.visible = false;
  escena.add(plano, real);
  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(220, 96),
    new THREE.MeshStandardMaterial({ color: esLuna ? 0xcfcfcc : 0x9a7b5c, roughness: 1, metalness: 0 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  plano.add(suelo);
  const luz = new THREE.DirectionalLight(esLuna ? 0xffffff : 0xffe6c4, esLuna ? 17 : 8);
  luz.castShadow = true;
  // 2048 px over 110 m is 5 cm per texel: enough for a 10 cm board, and four times cheaper than 4096.
  // On the 46 km relief box it is 22 m per texel, finer than the 120 m display mesh.
  luz.shadow.mapSize.set(2048, 2048);
  luz.shadow.radius = esLuna ? 1 : 5;
  escena.add(luz, luz.target);
  if (esLuna) {
    escena.background = new THREE.Color(0x000000);
    escena.add(new THREE.AmbientLight(0xffffff, 0.035));
  } else {
    escena.add(new THREE.HemisphereLight(0x9fc0f0, 0x8f7a64, 1.5));
  }
  const bola = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2b33d, roughness: 0.5 }),
  );
  bola.castShadow = true;
  bola.visible = false;
  plano.add(bola);
  const cinta = new THREE.Group();
  plano.add(cinta);
  return { escena, luz, plano, real, rover: null, tablita: null, celdas: new Map(), bola, cinta, g: esLuna ? 1.62 : 9.8 };
}

/** Outline of the 3 × 3 km candidate parcel draped on the relief (mesh coordinates, before exaggeration). */
function contornoParcela(malla: THREE.Mesh, info: TerrenoReal, material: THREE.LineBasicMaterial): THREE.LineLoop | null {
  const c = info.candidata;
  if (!c) return null;
  const km = info.pixel_m / 1000;
  const medio = (c.parcela_km / 2) / km;
  const cx = (info.columnas - 1) / 2;
  const cy = (info.filas - 1) / 2;
  const rayo = new THREE.Raycaster();
  const abajo = new THREE.Vector3(0, -1, 0);
  const pts: number[] = [];
  const esquinas: [number, number][] = [
    [c.fila - medio, c.col - medio],
    [c.fila - medio, c.col + medio],
    [c.fila + medio, c.col + medio],
    [c.fila + medio, c.col - medio],
  ];
  for (let k = 0; k < 4; k++) {
    const [f0, c0] = esquinas[k];
    const [f1, c1] = esquinas[(k + 1) % 4];
    for (let s = 0; s < 24; s++) {
      const f = f0 + ((f1 - f0) * s) / 24;
      const col = c0 + ((c1 - c0) * s) / 24;
      const x = (col - cx) * km;
      const z = (f - cy) * km;
      rayo.set(new THREE.Vector3(x, 50, z), abajo);
      const hit = rayo.intersectObject(malla, false)[0];
      pts.push(x, (hit ? hit.point.y : 0) + 0.035, z);
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
): Motor {
  let props = inicial;
  let vivo = true;
  let pendiente = true;
  let cuadro = 0;
  let caidaVista = 0;
  let caidaInicio = 0;
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
  controles.enableZoom = false;
  lienzo.style.touchAction = "pan-y";
  controles.maxPolarAngle = Math.PI * 0.495;
  controles.enablePan = false;
  controles.addEventListener("change", () => (pendiente = true));

  const mundos: [Mundo, Mundo] = [crearMundo(true), crearMundo(false)];
  const cielo = new THREE.Color();
  const niebla = new THREE.Fog(0xffffff, 60, 260);
  mundos[1].escena.fog = niebla;
  let clave = "";
  let caidaDicha = "";
  const matCinta = new THREE.LineBasicMaterial({ color: 0xf2b33d });
  const matParcela = new THREE.LineBasicMaterial({ color: 0xf2b33d });

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
    }
    // Earth haze, illustrative: metres in the close-up, kilometres on the relief.
    niebla.near = m === "real" ? 45 : 60;
    niebla.far = m === "real" ? 150 : 260;
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
      m.g = i === 0 ? props.gLuna : props.gTierra;
      if (m.rover) m.rover.rotation.y = -(props.rumbo * Math.PI) / 180;
      if (m.tablita) m.tablita.scale.set(1, h / TABLITA_MODELO_M, 1);
      ponerCinta(m, largo, haciaSombra);
      m.real.scale.set(1, exag, 1);
      for (const [lado, mats] of m.celdas) {
        // Cells glow in proportion to their F4 power; the Earth side stays unlit (not modelled).
        const w = i === 0 ? (props.potencia[lado] ?? 0) / props.panelW : 0;
        for (const mat of mats) {
          mat.emissive.set(0x2491ff);
          mat.emissiveIntensity = 2.2 * Math.max(0, Math.min(1, w));
        }
      }
    });
    // Low Sun on Earth: warm horizon. Purely illustrative.
    const t = Math.min(1, Math.max(0, (props.elevacion - 1.5) / 8.5));
    cielo.setRGB(0.86 - 0.36 * t, 0.62 + 0.08 * t, 0.46 + 0.4 * t, THREE.SRGBColorSpace);
    mundos[1].escena.background = cielo;
    niebla.color.copy(cielo);
    pendiente = true;
  }

  function avisarReal(e: EstadoTerreno) {
    onEstado(e);
    props.onTerrenoEstado?.(e);
  }

  let cargaReal: Promise<void> | null = null;
  function cargarReal(): Promise<void> {
    if (cargaReal) return cargaReal;
    avisarReal("cargando");
    cargaReal = leerTerrenos()
      .then((info) =>
        Promise.all(
          mundos.map(async (m, i) => {
            const nombre = i === 0 ? "mons_mouton" : "payunia";
            const t = info[nombre];
            const g = await cargarModelo(nombre);
            if (!vivo) return;
            const normales = new THREE.TextureLoader().load(`/modelos/${t.normales}`, () => (pendiente = true));
            normales.flipY = false;
            normales.colorSpace = THREE.NoColorSpace;
            const material = new THREE.MeshStandardMaterial({
              color: i === 0 ? 0xcfcfcc : 0x9a7b5c,
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
              const contorno = contornoParcela(mallas[0], t, matParcela);
              if (contorno) m.real.add(contorno);
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
        // Stay in "real" as asked, but show the close-up. Choosing the relief again retries.
        cargaReal = null;
        if (!vivo) return;
        for (const w of mundos) w.real.clear();
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

  function ponerModo(m: ModoTerreno) {
    if (m === modo) return;
    modo = m;
    mostrar(m);
    if (m === "real") void cargarReal();
  }

  function iniciarCaida() {
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
    const t = (ahora - caidaInicio) / 1000;
    const fin: (number | null)[] = [null, null];
    mundos.forEach((m, i) => {
      const total = Math.sqrt((2 * props.alturaCaida) / m.g);
      const y = props.alturaCaida - 0.5 * m.g * t * t;
      m.bola.position.y = Math.max(0.11, y);
      if (t >= total) fin[i] = total;
    });
    const dicho = `${fin[0]}|${fin[1]}`;
    if (dicho !== caidaDicha) {
      caidaDicha = dicho;
      props.onCaida?.({ luna: fin[0], tierra: fin[1] });
    }
    if (fin[0] !== null && fin[1] !== null) caidaInicio = 0;
    pendiente = true;
  }

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

  useEffect(() => {
    if (sinWebgl || !lienzo.current || !caja.current) return;
    try {
      motor.current = crearMotor(lienzo.current, caja.current, ultimas.current, () => setSinWebgl(true), setEstadoReal);
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
  return (
    <div className="escena escena-mundos" ref={caja}>
      <canvas ref={lienzo} role="img" aria-label={props.etiqueta} />
      {props.terreno === "real" && estadoReal === "listo" && (
        <span className="static-caption" style={{ right: 10, bottom: 64 }}>
          {t(
            `Real relief, 30 × 30 km each · Moon: Mons Mouton (NASA LOLA) · Earth: Payunia around P-27, outlined (Copernicus GLO-30) · same Sun angle · vertical ×${exagTexto}`,
            `Relieve real, 30 × 30 km cada uno · Luna: Mons Mouton (NASA LOLA) · Tierra: Payunia alrededor de P-27, con contorno (Copernicus GLO-30) · mismo ángulo de Sol · vertical ×${exagTexto}`,
          )}
        </span>
      )}
      <CameraControls camera={motor} zoomIn={props.textoAcercar} zoomOut={props.textoAlejar} />
    </div>
  );
}
