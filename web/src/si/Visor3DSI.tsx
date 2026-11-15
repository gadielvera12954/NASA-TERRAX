/**
 * Small 3D view the SI guide inserts in a reply when the question is about relief, light or the rover.
 * It only shows models the team already publishes in /modelos (Blender, from the 60 m grids):
 * the guide chooses WHICH model to show, never the numbers in it.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize2, Pause, Play, RotateCcw } from "lucide-react";
import { cargarModelo, direccionSol, hayWebgl, liberar, NombreModelo, zocalo } from "../escena3d/modelos";

export type Modelo3DSI = "moon" | "payunia" | "mars" | "rover";

interface Ficha3D {
  archivo: NombreModelo;
  normales?: string;
  suelo: number;
  base: number;
  exageracion: number;
  en: [string, string];
  es: [string, string];
}

export const MODELOS_3D: Record<Modelo3DSI, Ficha3D> = {
  moon: {
    archivo: "mons_mouton",
    normales: "mons_mouton_normales.png",
    suelo: 0xb9b6ae,
    base: 0x3b3a37,
    exageracion: 2,
    en: ["Mons Mouton · Moon", "NASA LOLA relief, 60 m grid, 30 × 30 km"],
    es: ["Mons Mouton · Luna", "Relieve NASA LOLA, grilla de 60 m, 30 × 30 km"],
  },
  payunia: {
    archivo: "payunia",
    normales: "payunia_normales.png",
    suelo: 0xa98a6a,
    base: 0x4a3626,
    exageracion: 3,
    en: ["Payunia · Earth", "Copernicus DEM relief, same 60 m grid"],
    es: ["Payunia · Tierra", "Relieve Copernicus DEM, misma grilla de 60 m"],
  },
  mars: {
    archivo: "marte_jezero",
    normales: "marte_jezero_normales.png",
    suelo: 0xb5714a,
    base: 0x4d2a1b,
    exageracion: 2,
    en: ["Jezero · Mars", "Perseverance landing area, published relief"],
    es: ["Jezero · Marte", "Zona de aterrizaje de Perseverance, relieve publicado"],
  },
  rover: {
    archivo: "rover",
    suelo: 0x9a9890,
    base: 0x2c2b29,
    exageracion: 1,
    en: ["Rover template", "Generic shape with VIPER's public dimensions (not an official model)"],
    es: ["Plantilla de rover", "Forma genérica con las medidas públicas de VIPER (no es un modelo oficial)"],
  },
};

interface Props {
  modelo: Modelo3DSI;
  idioma: "en" | "es";
  elevacionSolDeg: number;
}

export default function Visor3DSI({ modelo, idioma, elevacionSolDeg }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error" | "sin-webgl">("cargando");
  const [gira, setGira] = useState(true);
  const giraRef = useRef(true);
  const reiniciarRef = useRef<() => void>(() => {});
  const solRef = useRef(elevacionSolDeg);
  const ficha = MODELOS_3D[modelo];
  const [titulo, nota] = idioma === "es" ? ficha.es : ficha.en;
  const t = (en: string, es: string) => (idioma === "es" ? es : en);

  useEffect(() => {
    giraRef.current = gira;
  }, [gira]);
  useEffect(() => {
    solRef.current = elevacionSolDeg;
  }, [elevacionSolDeg]);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    if (!hayWebgl()) {
      setEstado("sin-webgl");
      return;
    }
    let vivo = true;
    const ancho = () => Math.max(200, nodo.clientWidth);
    const alto = () => Math.max(180, nodo.clientHeight);
    const render = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    render.setSize(ancho(), alto());
    render.shadowMap.enabled = true;
    render.shadowMap.type = THREE.PCFSoftShadowMap;
    render.toneMapping = THREE.ACESFilmicToneMapping;
    render.outputColorSpace = THREE.SRGBColorSpace;
    render.domElement.setAttribute("aria-hidden", "true");
    nodo.appendChild(render.domElement);

    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(38, ancho() / alto(), 0.01, 500);
    const controles = new OrbitControls(camara, render.domElement);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controles.enablePan = false;
    controles.maxPolarAngle = Math.PI * 0.48;

    escena.add(new THREE.HemisphereLight(0xdfe9ef, 0x1b1712, 0.35));
    const sol = new THREE.DirectionalLight(0xfff1d6, 3.2);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.bias = -0.0004;
    escena.add(sol, sol.target);

    const grupo = new THREE.Group();
    escena.add(grupo);
    let normales: THREE.Texture | null = null;
    let radio = 1;
    let azimut = 210;

    const ubicarSol = () => {
      const el = Math.min(80, Math.max(1.5, solRef.current || 5));
      // The model sits on its own pedestal; a grazing Sun at the slider's elevation, slowly swinging in azimuth.
      const dir = direccionSol(azimut, el);
      sol.position.copy(dir.multiplyScalar(radio * 4));
      sol.target.position.set(0, 0, 0);
      const s = sol.shadow.camera as THREE.OrthographicCamera;
      s.left = s.bottom = -radio * 1.6;
      s.right = s.top = radio * 1.6;
      s.near = 0.01;
      s.far = radio * 10;
      s.updateProjectionMatrix();
    };

    const encuadre = () => {
      camara.position.set(radio * 1.55, radio * 0.95, radio * 1.55);
      controles.target.set(0, 0, 0);
      controles.minDistance = radio * 0.6;
      controles.maxDistance = radio * 4;
      controles.update();
    };
    reiniciarRef.current = encuadre;

    cargarModelo(ficha.archivo)
      .then((g) => {
        if (!vivo) {
          liberar(g);
          return;
        }
        const mallas: THREE.Mesh[] = [];
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) mallas.push(m);
        });
        if (ficha.normales) {
          normales = new THREE.TextureLoader().load(`/modelos/${ficha.normales}`);
          normales.flipY = false;
          normales.colorSpace = THREE.NoColorSpace;
          const mat = new THREE.MeshStandardMaterial({
            color: ficha.suelo,
            normalMap: normales,
            normalMapType: THREE.ObjectSpaceNormalMap,
            roughness: 1,
            metalness: 0,
          });
          for (const m of mallas) m.material = mat;
          if (mallas[0]) {
            const pared = zocalo(mallas[0], 0.6, new THREE.MeshStandardMaterial({ color: ficha.base, roughness: 1, side: THREE.DoubleSide }));
            if (pared) mallas[0].add(pared);
          }
        }
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        // Centre on the origin and fit in a unit-ish box; the vertical exaggeration is shown on the card.
        const b = new THREE.Box3().setFromObject(g);
        const c = b.getCenter(new THREE.Vector3());
        g.position.sub(c);
        const envoltorio = new THREE.Group();
        envoltorio.add(g);
        const tam = b.getSize(new THREE.Vector3());
        const lado = Math.max(tam.x, tam.z) || 1;
        const k = 2 / lado;
        envoltorio.scale.set(k, k * ficha.exageracion, k);
        grupo.add(envoltorio);
        if (ficha.archivo === "rover") {
          const piso = new THREE.Mesh(
            new THREE.CircleGeometry(1.6, 64),
            new THREE.MeshStandardMaterial({ color: ficha.suelo, roughness: 1 }),
          );
          piso.rotation.x = -Math.PI / 2;
          piso.position.y = -tam.y * k * 0.5;
          piso.receiveShadow = true;
          grupo.add(piso);
        }
        radio = 1.25;
        ubicarSol();
        encuadre();
        setEstado("listo");
      })
      .catch(() => vivo && setEstado("error"));

    // Entrance: the model rises from its pedestal and the camera settles.
    const t0 = performance.now();
    let ultimo = t0;
    let cuadro = 0;
    const animar = (ahora: number) => {
      cuadro = requestAnimationFrame(animar);
      const dt = Math.min(0.05, (ahora - ultimo) / 1000);
      ultimo = ahora;
      const k = Math.min(1, (ahora - t0) / 900);
      const suave = 1 - Math.pow(1 - k, 3);
      grupo.scale.setScalar(0.85 + 0.15 * suave);
      if (giraRef.current) grupo.rotation.y += dt * 0.18;
      azimut = (azimut + dt * 4) % 360;
      ubicarSol();
      controles.update();
      render.render(escena, camara);
    };
    cuadro = requestAnimationFrame(animar);

    const obs = new ResizeObserver(() => {
      render.setSize(ancho(), alto());
      camara.aspect = ancho() / alto();
      camara.updateProjectionMatrix();
    });
    obs.observe(nodo);

    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      obs.disconnect();
      controles.dispose();
      liberar(escena);
      normales?.dispose();
      render.dispose();
      render.domElement.remove();
    };
  }, [modelo]);

  return (
    <figure className="si-3d" data-estado={estado}>
      <div className="si-3d-lienzo" ref={caja}>
        {estado === "cargando" && <span className="si-3d-carga" role="status">{t("Loading 3D model…", "Cargando modelo 3D…")}</span>}
        {estado === "error" && <span className="si-3d-carga">{t("The 3D model could not be loaded.", "No se pudo cargar el modelo 3D.")}</span>}
        {estado === "sin-webgl" && <span className="si-3d-carga">{t("This browser has no WebGL, so the 3D view is off.", "Este navegador no tiene WebGL: la vista 3D está apagada.")}</span>}
        <div className="si-3d-botones">
          <button type="button" onClick={() => setGira((v) => !v)} aria-label={gira ? t("Pause rotation", "Pausar giro") : t("Rotate", "Girar")} title={gira ? t("Pause rotation", "Pausar giro") : t("Rotate", "Girar")}>
            {gira ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button type="button" onClick={() => reiniciarRef.current()} aria-label={t("Reset view", "Restablecer vista")} title={t("Reset view", "Restablecer vista")}>
            <RotateCcw size={14} />
          </button>
          {modelo !== "rover" && (
            <a href={modelo === "moon" ? "#lab" : "#worlds"} aria-label={t("Open the full 3D view", "Abrir la vista 3D completa")} title={t("Open the full 3D view", "Abrir la vista 3D completa")}>
              <Maximize2 size={14} />
            </a>
          )}
        </div>
      </div>
      <figcaption>
        <strong>{titulo}</strong>
        <span>
          {nota}
          {ficha.exageracion > 1 && ` · ${t("vertical", "vertical")} ×${ficha.exageracion}`}
          {` · ${t("Sun", "Sol")} ${Math.min(80, Math.max(1.5, elevacionSolDeg || 5)).toFixed(1)}°`}
        </span>
      </figcaption>
    </figure>
  );
}
