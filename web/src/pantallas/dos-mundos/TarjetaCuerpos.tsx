/**
 * Moon · Earth · Mars reference card (000-entrega-hoy, E4).
 *
 * Published constants only, each with its NASA source next to it. The shadow and the fuzzy tip are the
 * same geometry for the three bodies (F14, F19); what changes is the size of the Sun seen from each one
 * and, on Earth, the refraction of the air (F15). Mars has no terrain analysis in this version.
 */
import { useLanguage } from "../../i18n/Language";
import { penumbraM, refraccionDeg } from "../../datos/laboratorio";

const FICHA_PLANETAS = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/";
const FICHA_LUNA = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html";
const FICHA_SOL = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html";

/** NASA Planetary Fact Sheet (metric), copied with the precision it is published with. */
const CUERPOS = {
  luna: { gravedad: 1.6, dia_h: 708.7, oblicuidad_deg: 6.7, sol_1e6km: 149.6 },
  tierra: { gravedad: 9.8, dia_h: 24.0, oblicuidad_deg: 23.4, sol_1e6km: 149.6 },
  marte: { gravedad: 3.7, dia_h: 24.7, oblicuidad_deg: 25.2, sol_1e6km: 228.0 },
} as const;
/** The Moon orbits Earth: its distance from the Sun is Earth's (the fact sheet lists 0.384 × 10⁶ km to Earth). */
/** Moon Fact Sheet: equatorial inclination to the ecliptic. This, not the 6.7°, keeps the polar Sun low. */
const LUNA_ECUADOR_ECLIPTICA_DEG = 1.54;
/** Sun Fact Sheet: volumetric mean radius. */
const RADIO_SOL_KM = 695700;

const RAD = Math.PI / 180;
const radioAparente = (millonesKm: number) => Math.atan(RADIO_SOL_KM / (millonesKm * 1e6)) / RAD;

