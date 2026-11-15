import { lazy, ReactNode, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useLanguage } from "../i18n/Language";
import { CONSTANTES, FUENTES, Mundo } from "../escena3d/mundos";
import { aPixeles, CUERPOS, encuadre, ROTACION_H, VUELTA_TIERRA_S } from "./tresMundos";
import "./inicio.css";

// three.js and the NASA/USGS imagery load after the page is usable; the copy never waits for them.
const TresMundos3D = lazy(() => import("./TresMundos3D"));

type Estado = "cargando" | "listo" | "sin3d";
const ORDEN: Mundo[] = ["tierra", "luna", "marte"];

export default function HeroEspacio({ children }: { children: ReactNode }) {
  const { t, language } = useLanguage();
  const escenario = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [montar3d, setMontar3d] = useState(false);
  const [foco, setFoco] = useState<Mundo>("luna");
  const [caja, setCaja] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const ric = window.requestIdleCallback;
    if (ric) {
      const id = ric(() => setMontar3d(true), { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setMontar3d(true), 200);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    const el = escenario.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setCaja({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const onListo = useCallback(() => setEstado("listo"), []);
  const onFallo = useCallback(() => setEstado("sin3d"), []);

  const loc = language === "es" ? "es" : "en";
  const num = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const nombre: Record<Mundo, string> = { tierra: t("Earth", "Tierra"), luna: t("Moon", "Luna"), marte: t("Mars", "Marte") };
  const papel: Record<Mundo, string> = {
    tierra: t("Where we rehearse", "Donde ensayamos"),
    luna: t("Where the base goes", "Donde va la base"),
    marte: t("The next step", "El paso siguiente"),
  };
  const T = CONSTANTES.tierra;
  const razon = (m: Mundo, v: number, ref: number) => (m === "tierra" ? "" : `${num(v / ref, 2)}×`);
  const filas: { k: string; v: (m: Mundo) => string; r?: (m: Mundo) => string }[] = [
    { k: t("Radius", "Radio"), v: (m) => `${num(CONSTANTES[m].radioKm)} km`, r: (m) => razon(m, CONSTANTES[m].radioKm, T.radioKm) },
    { k: t("Gravity", "Gravedad"), v: (m) => `${num(CONSTANTES[m].gravedad, 2)} m/s²`, r: (m) => razon(m, CONSTANTES[m].gravedad, T.gravedad) },
    { k: t("Solar day", "Día solar"), v: (m) => `${num(CONSTANTES[m].diaSolarH, m === "luna" ? 0 : 1)} h` },
    { k: t("Axial tilt", "Inclinación"), v: (m) => `${num(CONSTANTES[m].inclinacionDeg, 2)}°` },
    { k: t("Air pressure", "Presión del aire"), v: (m) => (m === "luna" ? t("none", "nula") : `${num(CONSTANTES[m].presionHpa, m === "marte" ? 2 : 0)} hPa`) },
    { k: t("Sunlight", "Luz solar"), v: (m) => `${num(CONSTANTES[m].irradianciaWm2)} W/m²`, r: (m) => razon(m, CONSTANTES[m].irradianciaWm2, T.irradianciaWm2) },
  ];
  const enc = caja.w > 0 ? encuadre(caja.w, caja.h) : null;
  const vueltaMarteS = VUELTA_TIERRA_S * (ROTACION_H.marte / ROTACION_H.tierra);
  const vueltaLunaMin = (VUELTA_TIERRA_S * (ROTACION_H.luna / ROTACION_H.tierra)) / 60;

  return (
    <div className={`espacio ${estado}`}>
      <div className="espacio-fondo" aria-hidden="true" />
      <section className="atlas-hero">
        {children}
        <div className="mundos">
          <div className="mundos-escenario" ref={escenario}>
            {montar3d && estado !== "sin3d" && (
              <Suspense fallback={null}>
                <TresMundos3D foco={foco} onListo={onListo} onFallo={onFallo} />
              </Suspense>
            )}
            {enc &&
              CUERPOS.map((c, i) => {
                const p = aPixeles(c, enc);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`mundo-boton ${c.id}`}
                    aria-pressed={foco === c.id}
                    onClick={() => setFoco(c.id)}
                    onMouseEnter={() => setFoco(c.id)}
                    onFocus={() => setFoco(c.id)}
                    style={{ "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}px`, "--i": i } as CSSProperties}
                  >
                    <span className="mundo-disco" aria-hidden="true" />
                    <span className="mundo-anillo" aria-hidden="true" />
                    <span className="mundo-rotulo">
                      <strong>{nombre[c.id]}</strong>
                      <small>{papel[c.id]}</small>
                    </span>
                  </button>
                );
              })}
          </div>
          <table className="mundos-tabla">
            <caption className="sr-only">
              {t("Earth, Moon and Mars compared (NASA NSSDCA fact sheets)", "Tierra, Luna y Marte comparados (fichas NSSDCA de la NASA)")}
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t("Property", "Propiedad")}</span>
                </th>
                {ORDEN.map((m) => (
                  <th key={m} scope="col" className={m} data-foco={foco === m || undefined}>
                    <button type="button" onClick={() => setFoco(m)} aria-pressed={foco === m}>
                      <i aria-hidden="true" />
                      {nombre[m]}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.k}>
                  <th scope="row">{f.k}</th>
                  {ORDEN.map((m) => (
                    <td key={m} data-foco={foco === m || undefined}>
                      {f.v(m)}
                      {f.r && f.r(m) && <small>{f.r(m)}</small>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="espacio-creditos">
        <span>
          {t(
            `True relative sizes, tilts and spin: the Earth turns once every ${VUELTA_TIERRA_S} s, Mars every ${num(vueltaMarteS, 1)} s, the Moon every ${num(vueltaLunaMin)} min. One low Sun lights all three.`,
            `Tamaños relativos, inclinaciones y giro a escala: la Tierra da una vuelta cada ${VUELTA_TIERRA_S} s, Marte cada ${num(vueltaMarteS, 1)} s y la Luna cada ${num(vueltaLunaMin)} min. Un mismo Sol bajo ilumina a los tres.`,
          )}
        </span>
        <span>
          {t("Imagery", "Imágenes")}: NASA Blue Marble · Black Marble · LRO LROC · LOLA · USGS Viking MDIM.{" "}
          {t("Constants", "Constantes")}:{" "}
          {ORDEN.map((m, i) => (
            <span key={m}>
              {i > 0 && " · "}
              <a href={FUENTES[m]} target="_blank" rel="noreferrer">
                NSSDCA {nombre[m]}
              </a>
            </span>
          ))}
        </span>
      </p>
    </div>
  );
}
