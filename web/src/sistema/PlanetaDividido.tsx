/**
 * Home background: one globe, Earth on the left of a glowing divider and the Moon on the right.
 *
 * Imagery (NASA, public domain), downloaded 2026-11-15 and reduced with
 * `ffmpeg -vf scale=2048:1024:flags=lanczos -c:v libwebp` into /img/inicio:
 *   tierra_dia    Blue Marble Next Generation, December 2004, topography + bathymetry
 *                 assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/december/world.topo.bathy.200412.3x5400x2700.jpg
 *   tierra_noche  Black Marble 2016, 0.1°
 *                 assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg
 *   luna_color    LRO LROC colour mosaic, CGI Moon Kit (NASA SVS 4720)
 *                 svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif
 *   luna_relieve  LOLA elevation, 8-bit, CGI Moon Kit (kept at 1024 × 512)
 *                 svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_3_8bit.jpg
 *
 * Tilts come from `CONSTANTES` (NSSDCA fact sheets). Spin is drawn to scale: the Earth turns once
 * every `VUELTA_TIERRA_S` seconds and the Moon `ROTACION_LUNA_H / ROTACION_TIERRA_H` times slower.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CONSTANTES } from "../escena3d/mundos";

/** Globe radius as a fraction of the smaller side of the `disco` box (the CSS uses 43cqmin). */
export const RADIO_DISCO = 0.43;
/** Sidereal rotation periods, hours (NSSDCA Earth and Moon fact sheets). */
export const ROTACION_TIERRA_H = 23.9345;
export const ROTACION_LUNA_H = 655.72;
/** Display rate: one Earth turn every 60 s. */
export const VUELTA_TIERRA_S = 60;

