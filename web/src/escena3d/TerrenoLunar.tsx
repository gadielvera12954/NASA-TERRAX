import { CameraActions, CameraControls, turnCamera } from "./CameraControls";
/**
 * Real Mons Mouton relief in 3D (LOLA, built in Blender) with the engine's shadow rule on top.
 *
 * The shadow of every 60 m pixel is the contract lookup of esquemas/horizontes_bin.md
 * (nearest azimuth, e < e_h): the same bytes and the same rule as the parity test.
 * The mesh is only the display surface (120 m); numbers never come from it.
 */
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/Language";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Horizontes, indiceAzimut, leerHorizontes } from "../datos/laboratorio";
import { cargarModelo, direccionSol, hayWebgl, liberar } from "./modelos";

export interface PuntoGrilla {
  fila: number;
  col: number;
}
export interface PropsTerreno {
  /** Sun at the centre of the grid: geographic azimuth and elevation, degrees. */
  azimut: number;
  elevacion: number;
  capa: "sombra" | "oscuridad";
  /** Longest continuous darkness per pixel (hours), from refugios_*.png. */
  horas?: Uint16Array | null;
  limiteH?: number;
  punto?: PuntoGrilla | null;
  marcas?: (PuntoGrilla & { mejor?: boolean })[];
  onElegir?: (p: PuntoGrilla) => void;
  onSobre?: (p: (PuntoGrilla & { alturaKm: number }) | null) => void;
  etiqueta: string;
  textoSinWebgl: string;
  onStatic?: (value: boolean) => void;
  textoAcercar: string;
  textoAlejar: string;
  girar?: boolean;
  alto?: string;
}

const LADO = 500;
const PX_KM = 0.06;
const ROVER_ESCALA = 0.36; // 1 m of rover → 0.36 km on the map (×360), only to make it visible

interface Motor extends CameraActions {
  actualizar: (p: PropsTerreno) => void;
  destruir: () => void;
}

function acercarCamara(camara: THREE.PerspectiveCamera, controles: OrbitControls, factor: number) {
  const v = camara.position.clone().sub(controles.target);
  const largo = Math.min(controles.maxDistance, Math.max(controles.minDistance, v.length() * factor));
  camara.position.copy(controles.target).add(v.setLength(largo));
  controles.update();
}

/** 2nd and 98th percentile of the darkness map: the colour ramp spans the bulk of the terrain. */
export function rangoHoras(horas: Uint16Array): [number, number] {
  const cuenta = new Uint32Array(2048);
  let n = 0;
  for (let i = 0; i < horas.length; i++) {
    if (horas[i] === 65535) continue;
    cuenta[Math.min(2047, horas[i])]++;
    n++;
  }
  let suma = 0;
  let bajo = 0;
  let alto = 2047;
  let hallado = false;
  for (let h = 0; h < 2048; h++) {
    suma += cuenta[h];
    if (!hallado && suma >= 0.02 * n) {
      bajo = h;
      hallado = true;
    }
    if (suma >= 0.98 * n) {
      alto = h;
      break;
    }
  }
  return [bajo, Math.max(alto, bajo + 1)];
}

function rampaHoras(h: number, min: number, max: number, limite: number, out: [number, number, number]) {
  if (h <= limite) {
    out[0] = 255;
    out[1] = 255;
    out[2] = 190;
    return;
  }
  const t = Math.min(1, Math.max(0, (h - min) / Math.max(1, max - min)));
  out[0] = 213 + (48 - 213) * t;
  out[1] = 170 + (73 - 170) * t;
  out[2] = 101 + (83 - 101) * t;
}

