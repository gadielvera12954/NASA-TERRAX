/**
 * 3D lab: park the rover anywhere on the real Mons Mouton relief and watch a lunation.
 * The terrain click goes to the live engine (servidor/) when it is running; otherwise the same
 * formulas run in the browser over the exported files. The page always says which one answered.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../../i18n/Language";
import {
  ErrorMotor,
  Escenario,
  EstadoMotor,
  IndiceLab,
  PedidoEscenario,
  SerieSol,
  TerrenoInfo,
  latLonDePixel,
  leerIndiceLab,
  leerPng16,
  leerSerieSol,
  leerTerrenoInfo,
  pedirEscenario,
  simularEnNavegador,
  tramosDe,
} from "../../datos/laboratorio";
import TerrenoLunar, { PuntoGrilla, rangoHoras } from "../../escena3d/TerrenoLunar";
import { EjeTiempo, PerfilCielo, Pista, useAncho } from "./Graficos";

type Periodo = "verano" | "invierno" | "fechas";
interface Intento {
  clave: string;
  punto: PuntoGrilla;
  periodo: string;
  consumo: number;
  tramoH: number;
  bateriaMin: number;
  enRiesgo: boolean;
  origen: Escenario["origen"];
}

export default function Laboratorio({ motor, onMotorCaido }: { motor: EstadoMotor | null; onMotorCaido: () => void }) {
  const { t, language } = useLanguage();
  const [info, setInfo] = useState<TerrenoInfo>();
  const [idx, setIdx] = useState<IndiceLab>();
  const [punto, setPunto] = useState<PuntoGrilla>({ fila: 249, col: 249 });
  const [periodo, setPeriodo] = useState<Periodo>("verano");
  const [desde, setDesde] = useState("2027-01-05");
  const [hasta, setHasta] = useState("2027-02-03");
  const [consumo, setConsumo] = useState(60);
  const [panel, setPanel] = useState(320);
  const [bateria, setBateria] = useState(5420);
  const [esc, setEsc] = useState<Escenario>();
  const [base, setBase] = useState<SerieSol>();
  const [estado, setEstado] = useState<"calculando" | "listo" | "error">("calculando");
  const [error, setError] = useState("");
  const [paso, setPaso] = useState(0);
  const [andando, setAndando] = useState(false);
  const [capa, setCapa] = useState<"sombra" | "oscuridad">("sombra");
  const [horas, setHoras] = useState<Uint16Array | null>(null);
  const [sobre, setSobre] = useState<(PuntoGrilla & { alturaKm: number }) | null>(null);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [refGraficos, ancho] = useAncho<HTMLDivElement>();
  const pedido = useRef(0);

  useEffect(() => {
    leerTerrenoInfo().then(setInfo).catch(() => {});
    leerIndiceLab()
      .then((i) => {
        setIdx(i);
        setConsumo(i.vehiculo.consumo_w);
        setPanel(i.vehiculo.panel_w);
        setBateria(i.vehiculo.bateria_wh);
      })
      .catch(() => {});
  }, []);

  // Without the live engine only the two exported lunations exist.
  const periodoReal: Periodo = periodo === "fechas" && !motor ? "verano" : periodo;
  useEffect(() => {
    if (periodoReal === "fechas") {
      setHoras(null);
      return;
    }
    let vivo = true;
    leerSerieSol(periodoReal)
      .then((s) => vivo && setBase(s))
      .catch(() => {});
    leerPng16(`/data/destino/refugios_${periodoReal}.png`)
      .then((p) => vivo && setHoras(p.datos))
      .catch(() => vivo && setHoras(null));
    return () => {
      vivo = false;
    };
  }, [periodoReal]);

  // Ask for the scenario (debounced): live engine first, browser as fallback.
  useEffect(() => {
    if (!idx) return;
    const id = ++pedido.current;
    setEstado("calculando");
    const cuerpo: PedidoEscenario = {
      fila: punto.fila,
      col: punto.col,
      consumo_w: consumo,
      panel_w: panel,
      bateria_wh: bateria,
      ...(periodoReal === "fechas" ? { desde, hasta } : { lunacion: periodoReal }),
    };
    const reloj = window.setTimeout(async () => {
      let r: Escenario;
      try {
        if (motor) {
          try {
            r = await pedirEscenario(cuerpo);
          } catch (e) {
            if (e instanceof ErrorMotor && e.status === 400) throw e;
            onMotorCaido();
            r = await simularEnNavegador(cuerpo);
          }
        } else r = await simularEnNavegador(cuerpo);
      } catch (e) {
        if (id !== pedido.current) return;
        setError(e instanceof ErrorMotor ? e.message : "");
        setEstado("error");
        return;
      }
      if (id !== pedido.current) return;
      setEsc((previo) => {
        const mismoReloj = previo && previo.serie.t0_utc === r.serie.t0_utc && previo.serie.n === r.serie.n;
        if (!mismoReloj) {
          // Start at the highest Sun of the period, so the first view is lit.
          let mejor = r.serie.i0;
          for (let i = r.serie.i0; i < r.serie.i1; i++) if (r.serie.elevacion_deg[i] > r.serie.elevacion_deg[mejor]) mejor = i;
          setPaso(mejor);
        }
        return r;
      });
      setEstado("listo");
      const clave = [r.punto.fila, r.punto.col, r.periodo.desde, r.periodo.hasta, consumo, panel, bateria, r.origen].join("|");
      setIntentos((lista) =>
        lista.some((i) => i.clave === clave)
          ? lista
          : [
              {
                clave,
                punto: { fila: r.punto.fila, col: r.punto.col },
                periodo: r.periodo.lunacion ?? `${r.periodo.desde} → ${r.periodo.hasta}`,
                consumo,
                tramoH: r.resultado.tramo_oscuro_mas_largo_h,
                bateriaMin: r.resultado.bateria_minima_frac,
                enRiesgo: r.resultado.en_riesgo,
                origen: r.origen,
              },
              ...lista,
            ].slice(0, 12),
      );
    }, 220);
    return () => window.clearTimeout(reloj);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, punto, periodoReal, desde, hasta, consumo, panel, bateria, !!motor]);

  // Clock
  const n = esc?.serie.n ?? 0;
  useEffect(() => {
    if (!andando || !esc) return;
    const reloj = window.setInterval(() => {
      setPaso((p) => {
        if (p + 2 >= esc.serie.i1) {
          setAndando(false);
          return esc.serie.i1 - 1;
        }
        return p + 2;
      });
    }, 90);
    return () => window.clearInterval(reloj);
  }, [andando, esc]);
  const i = Math.min(paso, Math.max(0, n - 1));

  const s = esc?.serie;
  const solAz = s ? s.azimut_deg[i] : (base?.azimut_deg[base.i0 + 360] ?? 90);
  const solEl = s ? s.elevacion_deg[i] : (base?.elevacion_deg[base.i0 + 360] ?? 5);
  const t0 = s ? Date.parse(s.t0_utc) : 0;
  const ahora = s ? new Date(t0 + i * s.paso_s * 1000) : null;
  const fecha = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  const num = (v: number, d = 0) => new Intl.NumberFormat(language, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);

  const franjas = useMemo(() => {
    if (!esc) return { noche: [], sinPotencia: [] } as { noche: [number, number][]; sinPotencia: [number, number][] };
    const z = esc.serie;
    return {
      noche: tramosDe(z.elevacion_deg, (v, k) => v < z.horizonte_deg[k]),
      sinPotencia: tramosDe(z.potencia_w, (v) => v < esc.vehiculo.p_surv_w),
    };
  }, [esc]);
  const bateriaPct = useMemo(() => (esc ? esc.serie.bateria_wh.map((v) => (100 * v) / esc.vehiculo.bateria_wh) : []), [esc]);
  const rango = useMemo(() => (horas ? rangoHoras(horas) : [0, 0]), [horas]);
  const marcas = useMemo(() => {
    const mejor = intentos.reduce((m, x) => Math.min(m, x.tramoH), Infinity);
    return intentos.map((x) => ({ ...x.punto, mejor: x.tramoH === mejor }));
  }, [intentos]);

  const aqui = sobre && info ? latLonDePixel(info, sobre.fila, sobre.col) : null;
  const horasAqui = sobre && horas ? horas[sobre.fila * 500 + sobre.col] : null;
  const r = esc?.resultado;
  const limite = esc?.limite_refugio_h ?? idx?.limite_refugio_h ?? 50;
  const mejor = intentos.length ? intentos.reduce((a, b) => (b.tramoH < a.tramoH ? b : a)) : null;
  const elegir = (p: PuntoGrilla) => {
    setAndando(false);
    setPunto(p);
  };
  const nombres: Record<string, string> = {
    verano: t("Summer lunation 2027", "Lunación de verano 2027"),
    invierno: t("Winter lunation 2027", "Lunación de invierno 2027"),
  };

  return (
    <div className="lab">
      <p className="lead">
        {t(
          "This is the real relief of Mons Mouton, the lunar south pole site (LOLA, 60 m). Click anywhere to park a solar rover there. It is lost if it spends more than 50 hours without enough power: can you find a spot where it survives?",
          "Este es el relieve real de Mons Mouton, el sitio del polo sur lunar (LOLA, 60 m). Haz clic en cualquier lugar para estacionar allí un rover solar. Se pierde si pasa más de 50 horas sin energía suficiente: ¿encuentras un lugar donde sobreviva?",
        )}
      </p>
      <div className={`fuente-calculo ${motor ? "vivo" : ""}`} role="status">
        <span className="luz" aria-hidden="true" />
        {motor ? (
          <span>
            <strong>{t("Live engine connected", "Motor en vivo conectado")}</strong> ·{" "}
            {t(
              `each click runs the physics engine now: 360-azimuth ray-cast over relief out to ${motor.relieve.margen_km} km`,
              `cada clic ejecuta el motor físico ahora: trazado de 360 azimutes sobre relieve hasta ${motor.relieve.margen_km} km`,
            )}
          </span>
        ) : (
          <span>
            <strong>{t("Computed in your browser", "Calculado en tu navegador")}</strong> ·{" "}
            {t(
              "same formulas over the exported files (72-azimuth horizon table). Start the live engine for any date and a finer horizon.",
              "mismas fórmulas sobre los archivos exportados (tabla de horizonte de 72 azimutes). Inicia el motor en vivo para usar cualquier fecha y un horizonte más fino.",
            )}
          </span>
        )}
      </div>

      <div className="lab-rejilla">
        <section className="lab-escena" aria-label={t("3D terrain", "Terreno 3D")}>
          <div className="barra-escena">
            <div className="segmento" role="group" aria-label={t("Map layer", "Capa del mapa")}>
              <button aria-pressed={capa === "sombra"} onClick={() => setCapa("sombra")}>
                {t("Shadows at this hour", "Sombras a esta hora")}
              </button>
              <button aria-pressed={capa === "oscuridad"} onClick={() => setCapa("oscuridad")} disabled={!horas}>
                {t("Longest darkness (h)", "Oscuridad más larga (h)")}
              </button>
            </div>
            <span className="mono lectura" aria-live="off">
              {sobre && aqui
                ? `${num(aqui.lat, 3)}°, ${num(aqui.lon, 3)}°${info ? ` · ≈${num(info.z_min_m + sobre.alturaKm * 1000)} m` : ""}${
                    horasAqui !== null && horasAqui !== 65535 ? ` · ${num(horasAqui)} h ${t("dark", "sin Sol")}` : ""
                  }`
                : t("Drag to orbit · + / − to zoom · click to park", "Arrastra para girar · + / − para acercar · clic para estacionar")}
            </span>
          </div>
          <TerrenoLunar
            azimut={solAz}
            elevacion={solEl}
            capa={capa === "oscuridad" && horas ? "oscuridad" : "sombra"}
            horas={horas}
            limiteH={limite}
            punto={punto}
            marcas={marcas}
            onElegir={elegir}
            onSobre={setSobre}
            alto="min(62vh, 560px)"
            etiqueta={t(
              "3D relief of Mons Mouton with the shadows of the selected hour and the parked rover",
              "Relieve 3D de Mons Mouton con las sombras de la hora elegida y el rover estacionado",
            )}
textoAcercar={t("Zoom in", "Acercar")}
            textoAlejar={t("Zoom out", "Alejar")}
            textoSinWebgl={t(
              "3D is not available in this browser. Use the row and column fields to park the rover.",
              "El 3D no está disponible en este navegador. Usa los campos de fila y columna para estacionar el rover.",
            )}
          />
          {capa === "oscuridad" && horas && (
            <div className="rampa" aria-hidden="true">
              <span className="mono">{num(rango[0])} h</span>
              <i />
              <span className="mono">
                {num(rango[1])} h {t("or more without Sun", "o más sin Sol")}
              </span>
            </div>
          )}
          <p className="muted pie-escena">
            {t(
              "LOLA LDEM_80S_20MPP_ADJ (PGDA 90) · 30 × 30 km · no vertical exaggeration · display mesh at 120 m, shading and numbers from the 60 m grid · rover enlarged ×360 · the arrow points to geographic north.",
              "LOLA LDEM_80S_20MPP_ADJ (PGDA 90) · 30 × 30 km · sin exageración vertical · malla de exhibición a 120 m, sombreado y números de la grilla de 60 m · rover agrandado ×360 · la flecha apunta al norte geográfico.",
            )}
          </p>
        </section>

        <section className="panel consola" aria-label={t("Mission console", "Consola de misión")}>
          <h2>{t("1 · Where do you park?", "1 · ¿Dónde estacionas?")}</h2>
          <div className="campos">
            <label>
              {t("Row (north → south)", "Fila (norte → sur)")}
              <input
                type="number"
                min={0}
                max={499}
                value={punto.fila}
                onChange={(e) => elegir({ fila: Math.min(499, Math.max(0, Math.round(Number(e.target.value) || 0))), col: punto.col })}
              />
            </label>
            <label>
              {t("Column (west → east)", "Columna (oeste → este)")}
              <input
                type="number"
                min={0}
                max={499}
                value={punto.col}
                onChange={(e) => elegir({ fila: punto.fila, col: Math.min(499, Math.max(0, Math.round(Number(e.target.value) || 0))) })}
              />
            </label>
          </div>
          <button className="btn sec chico" onClick={() => elegir({ fila: 249, col: 249 })}>
            {t("Official centre of Mons Mouton", "Centro oficial de Mons Mouton")}
          </button>
          {esc && (
            <p className="mono dato-punto">
              {num(esc.punto.lat, 4)}°, {num(esc.punto.lon, 4)}°
              {esc.punto.altura_m !== null && ` · ${num(esc.punto.altura_m)} m`}
              {esc.punto.pendiente_deg !== null && ` · ${t("slope", "pendiente")} ${num(esc.punto.pendiente_deg, 1)}°`}
            </p>
          )}

          <h2>{t("2 · When?", "2 · ¿Cuándo?")}</h2>
          <div className="segmento vertical" role="group" aria-label={t("Period", "Período")}>
            <button aria-pressed={periodoReal === "verano"} onClick={() => setPeriodo("verano")}>
              {nombres.verano}
            </button>
            <button aria-pressed={periodoReal === "invierno"} onClick={() => setPeriodo("invierno")}>
              {nombres.invierno}
            </button>
            <button aria-pressed={periodoReal === "fechas"} onClick={() => setPeriodo("fechas")} disabled={!motor}>
              {t("Any dates", "Cualquier fecha")}
              {!motor && ` · ${t("needs the live engine", "requiere el motor en vivo")}`}
            </button>
          </div>
          {periodoReal === "fechas" && (
            <div className="campos">
              <label>
                {t("From (UTC)", "Desde (UTC)")}
                <input type="date" value={desde} min="1901-01-01" max="2049-12-31" onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label>
                {t("To (UTC)", "Hasta (UTC)")}
                <input type="date" value={hasta} min="1901-01-01" max="2049-12-31" onChange={(e) => setHasta(e.target.value)} />
              </label>
            </div>
          )}

          <h2>{t("3 · Which rover?", "3 · ¿Qué rover?")}</h2>
          <label htmlFor="lab-consumo">
            {t("Power it needs to stay alive", "Potencia que necesita para seguir vivo")}: <strong>{num(consumo, 1)} W</strong>
          </label>
          <input
            id="lab-consumo"
            type="range"
            min={idx?.vehiculo.consumo_sensibilidad_w[0] ?? 50}
            max={idx?.vehiculo.p_surv_w ?? 108.4}
            step="0.1"
            value={consumo}
            onChange={(e) => setConsumo(Number(e.target.value))}
          />
          <div className="fichas-rapidas" role="group" aria-label={t("Consumption presets", "Consumos de referencia")}>
            {(idx?.vehiculo.consumo_sensibilidad_w ?? []).map((w) => (
              <button key={w} aria-pressed={consumo === w} onClick={() => setConsumo(w)}>
                {num(w, w % 1 ? 1 : 0)} W
              </button>
            ))}
          </div>
          <p className="muted">
            {t(
              "Team assumption: VIPER's consumption is not public. 108.4 W is the ceiling implied by its public battery and 50 h survival.",
              "Supuesto del equipo: el consumo de VIPER no es público. 108,4 W es el techo que surge de su batería pública y sus 50 h de supervivencia.",
            )}
          </p>
          <details>
            <summary>{t("Change panels and battery", "Cambiar paneles y batería")}</summary>
            <div className="campos">
              <label>
                {t("Each panel (W)", "Cada panel (W)")}
                <input type="number" min={50} max={2000} step={10} value={panel} onChange={(e) => setPanel(Math.min(2000, Math.max(50, Number(e.target.value) || 50)))} />
              </label>
              <label>
                {t("Battery (Wh)", "Batería (Wh)")}
                <input type="number" min={500} max={50000} step={10} value={bateria} onChange={(e) => setBateria(Math.min(50000, Math.max(500, Number(e.target.value) || 500)))} />
              </label>
            </div>
            <p className="muted">
              {t(
                `Published VIPER figures: ${idx?.vehiculo.panel_w ?? 320} W per panel, ${idx?.vehiculo.bateria_wh ?? 5420} Wh. Other values are your own what-if.`,
                `Cifras publicadas de VIPER: ${idx?.vehiculo.panel_w ?? 320} W por panel, ${idx?.vehiculo.bateria_wh ?? 5420} Wh. Otros valores son tu propia hipótesis.`,
              )}
            </p>
            <button
              className="btn sec chico"
              onClick={() => {
                if (!idx) return;
                setPanel(idx.vehiculo.panel_w);
                setBateria(idx.vehiculo.bateria_wh);
                setConsumo(idx.vehiculo.consumo_w);
              }}
            >
              {t("Back to published figures", "Volver a las cifras publicadas")}
            </button>
          </details>
        </section>
      </div>

      <section className={`veredicto ${estado} ${r ? (r.en_riesgo ? "riesgo" : "vive") : ""}`} aria-live="polite">
        {estado === "error" && (
          <p role="alert">
            {error ||
              t(
                "This scenario could not be computed. Check the dates or try another point.",
                "No se pudo calcular este escenario. Revisa las fechas o prueba otro punto.",
              )}
          </p>
        )}
        {r && esc && estado !== "error" && (
          <>
            <div className="veredicto-titulo">
              <span className="sello">{r.en_riesgo ? t("× Rover lost", "× Rover perdido") : t("● Rover survives", "● El rover sobrevive")}</span>
              <span className="muted">
                {estado === "calculando"
                  ? t("Computing…", "Calculando…")
                  : esc.origen === "motor-en-vivo"
                    ? t(`Live engine · ${esc.calculo_ms} ms · ${esc.punto.horizonte.n_az} azimuths`, `Motor en vivo · ${esc.calculo_ms} ms · ${esc.punto.horizonte.n_az} azimutes`)
                    : t(`In the browser · ${esc.punto.horizonte.n_az} azimuths`, `En el navegador · ${esc.punto.horizonte.n_az} azimutes`)}
              </span>
            </div>
            <div className="condiciones">
              <div className={r.condiciones.oscuridad ? "mal" : "bien"}>
                <strong>{num(r.tramo_oscuro_mas_largo_h)} h</strong>
                <span>
                  {t("longest stretch without enough power", "tramo más largo sin energía suficiente")} · {t("limit", "límite")} {num(limite)} h
                </span>
                <div className="barra-limite" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, (100 * limite) / Math.max(limite, r.tramo_oscuro_mas_largo_h))}%` }} />
                </div>
              </div>
              <div className={r.condiciones.bateria ? "mal" : "bien"}>
                <strong>{num(100 * r.bateria_minima_frac)} %</strong>
                <span>
                  {t("lowest battery", "batería mínima")} · {t("reserve", "reserva")} {num(100 * esc.vehiculo.reserva_frac)} %
                </span>
              </div>
              <div className={r.condiciones.pendiente ? "mal" : esc.punto.pendiente_deg === null ? "nd" : "bien"}>
                <strong>{esc.punto.pendiente_deg === null ? "—" : `${num(esc.punto.pendiente_deg, 1)}°`}</strong>
                <span>
                  {t("local slope", "pendiente local")} · {t("limit", "límite")} 15°
                  {esc.punto.pendiente_deg === null && ` · ${t("needs the live engine", "requiere el motor en vivo")}`}
                </span>
              </div>
              <div className="nd">
                <strong>{num(r.noche_geometrica_h)} h</strong>
                <span>{t("longest night (Sun behind the relief)", "noche más larga (Sol tras el relieve)")}</span>
              </div>
            </div>
          </>
        )}
        {!r && estado === "calculando" && <p>{t("Computing the first scenario…", "Calculando el primer escenario…")}</p>}
      </section>

      {s && esc && (
        <section className="panel reloj" ref={refGraficos}>
          <div className="reloj-cabeza">
            <button className="btn" onClick={() => setAndando((a) => !a)}>
              {andando ? t("❚❚ Pause", "❚❚ Pausar") : t("▶ Play the lunation", "▶ Reproducir la lunación")}
            </button>
            <label htmlFor="lab-reloj" className="mono">
              {ahora ? fecha.format(ahora) : ""} UTC
            </label>
            <span className="mono lectura-reloj">
              {t("Sun", "Sol")} {num(s.elevacion_deg[i], 2)}° · {t("horizon", "horizonte")} {num(s.horizonte_deg[i], 1)}° · {num(s.potencia_w[i])} W ·{" "}
              {t("battery", "batería")} {num(bateriaPct[i])} %
            </span>
          </div>
          <input
            id="lab-reloj"
            type="range"
            min={0}
            max={n - 1}
            value={i}
            onChange={(e) => {
              setAndando(false);
              setPaso(Number(e.target.value));
            }}
            aria-valuetext={ahora ? fecha.format(ahora) : undefined}
          />
          <Pista
            titulo={t("Sun elevation at the rover (°)", "Altura del Sol en el rover (°)")}
            lineas={[
              { valores: s.elevacion_deg, color: "var(--sol)", nombre: t("Sun", "Sol") },
              { valores: s.horizonte_deg, color: "var(--texto-sec)", nombre: t("Relief in that direction", "Relieve en esa dirección"), punteada: true },
            ]}
            franjas={franjas.noche}
            textoFranja={t("Night", "Noche")}
            dominio={[-8, 12]}
            marcas={[-5, 0, 5, 10]}
            formato={(v) => `${v}°`}
            i0={s.i0}
            i1={s.i1}
            paso={i}
            onPaso={(k) => {
              setAndando(false);
              setPaso(k);
            }}
            ancho={ancho}
          />
          <Pista
            titulo={t("Panel power (W)", "Potencia de los paneles (W)")}
            lineas={[{ valores: s.potencia_w, color: "var(--dato)", nombre: t("Power", "Potencia") }]}
            franjas={franjas.sinPotencia}
            dominio={[0, Math.max(500, 1.6 * panel)]}
            marcas={[0, 200, 400]}
            formato={(v) => `${v}`}
            referencia={{ valor: esc.vehiculo.p_surv_w, texto: t(`minimum to survive ${num(esc.vehiculo.p_surv_w, 1)} W`, `mínimo para sobrevivir ${num(esc.vehiculo.p_surv_w, 1)} W`) }}
            i0={s.i0}
            i1={s.i1}
            paso={i}
            onPaso={(k) => {
              setAndando(false);
              setPaso(k);
            }}
            ancho={ancho}
          />
          <Pista
            titulo={t("Battery (%)", "Batería (%)")}
            lineas={[{ valores: bateriaPct, color: "var(--luna)", nombre: t("Battery", "Batería") }]}
            dominio={[0, 100]}
            marcas={[0, 50, 100]}
            formato={(v) => `${v}`}
            referencia={{ valor: 100 * esc.vehiculo.reserva_frac, texto: t("reserve", "reserva") }}
            i0={s.i0}
            i1={s.i1}
            paso={i}
            onPaso={(k) => {
              setAndando(false);
              setPaso(k);
            }}
            ancho={ancho}
          />
          <EjeTiempo t0={t0} pasoS={s.paso_s} n={n} ancho={ancho} idioma={language} />
          <p className="muted">
            {t(
              "Move over any chart to move the Sun in the 3D view. The dimmed edges are 16 days of margin so that no night is cut in half; the battery starts full.",
              "Pasa sobre cualquier gráfico para mover el Sol en la vista 3D. Los bordes atenuados son 16 días de margen para no cortar ninguna noche por la mitad; la batería arranca llena.",
            )}
          </p>
          <PerfilCielo
            horizonte={esc.horizonte_grilla_deg}
            conv={esc.punto.convergencia_deg}
            az={s.azimut_deg}
            el={s.elevacion_deg}
            i0={s.i0}
            i1={s.i1}
            paso={i}
            ancho={ancho}
            textos={{
              norte: t("N", "N"),
              este: t("E", "E"),
              sur: t("S", "S"),
              oeste: t("W", "O"),
              sol: t("Path of the Sun", "Recorrido del Sol"),
              horizonte: t("Relief seen from the rover", "Relieve visto desde el rover"),
              liso: t("Smooth horizon", "Horizonte liso"),
            }}
          >
            {t(
              "Why is it dark? The Sun circles the horizon and hides behind the relief",
              "¿Por qué queda a oscuras? El Sol rodea el horizonte y se esconde tras el relieve",
            )}
          </PerfilCielo>
        </section>
      )}

      <section className="panel intentos">
        <h2>{t("Your parking attempts", "Tus intentos de estacionamiento")}</h2>
        {mejor && (
          <p>
            {t("Best so far", "Mejor hasta ahora")}:{" "}
            <strong>
              {num(mejor.tramoH)} h {t("without enough power", "sin energía suficiente")}
            </strong>{" "}
            ({t("row", "fila")} {mejor.punto.fila}, {t("column", "columna")} {mejor.punto.col}).{" "}
            {mejor.tramoH > limite
              ? t(
                  `Still ${num(mejor.tramoH / limite, 1)}× the ${num(limite)} h limit. That is the finding: in these 30 × 30 km no spot is a safe haven, so a rover must travel or carry more energy.`,
                  `Todavía ${num(mejor.tramoH / limite, 1)}× el límite de ${num(limite)} h. Ese es el hallazgo: en estos 30 × 30 km ningún lugar es refugio, así que un rover debe desplazarse o llevar más energía.`,
                )
              : t("You found a safe haven for this rover.", "Encontraste un refugio para este rover.")}
          </p>
        )}
        {intentos.length > 0 ? (
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Row, column", "Fila, columna")}</th>
                  <th>{t("Period", "Período")}</th>
                  <th>{t("Needs", "Necesita")}</th>
                  <th>{t("Without power", "Sin energía")}</th>
                  <th>{t("Lowest battery", "Batería mín.")}</th>
                  <th>{t("Result", "Resultado")}</th>
                  <th>{t("Computed by", "Calculado por")}</th>
                  <th>
                    <span className="sr-only">{t("Actions", "Acciones")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {intentos.map((x) => (
                  <tr key={x.clave} className={mejor && x.clave === mejor.clave ? "mejor" : ""}>
                    <td className="mono">
                      {x.punto.fila}, {x.punto.col}
                    </td>
                    <td>{nombres[x.periodo] ?? x.periodo}</td>
                    <td className="mono">{num(x.consumo, 1)} W</td>
                    <td className="mono">{num(x.tramoH)} h</td>
                    <td className="mono">{num(100 * x.bateriaMin)} %</td>
                    <td>{x.enRiesgo ? t("× Lost", "× Perdido") : t("● Survives", "● Sobrevive")}</td>
                    <td>{x.origen === "motor-en-vivo" ? t("Live engine", "Motor en vivo") : t("Browser", "Navegador")}</td>
                    <td>
                      <button className="btn sec chico" onClick={() => elegir(x.punto)}>
                        {t("Go back", "Volver")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t("Park the rover to start the list.", "Estaciona el rover para empezar la lista.")}</p>
        )}
        {intentos.length > 1 && (
          <button className="btn sec chico" onClick={() => setIntentos([])}>
            {t("Clear the list", "Vaciar la lista")}
          </button>
        )}
      </section>
    </div>
  );
}