const IMG = "/img/inicio/";
const FOV = 26;
/** Sun from the front left: the Earth half is in daylight, the lunar terminator sits near the right limb. */
const SOL = new THREE.Vector3(-0.55, 0.3, 0.78).normalize();
const GRADO = Math.PI / 180;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vMundo;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec4 m = modelMatrix * vec4(position, 1.0);
  vMundo = m.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * m;
}`;

const COSTURA = /* glsl */ `
uniform float uCostura;
uniform float uBrillo;
uniform vec3 uSol;
vec3 costura(float x) {
  float d = abs(x - uCostura);
  return vec3(0.55, 0.95, 1.0) * (exp(-d * 120.0) * 1.7 + exp(-d * 18.0) * 0.2) * uBrillo;
}`;

const FRAG_TIERRA = /* glsl */ `
uniform sampler2D uDia;
uniform sampler2D uNoche;
varying vec2 vUv;
varying vec3 vMundo;
varying vec3 vNormal;
${COSTURA}
void main() {
  if (vMundo.x > uCostura) discard;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vMundo);
  vec3 L = normalize(uSol);
  float nl = dot(N, L);
  vec3 dia = texture2D(uDia, vUv).rgb;
  vec3 noche = texture2D(uNoche, vUv).rgb;
  // Soft terminator: the atmosphere scatters light past the geometric edge.
  float luz = clamp((nl + 0.12) / 1.12, 0.0, 1.0);
  vec3 col = dia * (0.012 + 1.25 * luz);
  // Sun glint only on water (blue clearly above red in the Blue Marble colours).
  vec3 s = sqrt(dia);
  float mar = smoothstep(0.05, 0.16, s.b - s.r);
  float nh = max(dot(N, normalize(L + V)), 0.0);
  col += vec3(1.0, 0.9, 0.75) * (pow(nh, 180.0) * 0.4 + pow(nh, 28.0) * 0.035) * mar * step(0.0, nl);
  // City lights on the night side.
  float lum = dot(noche, vec3(0.3, 0.59, 0.11));
  float oscuro = smoothstep(0.06, -0.22, nl);
  col += (vec3(1.0, 0.74, 0.4) * smoothstep(0.12, 0.6, lum) * 1.7 + noche * 0.1) * oscuro;
  col += vec3(0.95, 0.45, 0.2) * exp(-abs(nl) * 14.0) * 0.05;
  // Atmosphere: blue haze toward the limb, brighter on the day side.
  float f = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  float de_dia = smoothstep(-0.3, 0.45, nl);
  vec3 aire = vec3(0.3, 0.58, 1.0);
  col = mix(col, aire * (0.15 + de_dia), f * 0.6);
  col += aire * f * de_dia * 0.3;
  col += costura(vMundo.x);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FRAG_LUNA = /* glsl */ `
uniform sampler2D uColor;
uniform sampler2D uRelieve;
uniform float uEscala;
varying vec2 vUv;
varying vec3 vMundo;
varying vec3 vNormal;
${COSTURA}
vec3 perturbar(vec3 pos, vec3 n, vec2 dH) {
  vec3 sx = normalize(dFdx(pos));
  vec3 sy = normalize(dFdy(pos));
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
void main() {
  if (vMundo.x <= uCostura) discard;
  vec2 dx = dFdx(vUv);
  vec2 dy = dFdy(vUv);
  float h = texture2D(uRelieve, vUv).r;
  vec2 dH = vec2(texture2D(uRelieve, vUv + dx).r - h, texture2D(uRelieve, vUv + dy).r - h) * uEscala;
  vec3 N = perturbar(vMundo, normalize(vNormal), dH);
  vec3 L = normalize(uSol);
  vec3 albedo = texture2D(uColor, vUv).rgb;
  // No air: a hard terminator and black shadows.
  float nl = max(dot(N, L), 0.0);
  vec3 col = albedo * (0.004 + 1.35 * pow(nl, 0.85));
  col += costura(vMundo.x);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FRAG_HALO = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vMundo;
uniform float uCostura;
uniform vec3 uSol;
void main() {
  // Back faces of a slightly larger sphere: 1 at the planet's limb, 0 at the halo's edge.
  float i = pow(clamp(-vNormalV.z / 0.42, 0.0, 1.0), 2.2);
  float tierra = smoothstep(uCostura + 0.02, uCostura - 0.06, vMundo.x);
  float sol = mix(0.18, 1.0, smoothstep(-0.4, 0.6, dot(normalize(vMundo), normalize(uSol))));
  gl_FragColor = vec4(vec3(0.32, 0.6, 1.0) * i * tierra * sol * 0.95, 1.0);
}`;

const FRAG_HAZ = /* glsl */ `
varying vec2 vUv;
uniform float uBrillo;
uniform float uMedio;
uniform float uAncho;
uniform float uAlto;
void main() {
  float x = abs(vUv.x - 0.5) * uAncho;
  float y = abs(vUv.y - 0.5) * uAlto;
  float fuera = 1.0 - smoothstep(uMedio, uMedio + 0.55, y);
  float a = (exp(-x * 160.0) + exp(-x * 40.0) * 0.25) * fuera * uBrillo;
  gl_FragColor = vec4(vec3(0.55, 0.95, 1.0) * a, 1.0);
}`;

const VERT_ESTRELLAS = /* glsl */ `
attribute float aTam;
attribute float aFase;
attribute vec3 aColor;
uniform float uTiempo;
uniform float uDpr;
varying vec3 vColor;
void main() {
  vColor = aColor * (0.72 + 0.28 * sin(uTiempo * (0.6 + aFase * 1.7) + aFase * 40.0));
  gl_PointSize = aTam * uDpr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG_ESTRELLAS = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a, 1.0);
}`;

