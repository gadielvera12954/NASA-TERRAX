/**
 * Home hero in 3D: Earth, Mars and the Moon to scale, lit by one low Sun from the left.
 *
 * Built to stay light: one small canvas (only the hero's right column, not the whole page),
 * 64 × 48 spheres sharing one geometry, pixel budget capped near one megapixel, 30 frames per
 * second, and no frames at all while the hero is off screen, the tab is hidden or the visitor
 * asked for reduced motion (then a single still frame is drawn).
 *
 * Imagery (public domain) in /img/inicio:
 *   tierra_dia / tierra_noche  NASA Blue Marble NG (Dec 2004) and Black Marble 2016
 *   luna_color / luna_relieve  NASA SVS CGI Moon Kit (LRO LROC colour, LOLA elevation)
 *   marte_color               USGS Viking Orbiter colour mosaic 925 m (modelos/textura_marte.py)
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CONSTANTES, Mundo } from "../escena3d/mundos";
import { CUERPOS, encuadre, ROTACION_H, VUELTA_TIERRA_S } from "./tresMundos";

const IMG = "/img/inicio/";
const GRADO = Math.PI / 180;
/** One Sun for the three worlds: low and from the left, so every terminator is a grazing light. */
const SOL = new THREE.Vector3(-0.82, 0.22, 0.53).normalize();

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

const COMUN = /* glsl */ `
uniform vec3 uSol;
uniform float uFoco;
varying vec2 vUv;
varying vec3 vMundo;
varying vec3 vNormal;
// Orthographic camera: every view ray points straight at the screen.
const vec3 V = vec3(0.0, 0.0, 1.0);
`;

const FRAG_TIERRA = /* glsl */ `
uniform sampler2D uDia;
uniform sampler2D uNoche;
${COMUN}
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSol);
  float nl = dot(N, L);
  vec3 dia = texture2D(uDia, vUv).rgb;
  vec3 noche = texture2D(uNoche, vUv).rgb;
  float luz = clamp((nl + 0.12) / 1.12, 0.0, 1.0);
  vec3 col = dia * (0.012 + 1.25 * luz);
  vec3 s = sqrt(dia);
  float mar = smoothstep(0.05, 0.16, s.b - s.r);
  float nh = max(dot(N, normalize(L + V)), 0.0);
  col += vec3(1.0, 0.9, 0.75) * (pow(nh, 160.0) * 0.4 + pow(nh, 24.0) * 0.035) * mar * step(0.0, nl);
  float lum = dot(noche, vec3(0.3, 0.59, 0.11));
  float oscuro = smoothstep(0.06, -0.22, nl);
  col += (vec3(1.0, 0.74, 0.4) * smoothstep(0.12, 0.6, lum) * 1.6 + noche * 0.08) * oscuro;
  float f = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  float deDia = smoothstep(-0.3, 0.45, nl);
  vec3 aire = vec3(0.3, 0.58, 1.0);
  col = mix(col, aire * (0.15 + deDia), f * 0.6);
  col += aire * f * deDia * 0.3;
  col *= mix(0.8, 1.0, uFoco);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FRAG_LUNA = /* glsl */ `