export default function TarjetaCuerpos({
  altura,
  elevacion,
  radioSolDeg,
}: {
  altura: number;
  elevacion: number;
  /** Angular radius of the Sun used by the engine for the Moon and Earth (parametros). */
  radioSolDeg: number;
}) {
  const { t, language } = useLanguage();
  const num = (v: number, d = 1) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const sombra = (el: number) => altura / Math.tan(el * RAD);
  const rhoMarte = radioAparente(CUERPOS.marte.sol_1e6km);
  const refr = refraccionDeg(elevacion);
  const orden = ["luna", "tierra", "marte"] as const;
  const nombres = { luna: t("Moon", "Luna"), tierra: t("Earth", "Tierra"), marte: t("Mars", "Marte") };
  const fuente = (href: string, texto: string) => (
    <a href={href} target="_blank" rel="noreferrer">
      {texto}
    </a>
  );
  const filas: { id: string; nombre: string; valores: string[]; fuente: JSX.Element | string }[] = [
    {
      id: "inclinacion",
      nombre: t("Axial tilt to its orbit", "Inclinación del eje respecto de su órbita"),
      valores: orden.map((c) => `${num(CUERPOS[c].oblicuidad_deg)}°`),
      fuente: fuente(FICHA_PLANETAS, "NASA Planetary Fact Sheet"),
    },
    {
      id: "dia",
      nombre: t("Length of the solar day", "Duración del día solar"),
      valores: orden.map((c) => `${num(CUERPOS[c].dia_h)} h`),
      fuente: fuente(FICHA_PLANETAS, "NASA Planetary Fact Sheet"),
    },
    {
      id: "gravedad",
      nombre: t("Surface gravity", "Gravedad en la superficie"),
      valores: orden.map((c) => `${num(CUERPOS[c].gravedad)} m/s²`),
      fuente: fuente(FICHA_PLANETAS, "NASA Planetary Fact Sheet"),
    },
    {
      id: "sol",
      nombre: t("Apparent size of the Sun", "Tamaño aparente del Sol"),
      valores: orden.map((c) => `${num(2 * radioAparente(CUERPOS[c].sol_1e6km), 2)}°`),
      fuente: (
        <>
          2·atan(R☉ ÷ d) · {fuente(FICHA_SOL, "Sun Fact Sheet")} · {fuente(FICHA_PLANETAS, "Planetary Fact Sheet")}
        </>
      ),
    },
    {
      id: "sombra",
      nombre: t(
        `Shadow of h = ${num(altura, 2)} m at ${num(elevacion)}°`,
        `Sombra de h = ${num(altura, 2)} m a ${num(elevacion)}°`,
      ),
      valores: [
        `${num(sombra(elevacion), 2)} m`,
        `${num(sombra(elevacion + refr), 2)} m`,
        `${num(sombra(elevacion), 2)} m*`,
      ],
      fuente: t("F14 h ÷ tan(e) · F15 refraction on Earth", "F14 h ÷ tan(e) · F15 refracción en la Tierra"),
    },
    {
      id: "penumbra",
      nombre: t("Fuzzy tip of that shadow", "Punta difusa de esa sombra"),
      valores: [
        `${num(penumbraM(altura, elevacion, radioSolDeg), 2)} m`,
        `${num(penumbraM(altura, elevacion, radioSolDeg), 2)} m`,
        `${num(penumbraM(altura, elevacion, rhoMarte), 2)} m`,
      ],
      fuente: t("F19 with the Sun size of each body", "F19 con el tamaño del Sol de cada cuerpo"),
    },
  ];

  return (
    <section className="panel tarjeta-cuerpos" aria-labelledby="tarjeta-cuerpos-titulo">
      <h2 id="tarjeta-cuerpos-titulo">
        {t("Moon · Earth · Mars: one shadow rule, three skies", "Luna · Tierra · Marte: una regla de sombra, tres cielos")}
      </h2>
      <p>
        <strong>
          {t(
            "Reference values, with no Martian terrain analysis in this version.",
            "Valores de referencia, sin análisis de terreno marciano en esta versión.",
          )}
        </strong>{" "}
        {t(
          "The geometry is the same on the three bodies. From Mars the Sun looks smaller, so the fuzzy tip of a shadow is shorter.",
          "La geometría es la misma en los tres cuerpos. Desde Marte el Sol se ve más chico, así que la punta difusa de la sombra es más corta.",
        )}
      </p>
      <div className="tabla-scroll">
        <table className="tabla-comparar">
          <caption className="sr-only">
            {t("Published constants of the Moon, Earth and Mars", "Constantes publicadas de la Luna, la Tierra y Marte")}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("Quantity", "Magnitud")}</th>
              {orden.map((c) => (
                <th scope="col" key={c}>
                  {nombres[c]}
                </th>
              ))}
              <th scope="col">{t("Source", "Fuente")}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} data-fila={f.id}>
                <th scope="row">{f.nombre}</th>
                {f.valores.map((v, k) => (
                  <td className="mono" key={k}>
                    {v}
                  </td>
                ))}
                <td className="muted">{f.fuente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mono">
        * {t("Refraction not modelled for the thin Martian air.", "Refracción no modelada para el aire tenue de Marte.")}{" "}
        {t(
          `The Moon's 6.7° is measured against its orbit around Earth; its equator is only ${num(LUNA_ECUADOR_ECLIPTICA_DEG, 2)}° from the plane of Earth's orbit around the Sun, which is why the Sun never climbs high at its poles`,
          `Los 6,7° de la Luna se miden respecto de su órbita alrededor de la Tierra; su ecuador está a solo ${num(LUNA_ECUADOR_ECLIPTICA_DEG, 2)}° del plano de la órbita terrestre alrededor del Sol, por eso el Sol nunca sube alto en sus polos`,
        )}{" "}
        ({fuente(FICHA_LUNA, "Moon Fact Sheet")}).
      </p>
    </section>
  );
}
