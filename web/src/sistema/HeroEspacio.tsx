import {
  lazy,
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronsLeftRight } from "lucide-react";
import { useLanguage } from "../i18n/Language";
import { CONSTANTES, FUENTES } from "../escena3d/mundos";
import "./inicio.css";

// three.js and the NASA imagery load after the page is usable; the copy never waits for them.
const PlanetaDividido = lazy(() => import("./PlanetaDividido"));

/** Same value as RADIO_DISCO in PlanetaDividido (kept here so the 3D module stays lazy). */
const RADIO = 0.43;
/** Same as ROTACION_* and VUELTA_TIERRA_S in PlanetaDividido (NSSDCA sidereal periods). */
const VUELTA_LUNA_MIN = (60 * (655.72 / 23.9345)) / 60;
const LIMITE = 0.94;

type Estado = "cargando" | "listo" | "sin3d";

export default function HeroEspacio({ children }: { children: ReactNode }) {
  const { t, language } = useLanguage();
  const disco = useRef<HTMLDivElement>(null);
  const costuraRef = useRef(0);
  const resaltar = useRef(false);
  const arrastrando = useRef(false);
  const intro = useRef(0);
  const [costura, setCostura] = useState(0);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [montar3d, setMontar3d] = useState(false);

  const mover = useCallback((s: number) => {
    const v = Math.max(-LIMITE, Math.min(LIMITE, s));
    costuraRef.current = v;
    setCostura(v);
  }, []);
  const pararIntro = () => cancelAnimationFrame(intro.current);

  useEffect(() => {
    const ric = window.requestIdleCallback;
    if (ric) {
      const id = ric(() => setMontar3d(true), { timeout: 900 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setMontar3d(true), 150);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => pararIntro, []);

  const onListo = useCallback(
    (animado: boolean) => {
      setEstado("listo");
      if (!animado || arrastrando.current) return;
      // Opening move: the Moon slides in from the right until the globe is half and half.
      const inicio = performance.now();
      const desde = 0.9;
      const paso = (ahora: number) => {
        const k = Math.min(1, (ahora - inicio) / 1900);
        const e = 1 - Math.pow(1 - k, 4);
        mover(desde * (1 - e));
        if (k < 1) intro.current = requestAnimationFrame(paso);
      };
      intro.current = requestAnimationFrame(paso);
    },
    [mover],
  );
  const onFallo = useCallback(() => setEstado("sin3d"), []);

  function geometria() {
    const r = disco.current!.getBoundingClientRect();
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      radio: RADIO * Math.min(r.width, r.height),
    };
  }
  function desdePuntero(e: PointerEvent) {
    const { cx, radio } = geometria();
    mover((e.clientX - cx) / radio);
  }
  function dentro(e: PointerEvent) {
    const { cx, cy, radio } = geometria();
    return Math.hypot(e.clientX - cx, e.clientY - cy) <= radio * 1.04;
  }
  function alPresionar(e: PointerEvent<HTMLDivElement>) {
    const enMando = (e.target as HTMLElement).closest(".costura-mando");
    if (!enMando && !dentro(e)) return;
    pararIntro();
    arrastrando.current = true;
    resaltar.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!enMando) desdePuntero(e);
  }
  function alMover(e: PointerEvent<HTMLDivElement>) {
    if (arrastrando.current) return desdePuntero(e);
    resaltar.current = dentro(e);
    e.currentTarget.style.cursor = resaltar.current ? "ew-resize" : "";
  }
  function alSoltar() {
    arrastrando.current = false;
  }
  function alTeclado(e: KeyboardEvent) {
    const pasos: Record<string, number> = {
      ArrowLeft: -0.05,
      ArrowDown: -0.05,
      ArrowRight: 0.05,
      ArrowUp: 0.05,
      PageDown: -0.25,
      PageUp: 0.25,
    };
    let s: number | null = null;
    if (e.key in pasos) s = costuraRef.current + pasos[e.key];
    else if (e.key === "Home") s = -LIMITE;
    else if (e.key === "End") s = LIMITE;
    if (s === null) return;
    e.preventDefault();
    pararIntro();
    mover(s);
  }

  const tierraPct = Math.round(((costura + 1) / 2) * 100);
  const loc = language === "es" ? "es" : "en";
  const num = (v: number, d = 0) =>
    v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const razon = (luna: number, tierra: number) => `${num(luna / tierra, 2)}×`;
  const T = CONSTANTES.tierra;
  const L = CONSTANTES.luna;

  return (
    <div className={`espacio ${estado}`}>
      <div className="espacio-fondo" aria-hidden="true">
        {montar3d && estado !== "sin3d" && (
          <Suspense fallback={null}>
            <PlanetaDividido
              disco={disco}
              costura={costuraRef}
              resaltar={resaltar}
              onListo={onListo}
              onFallo={onFallo}
            />
          </Suspense>
        )}
      </div>
      <section className="atlas-hero">
        {children}
        <div className="planeta-ancla">
          <div
            ref={disco}
            className={`planeta-disco ${estado}`}
            style={{ "--costura": costura } as CSSProperties}
            onPointerDown={alPresionar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onPointerLeave={() => {
              if (!arrastrando.current) resaltar.current = false;
            }}
          >
            <div className="disco-estatico" aria-hidden="true">
              <span className="mitad tierra" />
              <span className="mitad luna" />
              <span className="sombra" />
            </div>
            <div
              className="costura-mando"
              role="slider"
              tabIndex={0}
              aria-label={t("Earth and Moon divider", "Divisor entre la Tierra y la Luna")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={tierraPct}
              aria-valuetext={t(
                `${tierraPct}% Earth, ${100 - tierraPct}% Moon`,
                `${tierraPct}% Tierra, ${100 - tierraPct}% Luna`,
              )}
              onKeyDown={alTeclado}
              onFocus={() => (resaltar.current = true)}
              onBlur={() => (resaltar.current = false)}
            >
              <ChevronsLeftRight size={18} aria-hidden="true" />
            </div>
          </div>
          <div className="dato-mundo tierra">
            <p className="nombre">
              <strong>{t("Earth", "Tierra")}</strong>
              <span>{t("Where we rehearse", "Donde ensayamos")}</span>
            </p>
            <dl>
            <div>
              <dt>{t("Radius", "Radio")}</dt>
              <dd>{num(T.radioKm)} km</dd>
            </div>
            <div>
              <dt>{t("Gravity", "Gravedad")}</dt>
              <dd>{num(T.gravedad, 2)} m/s²</dd>
            </div>
            <div>
              <dt>{t("Solar day", "Día solar")}</dt>
              <dd>{num(T.diaSolarH)} h</dd>
            </div>
            <div>
              <dt>{t("Axial tilt", "Inclinación")}</dt>
              <dd>{num(T.inclinacionDeg, 2)}°</dd>
            </div>
            <div>
              <dt>{t("Air", "Aire")}</dt>
              <dd>{num(T.presionHpa)} hPa</dd>
            </div>
            </dl>
          </div>
          <div className="dato-mundo luna">
            <p className="nombre">
              <strong>{t("Moon", "Luna")}</strong>
              <span>{t("The base we rehearse for", "La base para la que ensayamos")}</span>
            </p>
            <dl>
            <div>
              <dt>{t("Radius", "Radio")}</dt>
              <dd>
                {num(L.radioKm, 1)} km <small>{razon(L.radioKm, T.radioKm)}</small>
              </dd>
            </div>
            <div>
              <dt>{t("Gravity", "Gravedad")}</dt>
              <dd>
                {num(L.gravedad, 2)} m/s² <small>{razon(L.gravedad, T.gravedad)}</small>
              </dd>
            </div>
            <div>
              <dt>{t("Solar day", "Día solar")}</dt>
              <dd>
                {num(L.diaSolarH, 1)} h <small>{razon(L.diaSolarH, T.diaSolarH)}</small>
              </dd>
            </div>
            <div>
              <dt>{t("Axial tilt", "Inclinación")}</dt>
              <dd>{num(L.inclinacionDeg, 2)}°</dd>
            </div>
            <div>
              <dt>{t("Air", "Aire")}</dt>
              <dd>{t("none (exosphere)", "no tiene (exosfera)")}</dd>
            </div>
            </dl>
          </div>
        </div>
      </section>
      <p className="espacio-creditos">
        <span>
          {t(
            `Drag the divider. Tilts and spin to scale: the Earth turns once every 60 s, the Moon once every ${num(VUELTA_LUNA_MIN)} min.`,
            `Arrastra el divisor. Inclinación y giro a escala: la Tierra da una vuelta cada 60 s; la Luna, cada ${num(VUELTA_LUNA_MIN)} min.`,
          )}
        </span>
        <span>
          {t("Imagery", "Imágenes")}: NASA Blue Marble · Black Marble · LRO LROC · LOLA.{" "}
          {t("Constants", "Constantes")}:{" "}
          <a href={FUENTES.tierra} target="_blank" rel="noreferrer">
            NSSDCA {t("Earth", "Tierra")}
          </a>{" "}
          ·{" "}
          <a href={FUENTES.luna} target="_blank" rel="noreferrer">
            NSSDCA {t("Moon", "Luna")}
          </a>
        </span>
      </p>
    </div>
  );
}