uniform sampler2D uColor;
uniform sampler2D uRelieve;
uniform float uEscala;
${COMUN}
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
  vec2 dx = dFdx(vUv);
  vec2 dy = dFdy(vUv);
  float h = texture2D(uRelieve, vUv).r;
  vec2 dH = vec2(texture2D(uRelieve, vUv + dx).r - h, texture2D(uRelieve, vUv + dy).r - h) * uEscala;
  vec3 N = perturbar(vMundo, normalize(vNormal), dH);
  float nl = max(dot(N, normalize(uSol)), 0.0);
  vec3 col = texture2D(uColor, vUv).rgb * (0.006 + 1.4 * pow(nl, 0.85));
  col *= mix(0.8, 1.0, uFoco);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FRAG_MARTE = /* glsl */ `
uniform sampler2D uColor;
${COMUN}
void main() {
  vec3 N = normalize(vNormal);
  float nl = dot(N, normalize(uSol));
  vec3 albedo = texture2D(uColor, vUv).rgb;
  // Thin dusty air: a slightly soft terminator and a faint ochre haze on the lit limb.
  float luz = clamp((nl + 0.04) / 1.04, 0.0, 1.0);
  vec3 col = albedo * (0.008 + 1.3 * pow(luz, 0.9));
  float f = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.95, 0.6, 0.38) * f * smoothstep(-0.15, 0.5, nl) * 0.32;
  col *= mix(0.8, 1.0, uFoco);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const VERT_HALO = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vMundo;
void main() {
  vNormalV = normalize(normalMatrix * normal);
  vMundo = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FRAG_HALO = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vMundo;
uniform vec3 uSol;
uniform vec3 uCentro;
uniform vec3 uTono;
uniform float uFuerza;
uniform float uAncho;
void main() {
  float i = pow(clamp(-vNormalV.z / uAncho, 0.0, 1.0), 2.2);
  float sol = mix(0.12, 1.0, smoothstep(-0.4, 0.6, dot(normalize(vMundo - uCentro), normalize(uSol))));
  // The canvas is transparent over the page: the glow's coverage goes in alpha, so where it fades
  // out nothing is drawn (an opaque black fragment would leave a dark ring around the planet).
  float a = clamp(i * sol * uFuerza, 0.0, 1.0);
  gl_FragColor = vec4(uTono, a);
}`;

export interface Props {
  foco: Mundo;
  onListo: (animado: boolean) => void;
  onFallo: () => void;
}

