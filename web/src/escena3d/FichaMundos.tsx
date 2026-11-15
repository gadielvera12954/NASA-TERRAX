/**
 * Moon · Earth · Mars side by side: published constants (NASA NSSDCA fact sheets) and the same
 * shadow experiment computed for each world at the current Sun elevation.
 * Uses the atlas' existing comparison table styles (`tabla-scroll`, `tabla-comparar`).
 */
import { useLanguage } from "../i18n/Language";
import { CONSTANTES, diametroSolDeg, FUENTES, horizonteKm, Mundo, NOMBRES, penumbraM, sombraM } from "./mundos";

const ORDEN: Mundo[] = ["luna", "tierra", "marte"];

export default function FichaMundos({ elevacion, alturaM = 0.5 }: { elevacion: number; alturaM?: number }) {
  const { t, language } = useLanguage();
  const n = (v: number | null, d: number) =>
    v === null ? t("no shadow", "sin sombra") : v.toLocaleString(language, { maximumFractionDigits: d, minimumFractionDigits: d });
  const filas: { etiqueta: string; valor: (m: Mundo) => string }[] = [
    { etiqueta: t("Relief shown in 3D", "Relieve del 3D"), valor: (m) => `${t(NOMBRES[m].sitioEn, NOMBRES[m].sitioEs)} · ${NOMBRES[m].dem}` },
    { etiqueta: t("Surface gravity", "Gravedad en superficie"), valor: (m) => `${n(CONSTANTES[m].gravedad, 2)} m/s²` },
    {
      etiqueta: t("Solar day", "Día solar"),
      valor: (m) => (m === "luna" ? `${n(CONSTANTES[m].diaSolarH / 24, 1)} d` : `${n(CONSTANTES[m].diaSolarH, 2)} h`),
    },
    { etiqueta: t("Equator tilt (how high a polar Sun can climb)", "Inclinación del ecuador (cuánto sube el Sol polar)"), valor: (m) => `${n(CONSTANTES[m].inclinacionDeg, 2)}°` },
    {
      etiqueta: t("Air at the surface", "Aire en la superficie"),
      valor: (m) => (CONSTANTES[m].presionHpa === 0 ? t("none (exosphere)", "ninguno (exosfera)") : `${n(CONSTANTES[m].presionHpa, 2)} hPa`),
    },
    { etiqueta: t("Sunlight above the air", "Luz solar sobre el aire"), valor: (m) => `${n(CONSTANTES[m].irradianciaWm2, 0)} W/m²` },
    { etiqueta: t("Apparent size of the Sun", "Tamaño aparente del Sol"), valor: (m) => `${n(diametroSolDeg(m), 2)}°` },
    { etiqueta: t("Horizon for a 1.8 m person", "Horizonte para una persona de 1,8 m"), valor: (m) => `${n(horizonteKm(m), 1)} km` },
    {
      etiqueta: t(`Shadow of a ${alturaM} m board, Sun at ${elevacion.toFixed(1)}°`, `Sombra de una tablita de ${alturaM} m, Sol a ${elevacion.toFixed(1)}°`),
      valor: () => `${n(sombraM(alturaM, elevacion), 2)} m`,
    },
    {
      etiqueta: t("Its fuzzy tip (penumbra from the Sun's size)", "Su punta difusa (penumbra por el tamaño del Sol)"),
      valor: (m) => `${n(penumbraM(alturaM, elevacion, m), 2)} m`,
    },
  ];
  return (
    <section className="ficha-mundos" aria-labelledby="ficha-mundos-titulo">
      <h3 id="ficha-mundos-titulo">{t("Moon, Earth and Mars, side by side", "Luna, Tierra y Marte, lado a lado")}</h3>
      <p className="muted">
        {t(
          "Same geometry everywhere: the shadow length depends only on the Sun's elevation. What changes is the Sun's size (the fuzzy tip), the air (sky light that greys the shadows, refraction on Earth) and gravity. Constants from the NASA NSSDCA fact sheets; the last three rows are computed from them.",
          "La geometría es la misma en todas partes: el largo de la sombra depende solo de la elevación del Sol. Lo que cambia es el tamaño del Sol (la punta difusa), el aire (luz del cielo que aclara las sombras, refracción en la Tierra) y la gravedad. Constantes de las fichas NSSDCA de la NASA; las últimas tres filas se calculan con ellas.",
        )}
      </p>
      <div className="tabla-scroll">
        <table className="tabla-comparar">
          <thead>
            <tr>
              <th>{t("Property", "Propiedad")}</th>
              {ORDEN.map((m) => (
                <th key={m}>
                  <a href={FUENTES[m]} target="_blank" rel="noreferrer">
                    {t(NOMBRES[m].en, NOMBRES[m].es)}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.etiqueta}>
                <th scope="row">{f.etiqueta}</th>
                {ORDEN.map((m) => (
                  <td key={m} className="mono">
                    {f.valor(m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
