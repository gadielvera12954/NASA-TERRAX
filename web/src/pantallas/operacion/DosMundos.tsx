/**
 * Earth / Moon comparison in 3D: one stage, one curtain, live readouts.
 * Each readout names its formula; anything that is not physics is labelled as illustration.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/Language";
import { useSol } from "../../luz/SolContext";
import { IndiceLab, leerIndiceLab, leerSerieSol, penumbraM, potenciaPaneles, refraccionDeg } from "../../datos/laboratorio";

const DosMundos3D = lazy(() => import("../../escena3d/DosMundos3D"));

/** Surface gravity, m/s² (NASA NSSDCA Moon Fact Sheet: Moon 1.62, Earth 9.80). */
const G = { luna: 1.62, tierra: 9.8 };
const MASTIL_M = 2.5; // public VIPER height
const RAD = Math.PI / 180;

export default function DosMundos({ minutosTierra }: { minutosTierra: number | null }) {
  const { t, language } = useLanguage();
  const sol = useSol();
  const [corte, setCorte] = useState(50);
  const [rumbo, setRumbo] = useState(() => (sol.azimut - 45 + 360) % 360);
  const [esquina, setEsquina] = useState(true);
  const [caida, setCaida] = useState(0);
  const [tiempos, setTiempos] = useState<{ luna: number | null; tierra: number | null } | null>(null);
  const [idx, setIdx] = useState<IndiceLab>();
  const [horasLuna, setHorasLuna] = useState<number | null>(null);
  const animar = useMemo(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    leerIndiceLab().then(setIdx).catch(() => {});
    // Hours of one real lunation with the Sun inside the rehearsal band (1.5° to 7°).
    leerSerieSol("verano")
      .then((s) => {
        let h = 0;
        for (let i = s.i0; i < s.i1; i++) if (s.elevacion_deg[i] >= 1.5 && s.elevacion_deg[i] <= 7) h += s.paso_s / 3600;
        setHorasLuna(h);
      })
      .catch(() => {});
  }, []);

  const e = sol.elevacion;
  const rumboReal = esquina ? (sol.azimut - 45 + 360) % 360 : rumbo;
  const lados = idx?.vehiculo.lados_deg ?? [0, 90, 180];
  const panelW = idx?.vehiculo.panel_w ?? 320;
  const rho = idx?.radio_angular_sol_deg ?? 0.267;
  const watts = potenciaPaneles(e, sol.azimut, rumboReal, lados, panelW, 1);
  const potencia: Record<number, number> = {};
  lados.forEach((l, k) => (potencia[l] = watts[k]));
  const total = watts.reduce((a, b) => a + b, 0);
  const sombra = (h: number, el: number) => h / Math.tan(el * RAD);
  const refr = refraccionDeg(e);
  const num = (v: number, d = 1) => new Intl.NumberFormat(language, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const nombresPanel = [t("Front", "Frontal"), t("Right", "Derecho"), t("Rear", "Trasero")];
  const tCaida = (g: number) => Math.sqrt((2 * MASTIL_M) / g);

  return (
    <>
      <a href="#card">← {t("Back to candidate card", "Volver a la ficha")}</a>
      <p className="lead">
        {t(
          "The same rover and the same 0.50 m board, under the same Sun angle, on both sides of the curtain. The geometry transfers; the readouts below show what does not.",
          "El mismo rover y la misma tablita de 0,50 m, bajo el mismo ángulo de Sol, a ambos lados de la cortina. La geometría se transfiere; las lecturas de abajo muestran qué no.",
        )}
      </p>
      <div className="comparison mundos">
        <Suspense fallback={<div className="escena escena-mundos cargando">{t("Loading the 3D stage…", "Cargando el escenario 3D…")}</div>}>
          <DosMundos3D
            elevacion={e}
            azimut={sol.azimut}
            rumbo={rumboReal}
            corte={corte}
            potencia={potencia}
            panelW={panelW}
            caida={caida}
            alturaCaida={MASTIL_M}
            gLuna={G.luna}
            gTierra={G.tierra}
            animar={animar}
            onCaida={setTiempos}
            textoAcercar={t("Zoom in", "Acercar")}
            textoAlejar={t("Zoom out", "Alejar")}
            etiqueta={t(
              "3D stage: a solar rover and a calibration board lit by a low Sun, Moon on the left of the divider and Earth on the right",
              "Escenario 3D: un rover solar y una tablita de calibración iluminados por un Sol bajo, la Luna a la izquierda del divisor y la Tierra a la derecha",
            )}
          />
        </Suspense>
        <div className="moon-layer" style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }} aria-hidden="true" />
        <div className="curtain" style={{ left: `${corte}%` }} aria-hidden="true" />
        <span className="world-label moon-label">{t("Moon", "Luna")}</span>
        <span className="world-label earth-label">{t("Earth", "Tierra")}</span>
      </div>
      <p className="muted">
        {t(
          "Rover and board modelled in Blender from public figures (generic shape, not an official model). Flat illustrative ground and sky colours; drag to orbit.",
          "Rover y tablita modelados en Blender con cifras públicas (forma genérica, no es un modelo oficial). Suelo plano y colores de cielo ilustrativos; arrastra para girar.",
        )}
      </p>

      <div className="mandos">
        <div>
          <label htmlFor="curtain">{t("Comparison divider", "Divisor de comparación")}</label>
          <input id="curtain" type="range" min="5" max="95" value={corte} onChange={(ev) => setCorte(Number(ev.target.value))} />
        </div>
        <div>
          <label htmlFor="mundos-el">
            {t("Sun elevation", "Altura del Sol")}: <strong>{num(e)}°</strong>
          </label>
          <input id="mundos-el" type="range" min="1.5" max="10" step="0.5" value={e} onChange={(ev) => sol.setElevacion(Number(ev.target.value))} />
        </div>
        <div>
          <label htmlFor="mundos-az">
            {t("Sun direction", "Dirección del Sol")}: <strong>{num(sol.azimut, 0)}°</strong>
          </label>
          <input id="mundos-az" type="range" min="0" max="359" step="1" value={sol.azimut} onChange={(ev) => sol.setAzimut(Number(ev.target.value))} />
        </div>
        <div>
          <label htmlFor="mundos-rumbo">
            {t("Rover heading", "Rumbo del rover")}: <strong>{num(rumboReal, 0)}°</strong>
          </label>
          <input
            id="mundos-rumbo"
            type="range"
            min="0"
            max="359"
            step="1"
            value={rumboReal}
            onChange={(ev) => {
              setEsquina(false);
              setRumbo(Number(ev.target.value));
            }}
          />
          <button className="btn sec chico" aria-pressed={esquina} onClick={() => setEsquina((v) => !v)}>
            {t("Keep the Sun on a corner", "Mantener el Sol en una esquina")}
          </button>
        </div>
      </div>

      <div className="lecturas">
        <section className="panel">
          <h2>{t("Shadow of the 0.50 m board", "Sombra de la tablita de 0,50 m")}</h2>
          <dl className="par">
            <div>
              <dt>{t("Moon", "Luna")}</dt>
              <dd>{num(sombra(0.5, e), 2)} m</dd>
            </div>
            <div>
              <dt>{t("Earth", "Tierra")}</dt>
              <dd>{num(sombra(0.5, e + refr), 2)} m</dd>
            </div>
          </dl>
          <p>
            {t(
              `Same rule on both: height ÷ tan(Sun elevation). On Earth the air bends the light and lifts the Sun ${num(refr, 2)}°, so the shadow is ${num(100 * (1 - sombra(0.5, e + refr) / sombra(0.5, e)), 1)} % shorter. The fuzzy tip is ${num(penumbraM(0.5, e, rho), 2)} m long in both worlds; on the Moon the shadow itself is black because no sky lights it.`,
              `La misma regla en ambos: altura ÷ tan(altura del Sol). En la Tierra el aire curva la luz y levanta el Sol ${num(refr, 2)}°, así que la sombra es ${num(100 * (1 - sombra(0.5, e + refr) / sombra(0.5, e)), 1)} % más corta. La punta difusa mide ${num(penumbraM(0.5, e, rho), 2)} m en los dos mundos; en la Luna la sombra es negra porque no hay cielo que la ilumine.`,
            )}
          </p>
          <p className="mono">F14 · F15 (Sæmundsson) · F19</p>
        </section>
        <section className="panel">
          <h2>{t("Power from the three panels", "Potencia de los tres paneles")}</h2>
          <dl className="par tres">
            {lados.map((l, k) => (
              <div key={l}>
                <dt>{nombresPanel[k] ?? `${l}°`}</dt>
                <dd>{num(watts[k], 0)} W</dd>
              </div>
            ))}
          </dl>
          <p>
            {t(
              `Moon: ${num(total, 0)} W in total. Turn the rover and watch the cells light up: with the Sun on a corner two panels work together (the published figure is 450 W). Earth: not modelled, because air and dust dim a low Sun; a field test cannot stand in for the lunar power budget.`,
              `Luna: ${num(total, 0)} W en total. Gira el rover y mira cómo se encienden las celdas: con el Sol en una esquina trabajan dos paneles a la vez (la cifra publicada es 450 W). Tierra: no se modela, porque el aire y el polvo atenúan un Sol bajo; un ensayo de campo no reemplaza el balance de energía lunar.`,
            )}
          </p>
          <p className="mono">F4 · {t("vertical panels, 320 W each", "paneles verticales, 320 W cada uno")}</p>
        </section>
        <section className="panel">
          <h2>{t("Gravity: drop test from 2.5 m", "Gravedad: caída desde 2,5 m")}</h2>
          <dl className="par">
            <div>
              <dt>{t("Moon", "Luna")}</dt>
              <dd>{tiempos?.luna != null ? `${num(tiempos.luna, 2)} s` : tiempos ? "…" : `${num(tCaida(G.luna), 2)} s`}</dd>
            </div>
            <div>
              <dt>{t("Earth", "Tierra")}</dt>
              <dd>{tiempos?.tierra != null ? `${num(tiempos.tierra, 2)} s` : tiempos ? "…" : `${num(tCaida(G.tierra), 2)} s`}</dd>
            </div>
          </dl>
          <button className="btn" onClick={() => setCaida((c) => c + 1)}>
            {t("Drop the ball in both worlds", "Soltar la bola en los dos mundos")}
          </button>
          <p>
            {t(
              "Time = √(2 × height ÷ gravity), without air. Wheels, dust and falling tools behave differently at one sixth of Earth's gravity: no place on Earth reproduces it.",
              "Tiempo = √(2 × altura ÷ gravedad), sin aire. Las ruedas, el polvo y las herramientas que caen se comportan distinto con un sexto de la gravedad terrestre: ningún lugar de la Tierra lo reproduce.",
            )}
          </p>
          <p className="mono">g = {num(G.luna, 2)} / {num(G.tierra, 2)} m/s² · NASA NSSDCA</p>
        </section>
        <section className="panel">
          <h2>{t("Time with a grazing Sun (1.5° to 7°)", "Tiempo con Sol rasante (1,5° a 7°)")}</h2>
          <dl className="par">
            <div>
              <dt>{t("Moon, one lunation", "Luna, una lunación")}</dt>
              <dd>{horasLuna === null ? "—" : `${num(horasLuna, 0)} h`}</dd>
            </div>
            <div>
              <dt>{t("Earth, each sunset", "Tierra, cada atardecer")}</dt>
              <dd>{minutosTierra === null ? "—" : `${num(minutosTierra, 0)} min`}</dd>
            </div>
          </dl>
          {horasLuna !== null && minutosTierra !== null && (
            <div className="barras-tiempo" aria-hidden="true">
              <i style={{ width: "100%" }} />
              <i className="tierra" style={{ width: `${Math.max(0.6, (100 * minutosTierra) / 60 / horasLuna)}%` }} />
            </div>
          )}
          <p>
            {t(
              "At Mons Mouton the Sun crawls along the horizon for days (summer lunation 2027, DE421). On Earth the same light lasts about half an hour per sunset, so a rehearsal is a race against the clock.",
              "En Mons Mouton el Sol se arrastra por el horizonte durante días (lunación de verano 2027, DE421). En la Tierra la misma luz dura cerca de media hora por atardecer: un ensayo es una carrera contra el reloj.",
            )}
          </p>
          <p className="mono">{t("Earth window: from the candidate card", "Ventana terrestre: de la ficha de la candidata")}</p>
        </section>
      </div>
    </>
  );
}