export default function TresMundos3D({ foco, onListo, onFallo }: Props) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const focoRef = useRef(foco);
  focoRef.current = foco;
  const avisos = useRef({ onListo, onFallo });
  avisos.current = { onListo, onFallo };

  useEffect(() => {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      avisos.current.onFallo();
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    const software = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
    const quieto = matchMedia("(prefers-reduced-motion: reduce)");
    const animado = () => !software && !quieto.matches;

    const escena = new THREE.Scene();
    const camara = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    camara.position.set(0, 0, 10);

    const cargador = new THREE.TextureLoader();
    const anis = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const textura = (nombre: string, color: boolean) =>
      cargador.loadAsync(IMG + nombre).then((t) => {
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = anis;
        return t;
      });

    const esfera = new THREE.SphereGeometry(1, 64, 48);
    const halo = new THREE.SphereGeometry(1, 48, 32);
    const sol = { value: SOL.clone() };
    const mats: Record<Mundo, THREE.ShaderMaterial> = {
      tierra: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_TIERRA, uniforms: { uSol: sol, uFoco: { value: 1 }, uDia: { value: null }, uNoche: { value: null } } }),
      luna: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_LUNA, uniforms: { uSol: sol, uFoco: { value: 1 }, uColor: { value: null }, uRelieve: { value: null }, uEscala: { value: 3.0 } } }),
      marte: new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_MARTE, uniforms: { uSol: sol, uFoco: { value: 1 }, uColor: { value: null } } }),
    };
    const giros: Partial<Record<Mundo, THREE.Mesh>> = {};
    const halos: THREE.ShaderMaterial[] = [];
    for (const c of CUERPOS) {
      const eje = new THREE.Group();
      eje.position.set(c.x, c.y, 0);
      // Axial tilt rolled toward the left of the screen, as seen from the Sun's side.
      eje.rotation.z = CONSTANTES[c.id].inclinacionDeg * GRADO;
      const malla = new THREE.Mesh(esfera, mats[c.id]);
      malla.scale.setScalar(c.r);
      // Longitude λ faces the camera when rotation.y = −π/2 − λ: the Americas, Valles Marineris, near side.
      malla.rotation.y = c.id === "tierra" ? -Math.PI / 2 + 65 * GRADO : c.id === "marte" ? -Math.PI / 2 + 70 * GRADO : -Math.PI / 2;
      eje.add(malla);
      giros[c.id] = malla;
      escena.add(eje);
      if (c.id !== "luna") {
        const m = new THREE.ShaderMaterial({
          vertexShader: VERT_HALO,
          fragmentShader: FRAG_HALO,
          uniforms: {
            uSol: sol,
            uCentro: { value: new THREE.Vector3(c.x, c.y, 0) },
            uTono: { value: c.id === "tierra" ? new THREE.Color(0.32, 0.6, 1.0) : new THREE.Color(0.95, 0.55, 0.32) },
            uFuerza: { value: c.id === "tierra" ? 0.95 : 0.4 },
            uAncho: { value: c.id === "tierra" ? 0.42 : 0.3 },
          },
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        });
        const h = new THREE.Mesh(halo, m);
        h.position.set(c.x, c.y, 0);
        h.scale.setScalar(c.r * (c.id === "tierra" ? 1.1 : 1.06));
        escena.add(h);
        halos.push(m);
      }
    }

    let sucio = true;
    function ajustar() {
      const r = lienzo!.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      // Pixel budget: about one megapixel whatever the screen density.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(1.1e6 / (w * h)));
      renderer.setPixelRatio(software ? Math.min(dpr, 1) : dpr);
      renderer.setSize(w, h, false);
      const e = encuadre(w, h);
      camara.left = e.mx - w / 2 / e.s;
      camara.right = e.mx + w / 2 / e.s;
      camara.top = e.my + h / 2 / e.s;
      camara.bottom = e.my - h / 2 / e.s;
      camara.updateProjectionMatrix();
      sucio = true;
    }

    let listo = false;
    let visible = true;
    let raf = 0;
    let previo = performance.now();
    let acumulado = 0;
    const PASO = 1 / 30;
    const w0 = (Math.PI * 2) / VUELTA_TIERRA_S;

    function cuadro(ahora: number) {
      raf = requestAnimationFrame(cuadro);
      const dt = Math.min(0.1, (ahora - previo) / 1000);
      previo = ahora;
      if (!listo || !visible || document.hidden) return;
      // Focus: the chosen world at full brightness, the other two dimmed slightly.
      for (const c of CUERPOS) {
        const u = mats[c.id].uniforms.uFoco;
        const meta = focoRef.current === c.id ? 1 : 0;
        if (Math.abs(u.value - meta) > 0.005) {
          u.value += (meta - u.value) * Math.min(1, dt * 6);
          sucio = true;
        }
      }
      if (animado()) {
        acumulado += dt;
        if (acumulado < PASO) return;
        for (const c of CUERPOS) giros[c.id]!.rotation.y += w0 * (ROTACION_H.tierra / ROTACION_H[c.id]) * acumulado;
        acumulado = 0;
        sucio = true;
      }
      if (!sucio) return;
      renderer.render(escena, camara);
      sucio = false;
    }

    const obs = new ResizeObserver(ajustar);
    obs.observe(lienzo);
    const vista = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sucio = true;
    });
    vista.observe(lienzo);
    const alCambiar = () => (sucio = true);
    quieto.addEventListener("change", alCambiar);

    let vivo = true;
    Promise.all([
      textura("tierra_dia.webp", true),
      textura("tierra_noche.webp", true),
      textura("luna_color.webp", true),
      textura("luna_relieve.webp", false),
      textura("marte_color.webp", true),
    ])
      .then(([dia, noche, lunaColor, relieve, marteColor]) => {
        if (!vivo) {
          [dia, noche, lunaColor, relieve, marteColor].forEach((t) => t.dispose());
          return;
        }
        mats.tierra.uniforms.uDia.value = dia;
        mats.tierra.uniforms.uNoche.value = noche;
        mats.luna.uniforms.uColor.value = lunaColor;
        mats.luna.uniforms.uRelieve.value = relieve;
        mats.marte.uniforms.uColor.value = marteColor;
        ajustar();
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
      obs.disconnect();
      vista.disconnect();
      quieto.removeEventListener("change", alCambiar);
      for (const m of Object.values(mats)) {
        for (const u of Object.values(m.uniforms)) if (u.value instanceof THREE.Texture) u.value.dispose();
        m.dispose();
      }
      halos.forEach((m) => m.dispose());
      esfera.dispose();
      halo.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={lienzoRef} className="mundos-lienzo" aria-hidden="true" />;
}
