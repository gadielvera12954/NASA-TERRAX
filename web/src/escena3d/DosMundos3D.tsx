import { CameraActions, CameraControls, turnCamera } from "./CameraControls";
/**
 * Two worlds, one stage: the same rover and the same 0.50 m board under the same Sun angle,
 * on the Moon (left of the curtain) and on Earth (right).
 *
 * What is physics here: shadow length h / tan(e), panel power F4, fall time √(2h/g).
 * What is illustration: ground colours, sky colour and the amount of sky light on Earth.
 * The ground is flat on purpose: no Earth terrain has been delivered yet (NASADEM pending).
 */
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/Language";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { cargarModelo, direccionSol, hayWebgl, liberar, panelesDelRover, sombras } from "./modelos";

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
}

interface Mundo {
  escena: THREE.Scene;
  luz: THREE.DirectionalLight;
  rover: THREE.Group | null;
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

const TABLITA: [number, number, number] = [-1.9, 0, 2.0];
const BOLA: [number, number] = [-0.6, -2.6];

function crearMundo(esLuna: boolean): Mundo {
  const escena = new THREE.Scene();
  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(220, 96),
    new THREE.MeshStandardMaterial({ color: esLuna ? 0xcfcfcc : 0x9a7b5c, roughness: 1, metalness: 0 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);
  const luz = new THREE.DirectionalLight(esLuna ? 0xffffff : 0xffe6c4, esLuna ? 17 : 8);
  luz.castShadow = true;
  // 2048 px over 110 m is 5 cm per texel: enough for a 10 cm board, and four times cheaper than 4096.
  luz.shadow.mapSize.set(2048, 2048);
  const c = luz.shadow.camera;
  c.left = -55;
  c.right = 55;
  c.top = 55;
  c.bottom = -55;
  c.near = 1;
  c.far = 400;
  luz.shadow.bias = -0.0004;
  luz.shadow.normalBias = 0.03;
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
    new THREE.MeshStandardMaterial({ color: 0xe7f434, roughness: 0.5 }),
  );
  bola.castShadow = true;
  bola.visible = false;
  escena.add(bola);
  const cinta = new THREE.Group();
  escena.add(cinta);
  return { escena, luz, rover: null, celdas: new Map(), bola, cinta, g: esLuna ? 1.62 : 9.8 };
}

function crearMotor(lienzo: HTMLCanvasElement, caja: HTMLElement, inicial: PropsMundos, onUnavailable: () => void): Motor {
  let props = inicial;
  let vivo = true;
  let pendiente = true;
  let cuadro = 0;
  let caidaVista = 0;
  let caidaInicio = 0;

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setScissorTest(true);

  const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
  // Start with the Sun behind the viewer's shoulder: the shadows run diagonally across the curtain.
  const haciaSol = direccionSol(inicial.azimut, 0);
  const giro = (-42 * Math.PI) / 180;
  camara.position.set(
    (haciaSol.x * Math.cos(giro) + haciaSol.z * Math.sin(giro)) * 12.5,
    3.3,
    (-haciaSol.x * Math.sin(giro) + haciaSol.z * Math.cos(giro)) * 12.5,
  );
  const controles = new OrbitControls(camara, lienzo);
  controles.enableZoom = false;
  lienzo.style.touchAction = "pan-y";
  controles.target.set(0, 1.25, 0);
  controles.update();
  controles.saveState();
  controles.minDistance = 4;
  controles.maxDistance = 60;
  controles.maxPolarAngle = Math.PI * 0.495;
  controles.enablePan = false;
  controles.addEventListener("change", () => (pendiente = true));

  const mundos: [Mundo, Mundo] = [crearMundo(true), crearMundo(false)];
  const cielo = new THREE.Color();
  const niebla = new THREE.Fog(0xffffff, 60, 260);
  mundos[1].escena.fog = niebla;
  let clave = "";
  let caidaDicha = "";
  const matCinta = new THREE.LineBasicMaterial({ color: 0xe7f434 });

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
    const largo = 0.5 / Math.tan((props.elevacion * Math.PI) / 180);
    mundos.forEach((m, i) => {
      m.luz.position.copy(dir).multiplyScalar(160);
      m.luz.target.position.set(0, 0, 0);
      m.g = i === 0 ? props.gLuna : props.gTierra;
      if (m.rover) m.rover.rotation.y = -(props.rumbo * Math.PI) / 180;
      ponerCinta(m, largo, haciaSombra);
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
        m.escena.add(g);
        aplicar();
      })
      .catch(() => { if (vivo) onUnavailable(); });
    cargarModelo("tablita")
      .then((g) => {
        if (!vivo) return;
        sombras(g, true, true);
        g.position.set(...TABLITA);
        g.userData.mundo = i;
        m.escena.add(g);
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
  aplicar();
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
      const nueva = [p.elevacion, p.azimut, p.rumbo, p.gLuna, p.gTierra, p.panelW, JSON.stringify(p.potencia)].join("|");
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
      renderer.dispose();
    },
  };
}

export default function DosMundos3D(props: PropsMundos) {
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
  return (
    <div className="escena escena-mundos" ref={caja}>
      <canvas ref={lienzo} role="img" aria-label={props.etiqueta} />
      <CameraControls camera={motor} zoomIn={props.textoAcercar} zoomOut={props.textoAlejar} />
    </div>
  );
}
