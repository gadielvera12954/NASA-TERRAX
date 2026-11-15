/**
 * Earth / Moon comparison in 3D: one stage, one curtain, live readouts.
 * Each readout names its formula; anything that is not physics is labelled as illustration.
 */
import { KeyboardEvent, lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/Language";
import { useSol } from "../../luz/SolContext";
import BotonSI from "../../luz/BotonSI";
import EscenarioCortina, { escribiendoEnCampo } from "../../luz/EscenarioCortina";
import TarjetaCuerpos from "../dos-mundos/TarjetaCuerpos";
import type { EstadoTerreno, ModoTerreno } from "../../escena3d/DosMundos3D";
import { NOMBRES, PARES, type Par } from "../../escena3d/mundos";
import {
  IndiceLab,
  leerIndiceLab,
  leerSerieSol,
  penumbraM,
  potenciaPaneles,
  refraccionDeg,
} from "../../datos/laboratorio";

const DosMundos3D = lazy(() => import("../../escena3d/DosMundos3D"));

/** Surface gravity, m/s² (NASA NSSDCA Moon Fact Sheet: Moon 1.62, Earth 9.80). */
const G = { luna: 1.62, tierra: 9.8 };
const MASTIL_M = 2.5; // public VIPER height
const RAD = Math.PI / 180;
const MIN_H = 0.05;
const MAX_H = 10;

export default function DosMundos({
  minutosTierra,
  site,
  mock,
}: {
  minutosTierra: number | null;
  site: string;
  mock: boolean;
}) {
  const { t, language } = useLanguage();
  const sol = useSol();
  const [topic, setTopic] = useState("shadow");
  // The 3D stage is open from the start, on the real relief: every option is on screen (Jean).
  const [scene, setScene] = useState(true);
  // Real relief (Jean): Mons Mouton (Moon), Payunia P-27 (Earth) and Jezero (Mars), 30 × 30 km each.
  const [terreno, setTerreno] = useState<ModoTerreno>("real");
  const [par, setPar] = useState<Par>("luna-tierra");
  const [exageracion, setExageracion] = useState(1);
  const [estadoTerreno, setEstadoTerreno] = useState<EstadoTerreno | null>(null);
  const [textoH, setTextoH] = useState("0.50");
  const [altura, setAltura] = useState(0.5);
  const [minutes, setMinutes] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [corte, setCorte] = useState(50);
  const [rumbo, setRumbo] = useState(() => (sol.azimut - 45 + 360) % 360);
  const [esquina, setEsquina] = useState(true);
  const [caida, setCaida] = useState(0);
  const [tiempos, setTiempos] = useState<{
    luna: number | null;
    tierra: number | null;
  } | null>(null);
  const [attempt, retry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [idx, setIdx] = useState<IndiceLab>();
  const [horasLuna, setHorasLuna] = useState<number | null>(null);
  const animar = useMemo(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    setFailed(false);
    leerIndiceLab()
      .then((i) => {
        setIdx(i);
        const h0 = i.campo?.tablita_alto_m ?? 0.5;
        setAltura(h0);
        setTextoH(h0.toFixed(2));
      })
      .catch(() => setFailed(true));
    // Hours of one real lunation with the Sun inside the rehearsal band (1.5° to 7°).
    leerSerieSol("verano")
      .then((s) => {
        let h = 0;
        for (let i = s.i0; i < s.i1; i++)
          if (s.elevacion_deg[i] >= 1.5 && s.elevacion_deg[i] <= 7)
            h += s.paso_s / 3600;
        setHorasLuna(h);
      })
      .catch(() => setFailed(true));
  }, [attempt]);

  const crudoH = Number(textoH.replace(",", "."));
  const hValido =
    textoH.trim() !== "" &&
    Number.isFinite(crudoH) &&
    crudoH >= MIN_H &&
    crudoH <= MAX_H;

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
  const sombraLuna = sombra(altura, e);
  const sombraTierra = sombra(altura, e + refr);
  const penumbra = penumbraM(altura, e, rho);
  const num = (v: number, d = 1) =>
    new Intl.NumberFormat(language, {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    }).format(v);
  const nombresPanel = [
    t("Front", "Frontal"),
    t("Right", "Derecho"),
    t("Rear", "Trasero"),
  ];
  const tCaida = (g: number) => Math.sqrt((2 * MASTIL_M) / g);

  const teclaVista = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || ev.nativeEvent.isComposing) return;
    if (escribiendoEnCampo(ev.target)) return;
    const enRangoAjeno =
      ev.target instanceof HTMLInputElement &&
      ev.target.type === "range" &&
      ev.target.id !== "curtain";
    if (ev.key === "l" || ev.key === "L") {
      ev.preventDefault();
      setCorte(95);
    } else if (ev.key === "t" || ev.key === "T") {
      ev.preventDefault();
      setCorte(5);
    } else if (!enRangoAjeno) {
      const paso = ev.shiftKey ? 10 : 1;
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        setCorte((c) => Math.max(5, c - paso));
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        setCorte((c) => Math.min(95, c + paso));
      } else if (ev.key === "Home") {
        ev.preventDefault();
        setCorte(5);
      } else if (ev.key === "End") {
        ev.preventDefault();
        setCorte(95);
      }
    }
  };

  const preguntaSI = () => {
    if (topic === "energy") {
      return t(
        `In Two Worlds (Energy), with the Sun at ${num(e, 1)}° elevation and ${num(sol.azimut, 0)}° azimuth, rover heading ${num(rumboReal, 0)}°, the three vertical ${panelW} W panels generate ${num(total, 0)} W on the Moon (${lados.map((_, k) => `${nombresPanel[k]} ${num(watts[k], 0)} W`).join(", ")}). Why does this solar power budget not transfer directly to ${site} on Earth?`,
        `En Dos Mundos (Energía), con el Sol a ${num(e, 1)}° de elevación y ${num(sol.azimut, 0)}° de azimut, rumbo del rover ${num(rumboReal, 0)}°, los tres paneles verticales de ${panelW} W generan ${num(total, 0)} W en la Luna (${lados.map((_, k) => `${nombresPanel[k]} ${num(watts[k], 0)} W`).join(", ")}). ¿Por qué este balance de potencia solar no se transfiere directamente a ${site} en la Tierra?`,
      );
    }
    if (topic === "gravity") {
      return t(
        `In Two Worlds (Gravity), a drop from ${num(MASTIL_M, 1)} m takes ${num(tCaida(G.luna), 2)} s on the Moon (${num(G.luna, 2)} m/s²) and ${num(tCaida(G.tierra), 2)} s on Earth (${num(G.tierra, 2)} m/s²). How does this gravity difference affect rover mobility and dust rehearsals at ${site}?`,
        `En Dos Mundos (Gravedad), una caída desde ${num(MASTIL_M, 1)} m tarda ${num(tCaida(G.luna), 2)} s en la Luna (${num(G.luna, 2)} m/s²) y ${num(tCaida(G.tierra), 2)} s en la Tierra (${num(G.tierra, 2)} m/s²). ¿Cómo afecta esta diferencia de gravedad a los ensayos de movilidad y polvo en ${site}?`,
      );
    }
    if (topic === "time") {
      return t(
        `In Two Worlds (Time), the grazing Sun (1.5° to 7°) lasts ${horasLuna !== null ? `${num(horasLuna, 0)} h` : "hundreds of hours"} per summer lunation on the Moon vs ${minutosTierra !== null ? `${num(minutosTierra, 0)} min` : "minutes"} per sunset window at ${site}. How should a field team plan rehearsals around that window?`,
        `En Dos Mundos (Tiempo), el Sol rasante (1,5° a 7°) dura ${horasLuna !== null ? `${num(horasLuna, 0)} h` : "cientos de horas"} por lunación de verano en la Luna frente a ${minutosTierra !== null ? `${num(minutosTierra, 0)} min` : "minutos"} por ventana en ${site}. ¿Cómo conviene planificar el ensayo de campo en esa ventana?`,
      );
    }
    return t(
      `In Two Worlds (Shadows), with object height h = ${num(altura, 2)} m and the Sun at ${num(e, 1)}°, the shadow is ${num(sombraLuna, 2)} m on the Moon and ${num(sombraTierra, 2)} m on Earth (refraction +${num(refr, 2)}°), with a ${num(penumbra, 2)} m penumbra tip. Explain what transfers between Mons Mouton, ${site} and Mars.`,
      `En Dos Mundos (Sombras), con altura h = ${num(altura, 2)} m y el Sol a ${num(e, 1)}°, la sombra mide ${num(sombraLuna, 2)} m en la Luna y ${num(sombraTierra, 2)} m en la Tierra (refracción +${num(refr, 2)}°), con ${num(penumbra, 2)} m de penumbra. Explicame qué se transfiere entre Mons Mouton, ${site} y Marte.`,
    );
  };

  const contextoSI = () => ({
    pantalla: "worlds",
    fenomeno: topic,
    sitio: site,
    elevacion_sol_deg: e,
    azimut_sol_deg: sol.azimut,
    altura_objeto_m: altura,
    sombra_luna_m: Number(sombraLuna.toFixed(2)),
    sombra_tierra_m: Number(sombraTierra.toFixed(2)),
    refraccion_deg: Number(refr.toFixed(3)),
    penumbra_m: Number(penumbra.toFixed(2)),
    potencia_total_w: Math.round(total),
    corte_cortina_pct: corte,
    terreno_3d: terreno,
    exageracion_vertical: exageracion,
  });

  return (
    <div className="dos-mundos-vista" onKeyDown={teclaVista}>
      <h2>
        {t(
          "What can we reproduce on Earth, and what stays different?",
          "¿Qué podemos reproducir en la Tierra y qué sigue siendo diferente?",
        )}
      </h2>
      <p className="lead">
        {t(
          "Choose a phenomenon to compare the same experiment in two environments.",
          "Elige un fenómeno para comparar el mismo ensayo en los dos entornos.",
        )}
      </p>
      <div
        className="topic-switch"
        role="group"
        aria-label={t("Phenomenon", "Fenómeno")}
      >
        {Object.entries({
          shadow: t("Shadows", "Sombras"),
          energy: t("Energy", "Energía"),
          gravity: t("Gravity", "Gravedad"),
          time: t("Time", "Tiempo"),
        }).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={topic === id}
            onClick={() => setTopic(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {failed && (
        <p className="notice" role="alert">
          {t(
            "Some model data could not be loaded.",
            "No se pudieron cargar algunos datos del modelo.",
          )}{" "}
          <button className="text-btn" onClick={() => retry((a) => a + 1)}>
            {t("Retry data", "Reintentar carga")}
          </button>
        </p>
      )}
      <div className="mandos">
        {(topic === "shadow" || topic === "energy") && (
          <div>
            <label htmlFor="mundos-el">
              {t("Sun elevation", "Altura del Sol")}: <strong>{num(e)}°</strong>
            </label>
            <input
              id="mundos-el"
              type="range"
              min="1.5"
              max="10"
              step="0.5"
              value={e}
              onChange={(ev) => sol.setElevacion(Number(ev.target.value))}
            />
          </div>
        )}
        {topic === "shadow" && (
          <div>
            <label htmlFor="mundos-h">
              {t("Object height h (m)", "Altura del objeto h (m)")}:{" "}
              <strong>{num(altura, 2)} m</strong>
            </label>
            <input
              id="mundos-h"
              type="number"
              min={MIN_H}
              max={MAX_H}
              step="0.05"
              inputMode="decimal"
              value={textoH}
              aria-invalid={!hValido}
              aria-describedby={!hValido ? "mundos-h-aviso" : undefined}
              onChange={(ev) => {
                const v = ev.target.value;
                setTextoH(v);
                const n = Number(v.replace(",", "."));
                if (
                  v.trim() !== "" &&
                  Number.isFinite(n) &&
                  n >= MIN_H &&
                  n <= MAX_H
                ) {
                  setAltura(Math.round(n * 100) / 100);
                }
              }}
            />
            {!hValido && (
              <small id="mundos-h-aviso" className="muted" role="alert">
                {t(
                  `Valid range: ${num(MIN_H, 2)} to ${num(MAX_H, 0)} m (default 0.50 m).`,
                  `Rango válido: ${num(MIN_H, 2)} a ${num(MAX_H, 0)} m (por defecto 0,50 m).`,
                )}
              </small>
            )}
          </div>
        )}
        {topic === "energy" && (
          <div>
            <label htmlFor="mundos-az">
              {t("Sun direction", "Dirección del Sol")}:{" "}
              <strong>{num(sol.azimut, 0)}°</strong>
            </label>
            <input
              id="mundos-az"
              type="range"
              min="0"
              max="359"
              step="1"
              value={sol.azimut}
              onChange={(ev) => sol.setAzimut(Number(ev.target.value))}
            />
          </div>
        )}
        {topic === "energy" && (
          <div>
            <label htmlFor="mundos-rumbo">
              {t("Rover heading", "Rumbo del rover")}:{" "}
              <strong>{num(rumboReal, 0)}°</strong>
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
            <button
              className="btn sec chico"
              aria-pressed={esquina}
              onClick={() => setEsquina((v) => !v)}
            >
              {t("Keep the Sun on a corner", "Mantener el Sol en una esquina")}
            </button>
          </div>
        )}
        {topic === "time" && (
          <label>
            {t("Lunar time unit", "Unidad de tiempo lunar")}
            <select
              value={minutes ? "min" : "h"}
              onChange={(e) => setMinutes(e.target.value === "min")}
            >
              <option value="h">{t("Hours", "Horas")}</option>
              <option value="min">{t("Minutes", "Minutos")}</option>
            </select>
          </label>
        )}
      </div>
      <div className="lecturas">
        {!idx && !failed && (topic === "energy" || topic === "shadow") && (
          <p role="status">
            {t("Loading model parameters…", "Cargando parámetros del modelo…")}
          </p>
        )}
        {topic === "shadow" && idx && (
          <section className="panel">
            <h2>
              {t(
                `Shadow of the ${num(altura, 2)} m board`,
                `Sombra de la tablita de ${num(altura, 2)} m`,
              )}
            </h2>
            <dl className="par">
              <div>
                <dt>{t("Moon", "Luna")}</dt>
                <dd>{num(sombraLuna, 2)} m</dd>
              </div>
              <div>
                <dt>{t("Earth", "Tierra")}</dt>
                <dd>{num(sombraTierra, 2)} m</dd>
              </div>
            </dl>
            <p className="mono" data-testid="formula-sombra">
              L = h ÷ tan(e) = {num(altura, 2)} m ÷ tan({num(e, 1)}°) ={" "}
              {num(sombraLuna, 2)} m ({t("Moon", "Luna")}) ·{" "}
              {num(altura, 2)} m ÷ tan({num(e + refr, 2)}°) ={" "}
              {num(sombraTierra, 2)} m ({t("Earth", "Tierra")}) ·{" "}
              {t("penumbra", "penumbra")} = {num(penumbra, 2)} m
            </p>
            <p>
              {t(
                `Same rule on both: height ÷ tan(Sun elevation). On Earth the air bends the light and lifts the Sun ${num(refr, 2)}°, so the shadow is ${num(100 * (1 - sombraTierra / sombraLuna), 1)} % shorter. The fuzzy tip is ${num(penumbra, 2)} m long in both worlds; on the Moon the shadow itself is black because no sky lights it.`,
                `La misma regla en ambos: altura ÷ tan(altura del Sol). En la Tierra el aire curva la luz y levanta el Sol ${num(refr, 2)}°, así que la sombra es ${num(100 * (1 - sombraTierra / sombraLuna), 1)} % más corta. La punta difusa mide ${num(penumbra, 2)} m en los dos mundos; en la Luna la sombra es negra porque no hay cielo que la ilumine.`,
              )}
            </p>
            <p className="mono">F14 · F15 (Sæmundsson) · F19</p>
          </section>
        )}
        {topic === "energy" && idx && (
          <section className="panel">
            <h2>
              {t("Power from the three panels", "Potencia de los tres paneles")}
            </h2>
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
            <p className="mono">
              F4 ·{" "}
              {t(
                "vertical panels, 320 W each",
                "paneles verticales, 320 W cada uno",
              )}
            </p>
          </section>
        )}
        {topic === "gravity" && (
          <section className="panel">
            <h2>
              {t(
                "Gravity: drop test from 2.5 m",
                "Gravedad: caída desde 2,5 m",
              )}
            </h2>
            <dl className="par">
              <div>
                <dt>{t("Moon", "Luna")}</dt>
                <dd>
                  {tiempos?.luna != null
                    ? `${num(tiempos.luna, 2)} s`
                    : tiempos
                      ? "…"
                      : `${num(tCaida(G.luna), 2)} s`}
                </dd>
              </div>
              <div>
                <dt>{t("Earth", "Tierra")}</dt>
                <dd>
                  {tiempos?.tierra != null
                    ? `${num(tiempos.tierra, 2)} s`
                    : tiempos
                      ? "…"
                      : `${num(tCaida(G.tierra), 2)} s`}
                </dd>
              </div>
            </dl>
            <button
              className="btn"
              onClick={() => {
                setScene(true);
                setPar("luna-tierra");
                setTerreno("plano");
                setCaida((c) => c + 1);
              }}
            >
              {t(
                "Drop the ball in both worlds",
                "Soltar la bola en los dos mundos",
              )}
            </button>
            <p>
              {t(
                "Time = √(2 × height ÷ gravity), without air. Wheels, dust and falling tools behave differently at one sixth of Earth's gravity: no place on Earth reproduces it.",
                "Tiempo = √(2 × altura ÷ gravedad), sin aire. Las ruedas, el polvo y las herramientas que caen se comportan distinto con un sexto de la gravedad terrestre: ningún lugar de la Tierra lo reproduce.",
              )}
            </p>
            <p className="mono">
              g = {num(G.luna, 2)} / {num(G.tierra, 2)} m/s² · NASA NSSDCA
            </p>
          </section>
        )}
        {topic === "time" && (
          <section className="panel">
            <h2>
              {t(
                "Time with a grazing Sun (1.5° to 7°)",
                "Tiempo con Sol rasante (1,5° a 7°)",
              )}
            </h2>
            <dl className="par">
              <div>
                <dt>{t("Moon, one lunation", "Luna, una lunación")}</dt>
                <dd>
                  {horasLuna === null
                    ? t("Unavailable", "Sin datos")
                    : minutes
                      ? `${num(horasLuna * 60, 0)} min`
                      : `${num(horasLuna, 0)} h`}
                </dd>
              </div>
              <div>
                <dt>
                  {t(
                    "Earth, first recorded window",
                    "Tierra, primera ventana de la ficha",
                  )}
                </dt>
                <dd>
                  {minutosTierra === null
                    ? t("Unavailable", "Sin datos")
                    : `${num(minutosTierra, 0)} min`}
                </dd>
              </div>
            </dl>
            {horasLuna !== null && minutosTierra !== null && (
              <div className="barras-tiempo" aria-hidden="true">
                <i style={{ width: "100%" }} />
                <i
                  className="tierra"
                  style={{
                    width: `${Math.max(0.6, (100 * minutosTierra) / 60 / horasLuna)}%`,
                  }}
                />
              </div>
            )}
            <p>
              {t(
                "The lunar total adds all hours in the band during the 2027 summer lunation. The Earth record shows a single window. Use the unit selector to read the lunar duration in minutes or hours.",
                "El total lunar suma las horas en esa banda durante la lunación de verano de 2027. La ficha terrestre muestra una sola ventana. Cambia la unidad para leer la duración lunar en minutos u horas.",
              )}
            </p>
            <p className="mono">
              {t("Earth window", "Ventana terrestre")}: {site}{" "}
              {mock && t("(demo)", "(demostración)")}
            </p>
          </section>
        )}
        <TarjetaCuerpos altura={altura} elevacion={e} radioSolDeg={rho} />
      </div>
      <div className="scene-tools">
        {topic !== "time" && (
          <>
            <button
              className="btn sec"
              aria-expanded={scene}
              onClick={() => setScene((v) => !v)}
            >
              {scene
                ? t("Hide the 3D view", "Ocultar la vista 3D")
                : t("Show the 3D view", "Mostrar la vista 3D")}
            </button>
            {scene && (
              <div
                className="segmento"
                role="group"
                aria-label={t("Worlds compared", "Mundos comparados")}
              >
                {(Object.keys(PARES) as Par[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={par === k}
                    onClick={() => setPar(k)}
                  >
                    {PARES[k].map((m) => t(NOMBRES[m].en, NOMBRES[m].es)).join(" | ")}
                  </button>
                ))}
              </div>
            )}
            {scene && (
              <div
                className="segmento"
                role="group"
                aria-label={t("Ground in the 3D view", "Suelo de la vista 3D")}
              >
                <button
                  type="button"
                  aria-pressed={terreno === "plano" && par === "luna-tierra"}
                  disabled={par !== "luna-tierra"}
                  title={par !== "luna-tierra" ? t("The close-up stage and its readouts are Moon | Earth", "El primer plano y sus lecturas son Luna | Tierra") : undefined}
                  onClick={() => setTerreno("plano")}
                >
                  {t("Close-up, flat ground", "Primer plano, suelo plano")}
                </button>
                <button
                  type="button"
                  aria-pressed={terreno === "real" || par !== "luna-tierra"}
                  onClick={() => setTerreno("real")}
                >
                  {t("Real relief, 30 × 30 km", "Relieve real, 30 × 30 km")}
                </button>
              </div>
            )}
            {scene && (
              <div
                className="segmento"
                role="group"
                aria-label={t("Vertical exaggeration", "Exageración vertical")}
              >
                {[1, 2, 4].map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={exageracion === k}
                    disabled={terreno === "plano" && par === "luna-tierra"}
                    onClick={() => setExageracion(k)}
                  >
                    {t(`Vertical ×${k}`, `Vertical ×${k}`)}
                  </button>
                ))}
              </div>
            )}
            {scene && (terreno === "real" || par !== "luna-tierra") && estadoTerreno !== "listo" && (
              <span className="muted" role="status">
                {estadoTerreno === "sin-datos"
                  ? t(
                      "Real relief unavailable: showing the close-up.",
                      "Relieve real no disponible: se muestra el primer plano.",
                    )
                  : t("Loading the real relief…", "Cargando el relieve real…")}
              </span>
            )}
          </>
        )}
        <BotonSI
          texto={t("Explain with SI", "Explicar con SI")}
          pregunta={preguntaSI}
          contexto={contextoSI}
        />
        {topic !== "time" && (
          <button
            className="text-btn"
            onClick={() => {
              sol.resetSol();
              setEsquina(true);
              setTerreno("real");
              setPar("luna-tierra");
              setExageracion(1);
              setCorte(50);
              const h0 = idx?.campo?.tablita_alto_m ?? 0.5;
              setAltura(h0);
              setTextoH(h0.toFixed(2));
              setTiempos(null);
              setCaida(0);
              setSceneKey((k) => k + 1);
            }}
          >
            {t("Reset view and settings", "Restablecer vista y valores")}
          </button>
        )}
      </div>
      {scene && idx && topic !== "time" && (
        <>
          <EscenarioCortina
            corte={corte}
            onCorte={setCorte}
            etiqueta={t(
              "Moon and Earth comparison stage. Drag the curtain or use Left and Right arrows, Home, End, L for Moon and T for Earth.",
              "Escenario de comparación Luna y Tierra. Arrastra la cortina o usa las flechas izquierda y derecha, Inicio, Fin, L para Luna y T para Tierra.",
            )}
          >
            <Suspense
              fallback={
                <div className="escena escena-mundos cargando">
                  {t("Loading the 3D stage…", "Cargando el escenario 3D…")}
                </div>
              }
            >
              <DosMundos3D
                key={`${sceneKey}-${par}`}
                par={par}
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
                terreno={terreno}
                alturaObjetoM={altura}
                exageracion={exageracion}
                onTerrenoEstado={setEstadoTerreno}
                textoAcercar={t("Zoom in", "Acercar")}
                textoAlejar={t("Zoom out", "Alejar")}
                etiqueta={t(
                  "3D stage: a solar rover and a calibration board lit by a low Sun, Moon on the left of the divider and Earth on the right",
                  "Escenario 3D: un rover solar y una tablita de calibración iluminados por un Sol bajo, la Luna a la izquierda del divisor y la Tierra a la derecha",
                )}
              />
            </Suspense>
            <div
              className="moon-layer"
              style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }}
              aria-hidden="true"
            />
            <span className="world-label moon-label">
              {t(NOMBRES[PARES[par][0]].en, NOMBRES[PARES[par][0]].es)}
            </span>
            <span className="world-label earth-label">
              {t(NOMBRES[PARES[par][1]].en, NOMBRES[PARES[par][1]].es)}
            </span>
          </EscenarioCortina>
          <p className="muted">
            {terreno === "real" || par !== "luna-tierra"
              ? t(
                  "Real relief from the source grids (Moon and Earth 60 m, Mars 200 m native), drawn with display meshes. Both worlds share the same local Sun angle; the drawn shadows are the renderer's, the Sun disc has its true size for each world, and the sky colours are illustration. Use the readings and the Moon · Earth · Mars card for numbers.",
                  "Relieve real de las grillas de origen (Luna y Tierra 60 m, Marte 200 m nativos), dibujado con mallas de exhibición. Los dos mundos comparten el mismo ángulo local del Sol; las sombras dibujadas son del renderizador, el disco solar tiene su tamaño real en cada mundo y los colores del cielo son ilustración. Usa las lecturas y la tarjeta Luna · Tierra · Marte para los números.",
                )
              : t(
                  "Illustrative flat ground and generic rover geometry. Use the paired readings for numerical comparisons.",
                  "Suelo plano ilustrativo y geometría genérica del rover. Usa las lecturas por mundo para comparar los valores.",
                )}
          </p>
          <div>
            <label htmlFor="curtain">
              {t("Comparison divider", "Divisor de comparación")}:{" "}
              <strong className="mono">{corte} % {t("Moon", "Luna")}</strong>
            </label>
            <input
              id="curtain"
              type="range"
              min="5"
              max="95"
              value={corte}
              onChange={(ev) => setCorte(Number(ev.target.value))}
            />
          </div>
        </>
      )}
      <a className="text-link" href="#card">
        {t("Return to site record", "Volver a la ficha")} · {site}
      </a>
    </div>
  );
}