function crearMotor(lienzo: HTMLCanvasElement, caja: HTMLElement, inicial: PropsTerreno, onUnavailable: () => void): Motor {
  let props = inicial;
  let vivo = true;
  let hz: Horizontes | null = null;
  let malla: THREE.Mesh | null = null;
  let rover: THREE.Group | null = null;
  let pendiente = true;
  let cuadro = 0;

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.15;
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x1f1f1e);
  const camara = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  camara.position.set(14, 12, 22);
  const controles = new OrbitControls(camara, lienzo);
  // The wheel belongs to the page (no scroll trap): zoom with the +/− buttons or a pinch.
  controles.enableZoom = false;
  lienzo.style.touchAction = "pan-y";
  controles.target.set(0, 1.3, 0);
  controles.minDistance = 5;
  controles.maxDistance = 75;
  controles.maxPolarAngle = Math.PI * 0.49;
  controles.enablePan = false;
  controles.update();
  controles.saveState();
  controles.autoRotateSpeed = 0.45;
  controles.addEventListener("change", () => (pendiente = true));

  const sol = new THREE.DirectionalLight(0xffffff, 10);
  escena.add(sol, sol.target);
  escena.add(new THREE.AmbientLight(0x8fa6d8, 0.1));
  const disco = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12), new THREE.MeshBasicMaterial({ color: 0xb98539 }));
  escena.add(disco);

  // Texture painted from horizontes.bin: one texel per 60 m pixel, row 0 = grid north.
  const pix = new Uint8Array(LADO * LADO * 4).fill(255);
  const textura = new THREE.DataTexture(pix, LADO, LADO, THREE.RGBAFormat);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearFilter;
  const normales = new THREE.TextureLoader().load("/modelos/mons_mouton_normales.png", () => (pendiente = true));
  normales.flipY = false;
  normales.colorSpace = THREE.NoColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map: textura,
    normalMap: normales,
    normalMapType: THREE.ObjectSpaceNormalMap,
    roughness: 1,
    metalness: 0,
  });

  // Marker of the parked rover
  const marca = new THREE.Group();
  marca.visible = false;
  const amarillo = new THREE.MeshBasicMaterial({ color: 0xb98539 });
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 8), amarillo);
  pin.position.y = 2.3;
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 8, 48), amarillo);
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.06;
  marca.add(pin, aro);
  escena.add(marca);
  const intentos = new THREE.Group();
  escena.add(intentos);
  const geoIntento = new THREE.SphereGeometry(0.16, 12, 8);
  const matIntento = new THREE.MeshBasicMaterial({ color: 0x2491ff });
  const matMejor = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Geographic north arrow at the south-west corner of the map (grid north is −Z)
  const norte = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-14.2, 0.2, 14.2), 3.2, 0xbdbab3, 0.7, 0.35);
  escena.add(norte);

  const rayo = new THREE.Raycaster();
  const abajo = new THREE.Vector3(0, -1, 0);
  function alturaEn(fila: number, col: number): number {
    if (!malla) return 0;
    const x = (col - (LADO - 1) / 2) * PX_KM;
    const z = (fila - (LADO - 1) / 2) * PX_KM;
    rayo.set(new THREE.Vector3(x, 60, z), abajo);
    const hit = rayo.intersectObject(malla, false)[0];
    return hit ? hit.point.y : 0;
  }
  function colocar(obj: THREE.Object3D, p: PuntoGrilla) {
    obj.position.set((p.col - (LADO - 1) / 2) * PX_KM, alturaEn(p.fila, p.col), (p.fila - (LADO - 1) / 2) * PX_KM);
  }

  const color: [number, number, number] = [0, 0, 0];
  let minH = 0;
  let maxH = 1;
  let horasVistas: Uint16Array | null | undefined;
  function pintar() {
    const conv = hz ? hz.convergencia : 30.993;
    const azG = (((props.azimut + conv) % 360) + 360) % 360;
    const n = LADO * LADO;
    const horas = props.capa === "oscuridad" ? props.horas : null;
    if (horas && horas !== horasVistas) {
      [minH, maxH] = rangoHoras(horas);
      horasVistas = horas;
    }
    const base = hz ? indiceAzimut(azG, hz.nAz) * n : 0;
    const umbral = props.elevacion * 10 + 128; // e < e_h  ⇔  byte > e·10 + 128
    for (let i = 0; i < n; i++) {
      const enSombra = hz ? hz.datos[base + i] > umbral : false;
      const j = i * 4;
      if (horas) {
        const h = horas[i];
        if (h === 65535) {
          pix[j] = pix[j + 1] = pix[j + 2] = 60;
        } else {
          rampaHoras(h, minH, maxH, props.limiteH ?? 50, color);
          const k = enSombra ? 0.5 : 1;
          pix[j] = color[0] * k;
          pix[j + 1] = color[1] * k;
          pix[j + 2] = color[2] * k;
        }
      } else if (enSombra) {
        pix[j] = 14;
        pix[j + 1] = 18;
        pix[j + 2] = 34;
      } else {
        pix[j] = pix[j + 1] = 232;
        pix[j + 2] = 236;
      }
    }
    textura.needsUpdate = true;

    // Light: exposure follows the grazing angle so that flat ground stays readable.
    const elLuz = Math.max(props.elevacion, 1.2);
    const dir = direccionSol(azG, elLuz);
    sol.position.copy(dir).multiplyScalar(80);
    const deNoche = props.elevacion < -0.6;
    sol.intensity = deNoche ? 0 : Math.min(34, (0.42 * Math.PI) / Math.sin((elLuz * Math.PI) / 180));
    // In the darkness layer the colours must read the same at any hour.
    if (!!horas !== !!material.emissiveMap) {
      material.emissive.set(horas ? 0xffffff : 0x000000);
      material.emissiveMap = horas ? textura : null;
      material.emissiveIntensity = horas ? 0.55 : 0;
      material.needsUpdate = true;
    }
    disco.visible = props.elevacion > -0.3;
    disco.position.copy(direccionSol(azG, props.elevacion)).multiplyScalar(27);
    norte.setDirection(direccionSol(conv, 0));

    if (props.punto && malla) {
      colocar(marca, props.punto);
      marca.visible = true;
      if (rover) {
        // "Sun on the corner" heading (documento 04): the Sun stays 45° off the front.
        rover.rotation.y = -((azG - 45) * Math.PI) / 180;
      }
    } else marca.visible = false;
    pendiente = true;
  }

  function pintarMarcas() {
    intentos.clear();
    if (!malla) return;
    for (const m of props.marcas ?? []) {
      const s = new THREE.Mesh(geoIntento, m.mejor ? matMejor : matIntento);
      colocar(s, m);
      s.position.y += 0.25;
      intentos.add(s);
    }
    pendiente = true;
  }

  cargarModelo("mons_mouton")
    .then((g) => {
      if (!vivo) return;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = material;
          malla = m;
        }
      });
      escena.add(g);
      g.updateMatrixWorld(true);
      pintar();
      pintarMarcas();
    })
    .catch(() => { if (vivo) onUnavailable(); });
  cargarModelo("rover")
    .then((g) => {
      if (!vivo) return;
      rover = g;
      g.scale.setScalar(ROVER_ESCALA);
      marca.add(g);
      pintar();
    })
    .catch(() => { if (vivo) onUnavailable(); });
  leerHorizontes()
    .then((h) => {
      if (!vivo) return;
      hz = h;
      pintar();
    })
    .catch(() => { if (vivo) onUnavailable(); });

  // Picking
  const puntero = new THREE.Vector2();
  let bajada: { x: number; y: number } | null = null;
  let sobre = 0;
  function pixelBajo(ev: PointerEvent): (PuntoGrilla & { alturaKm: number }) | null {
    if (!malla) return null;
    const r = lienzo.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const hit = rayo.intersectObject(malla, false)[0];
    if (!hit || !hit.uv) return null;
    return {
      fila: Math.min(LADO - 1, Math.max(0, Math.floor(hit.uv.y * LADO))),
      col: Math.min(LADO - 1, Math.max(0, Math.floor(hit.uv.x * LADO))),
      alturaKm: hit.point.y,
    };
  }
  const alBajar = (ev: PointerEvent) => (bajada = { x: ev.clientX, y: ev.clientY });
  const alSubir = (ev: PointerEvent) => {
    if (!bajada || !props.onElegir) return;
    const quieto = Math.hypot(ev.clientX - bajada.x, ev.clientY - bajada.y) < 6;
    bajada = null;
    if (!quieto) return;
    const p = pixelBajo(ev);
    if (p) props.onElegir({ fila: p.fila, col: p.col });
  };
  const alMover = (ev: PointerEvent) => {
    if (!props.onSobre || sobre) return;
    sobre = requestAnimationFrame(() => {
      sobre = 0;
      if (vivo) props.onSobre?.(pixelBajo(ev));
    });
  };
  const alSalir = () => props.onSobre?.(null);
  lienzo.addEventListener("pointerdown", alBajar);
  lienzo.addEventListener("pointerup", alSubir);
  lienzo.addEventListener("pointermove", alMover);
  lienzo.addEventListener("pointerleave", alSalir);

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

  const ciclo = () => {
    if (!vivo) return;
    cuadro = requestAnimationFrame(ciclo);
    if (controles.autoRotate) {
      controles.update();
      pendiente = true;
    }
    if (pendiente) {
      pendiente = false;
      renderer.render(escena, camara);
    }
  };
  controles.autoRotate = !!inicial.girar;
  pintar();
  ciclo();

  return {
    restablecer() { controles.reset(); pendiente = true; },
    girar(direction) { turnCamera(camara, controles, direction); pendiente = true; },
    acercar(factor) {
      acercarCamara(camara, controles, factor);
      pendiente = true;
    },
    actualizar(p) {
      const marcasCambian = p.marcas !== props.marcas;
      props = p;
      controles.autoRotate = !!p.girar;
      pintar();
      if (marcasCambian) pintarMarcas();
    },
    destruir() {
      vivo = false;
      cancelAnimationFrame(cuadro);
      if (sobre) cancelAnimationFrame(sobre);
      observador.disconnect();
      lienzo.removeEventListener("pointerdown", alBajar);
      lienzo.removeEventListener("pointerup", alSubir);
      lienzo.removeEventListener("pointermove", alMover);
      lienzo.removeEventListener("pointerleave", alSalir);
      controles.dispose();
      liberar(escena);
      textura.dispose();
      normales.dispose();
      renderer.dispose();
    },
  };
}

export default function TerrenoLunar(props: PropsTerreno) {
  const { t } = useLanguage();
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const ultimas = useRef(props);
  ultimas.current = props;
  const [sinWebgl, setSinWebgl] = useState(() => !hayWebgl());

  useEffect(() => {
    if (sinWebgl || !lienzo.current || !caja.current) return;
    try {
      motor.current = crearMotor(lienzo.current, caja.current, ultimas.current, () => setSinWebgl(true));
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

  useEffect(() => { props.onStatic?.(sinWebgl); }, [sinWebgl, props.onStatic]);

  if (sinWebgl)
    return (
      <figure className="escena escena-plana" style={{ height: "auto" }}>
        <img src="/img/mons-mouton-atlas.webp" alt={t("Static relief map of Mons Mouton", "Mapa estático del relieve de Mons Mouton")} />
        <figcaption>{props.textoSinWebgl}</figcaption>
      </figure>
    );
  return (
    <div className="escena" ref={caja} style={{ height: props.alto }}>
      <canvas ref={lienzo} role="img" aria-label={props.etiqueta} className={props.onElegir ? "elegible" : undefined} />
      <CameraControls camera={motor} zoomIn={props.textoAcercar} zoomOut={props.textoAlejar} />
    </div>
  );
}