/** Deterministic pseudo-random numbers so the sky is the same on every load. */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function estrellas(n: number) {
  const r = azar(20261115);
  const pos = new Float32Array(n * 3);
  const tam = new Float32Array(n);
  const fase = new Float32Array(n);
  const color = new Float32Array(n * 3);
  const tonos = [
    [0.75, 0.85, 1.0],
    [1.0, 1.0, 1.0],
    [1.0, 0.9, 0.75],
    [0.85, 0.95, 1.0],
  ];
  for (let i = 0; i < n; i++) {
    const z = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(1 - z * z);
    pos.set([k * Math.cos(a) * 60, z * 60, k * Math.sin(a) * 60 - 20], i * 3);
    const brillo = Math.pow(r(), 6);
    tam[i] = 1.1 + brillo * 3.6;
    fase[i] = r();
    const tono = tonos[Math.floor(r() * tonos.length)];
    const v = 0.35 + brillo * 0.65;
    color.set([tono[0] * v, tono[1] * v, tono[2] * v], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aTam", new THREE.BufferAttribute(tam, 1));
  g.setAttribute("aFase", new THREE.BufferAttribute(fase, 1));
  g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  return g;
}

/** Four-point lens glint drawn once into a canvas. */
function texturaDestello() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const centro = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  centro.addColorStop(0, "rgba(220,250,255,1)");
  centro.addColorStop(0.12, "rgba(140,230,240,.55)");
  centro.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = centro;
  g.fillRect(0, 0, 128, 128);
  for (const [w, h] of [
    [128, 3],
    [3, 128],
  ]) {
    const raya = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    raya.addColorStop(0, "rgba(200,250,255,.9)");
    raya.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = raya;
    g.fillRect(64 - w / 2, 64 - h / 2, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface PlanetaDivididoProps {
  /** Box the globe is centred in; its radius is RADIO_DISCO × the box's smaller side. */
  disco: React.RefObject<HTMLElement>;
  /** Divider in globe radii: −1 all Moon, 0 half and half, +1 all Earth. Read every frame. */
  costura: React.MutableRefObject<number>;
  /** True while the pointer is over the globe or dragging: the divider glows brighter. */
  resaltar: React.MutableRefObject<boolean>;
  /** Called once the textured globe is on screen. `animado` is false on software WebGL and with
   *  reduced motion: then frames are drawn only when the divider or the layout changes. */
  onListo: (animado: boolean) => void;
  onFallo: () => void;
}

export default function PlanetaDividido({
  disco,
  costura,
  resaltar,
  onListo,
  onFallo,
}: PlanetaDivididoProps) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const avisos = useRef({ onListo, onFallo });
  avisos.current = { onListo, onFallo };

  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: lienzo,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      avisos.current.onFallo();
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const nombreGpu = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "",
    );
    const software = /swiftshader|llvmpipe|software|basic render/i.test(nombreGpu);
    const quieto = matchMedia("(prefers-reduced-motion: reduce)");
    const animado = () => !software && !quieto.matches;

    const escena = new THREE.Scene();
    const camara = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
    let distancia = 4;

    const comunes = {
      uCostura: { value: costura.current },
      uBrillo: { value: 1 },
      uSol: { value: SOL.clone() },
    };
    const cargador = new THREE.TextureLoader();
    const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const textura = (nombre: string, color: boolean) =>
      cargador.loadAsync(IMG + nombre).then((t) => {
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = anisotropia;
        return t;
      });

    const esfera = new THREE.SphereGeometry(1, 160, 112);
    const matTierra = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_TIERRA,
      uniforms: { ...comunes, uDia: { value: null }, uNoche: { value: null } },
    });
    const matLuna = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG_LUNA,
      uniforms: {
        ...comunes,
        uColor: { value: null },
        uRelieve: { value: null },
        uEscala: { value: 3.2 },
      },
    });
    // Each body spins inside a group that holds its axial tilt (rolled toward the left of the screen).
    const ejeTierra = new THREE.Group();
    ejeTierra.rotation.z = CONSTANTES.tierra.inclinacionDeg * GRADO;
    const tierra = new THREE.Mesh(esfera, matTierra);
    // Longitude λ faces the camera when rotation.y = −π/2 − λ. Start with South America in view.
    tierra.rotation.y = -Math.PI / 2 + 20 * GRADO;
    ejeTierra.add(tierra);
    const ejeLuna = new THREE.Group();
    ejeLuna.rotation.z = CONSTANTES.luna.inclinacionDeg * GRADO;
    const luna = new THREE.Mesh(esfera, matLuna);
    luna.rotation.y = -Math.PI / 2; // near side
    ejeLuna.add(luna);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vNormalV;
          varying vec3 vMundo;
          void main() {
            vNormalV = normalize(normalMatrix * normal);
            vMundo = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: FRAG_HALO,
        uniforms: { uCostura: comunes.uCostura, uSol: comunes.uSol },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );

    // Light beam that continues the divider above and below the globe.
    const ANCHO_HAZ = 0.1;
    const ALTO_HAZ = 3.4;
    const matHaz = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: FRAG_HAZ,
      uniforms: {
        uBrillo: comunes.uBrillo,
        uMedio: { value: 1 },
        uAncho: { value: ANCHO_HAZ },
        uAlto: { value: ALTO_HAZ },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const haz = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO_HAZ, ALTO_HAZ), matHaz);

    const destello = texturaDestello();
    const matDestello = new THREE.SpriteMaterial({
      map: destello,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const destellos = [new THREE.Sprite(matDestello), new THREE.Sprite(matDestello)];
    destellos.forEach((d) => d.scale.setScalar(0.3));

    const cielo = estrellas(2600);
    const matCielo = new THREE.ShaderMaterial({
      vertexShader: VERT_ESTRELLAS,
      fragmentShader: FRAG_ESTRELLAS,
      uniforms: { uTiempo: { value: 0 }, uDpr: { value: 1 } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const puntos = new THREE.Points(cielo, matCielo);

    escena.add(puntos, ejeTierra, ejeLuna, halo, haz, ...destellos);

    function colocarCostura(s: number) {
      comunes.uCostura.value = s;
      const medio = Math.sqrt(Math.max(0, 1 - s * s));
      haz.position.set(s, 0, 0);
      matHaz.uniforms.uMedio.value = medio;
      destellos[0].position.set(s, medio, 0);
      destellos[1].position.set(s, -medio, 0);
      const visible = Math.abs(s) < 0.985;
      haz.visible = visible;
      destellos.forEach((d) => (d.visible = visible));
    }
    colocarCostura(costura.current);

    let sucio = true;
    function ajustar() {
      const caja = disco.current;
      if (!lienzo || !caja) return;
      const cr = lienzo.getBoundingClientRect();
      const dr = caja.getBoundingClientRect();
      const w = Math.max(1, cr.width);
      const h = Math.max(1, cr.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4.5e6 / (w * h)));
      renderer.setPixelRatio(software ? Math.min(dpr, 1) : dpr);
      renderer.setSize(w, h, false);
      matCielo.uniforms.uDpr.value = renderer.getPixelRatio();
      const cx = dr.left + dr.width / 2 - cr.left;
      const cy = dr.top + dr.height / 2 - cr.top;
      const rpx = Math.max(20, RADIO_DISCO * Math.min(dr.width, dr.height));
      // Distance at which a unit sphere's silhouette spans rpx pixels for this field of view.
      const k = (rpx / (h / 2)) * Math.tan((FOV / 2) * GRADO);
      distancia = 1 / Math.sin(Math.atan(k));
      camara.aspect = w / h;
      // Off-axis frustum: the globe stays round but its centre lands on the centre of the box.
      camara.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
      camara.updateProjectionMatrix();
      sucio = true;
    }

    let giro = { x: 0, y: 0 };
    const objetivo = { x: 0, y: 0 };
    function alMover(e: PointerEvent) {
      objetivo.x = (e.clientX / innerWidth - 0.5) * 0.14;
      objetivo.y = (e.clientY / innerHeight - 0.5) * 0.09;
    }
    function colocarCamara() {
      camara.position.set(
        Math.sin(giro.x) * Math.cos(giro.y) * distancia,
        Math.sin(giro.y) * distancia,
        Math.cos(giro.x) * Math.cos(giro.y) * distancia,
      );
      camara.lookAt(0, 0, 0);
    }

    let listo = false;
    let visible = true;
    let ultimaCostura = NaN;
    let previo = performance.now();
    let reloj = 0;
    let raf = 0;
    const vueltaTierra = (Math.PI * 2) / VUELTA_TIERRA_S;
    const vueltaLuna = vueltaTierra * (ROTACION_TIERRA_H / ROTACION_LUNA_H);

    function cuadro(ahora: number) {
      raf = requestAnimationFrame(cuadro);
      const dt = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      if (!listo || !visible || document.hidden) return;
      const s = costura.current;
      if (s !== ultimaCostura) {
        colocarCostura(s);
        ultimaCostura = s;
        sucio = true;
      }
      const brillo = resaltar.current ? 1.7 : 1;
      if (Math.abs(comunes.uBrillo.value - brillo) > 0.01) {
        comunes.uBrillo.value += (brillo - comunes.uBrillo.value) * Math.min(1, dt * 8);
        sucio = true;
      }
      if (animado()) {
        reloj += dt;
        tierra.rotation.y += vueltaTierra * dt;
        luna.rotation.y += vueltaLuna * dt;
        giro.x += (objetivo.x - giro.x) * Math.min(1, dt * 2.5);
        giro.y += (objetivo.y - giro.y) * Math.min(1, dt * 2.5);
        matCielo.uniforms.uTiempo.value = reloj;
        sucio = true;
      } else {
        giro = { x: 0, y: 0 };
      }
      if (!sucio) return;
      colocarCamara();
      renderer.render(escena, camara);
      sucio = false;
    }

    const observador = new ResizeObserver(ajustar);
    observador.observe(lienzo);
    if (disco.current) observador.observe(disco.current);
    const vista = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sucio = true;
    });
    vista.observe(lienzo);
    window.addEventListener("resize", ajustar);
    window.addEventListener("pointermove", alMover, { passive: true });
    const alCambiarMovimiento = () => (sucio = true);
    quieto.addEventListener("change", alCambiarMovimiento);

    let vivo = true;
    Promise.all([
      textura("tierra_dia.webp", true),
      textura("tierra_noche.webp", true),
      textura("luna_color.webp", true),
      textura("luna_relieve.webp", false),
    ])
      .then(([dia, noche, color, relieve]) => {
        if (!vivo) {
          [dia, noche, color, relieve].forEach((t) => t.dispose());
          return;
        }
        matTierra.uniforms.uDia.value = dia;
        matTierra.uniforms.uNoche.value = noche;
        matLuna.uniforms.uColor.value = color;
        matLuna.uniforms.uRelieve.value = relieve;
        ajustar();
        colocarCamara();
        // Upload the textures and compile before the first visible frame.
        renderer.compile(escena, camara);
        renderer.render(escena, camara);
        listo = true;
        avisos.current.onListo(animado());
      })
      .catch(() => {
        if (vivo) avisos.current.onFallo();
      });
    raf = requestAnimationFrame(cuadro);

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      observador.disconnect();
      vista.disconnect();
      window.removeEventListener("resize", ajustar);
      window.removeEventListener("pointermove", alMover);
      quieto.removeEventListener("change", alCambiarMovimiento);
      for (const t of [
        matTierra.uniforms.uDia.value,
        matTierra.uniforms.uNoche.value,
        matLuna.uniforms.uColor.value,
        matLuna.uniforms.uRelieve.value,
      ])
        (t as THREE.Texture | null)?.dispose();
      [esfera, halo.geometry, haz.geometry, cielo].forEach((g) => g.dispose());
      [matTierra, matLuna, halo.material, matHaz, matCielo, matDestello].forEach((m) =>
        (m as THREE.Material).dispose(),
      );
      destello.dispose();
      renderer.dispose();
    };
  }, [disco, costura, resaltar]);

  return <canvas ref={lienzoRef} className="espacio-lienzo" aria-hidden="true" />;
}
