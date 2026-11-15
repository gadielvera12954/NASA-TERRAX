/** Home hero: the real relief of Mons Mouton with the Sun of one real lunation moving over it. */
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/Language";
import {
  EstadoMotor,
  SerieSol,
  SolAhora,
  leerSerieSol,
  pedirSolAhora,
} from "../../datos/laboratorio";
import TerrenoLunar from "../../escena3d/TerrenoLunar";

export default function HeroTerreno({
  motor,
  onAbrir,
}: {
  motor: EstadoMotor | null;
  onAbrir: () => void;
}) {
  const { t, language } = useLanguage();
  const [serie, setSerie] = useState<SerieSol>();
  const [paso, setPaso] = useState(0);
  const [andando, setAndando] = useState(false);
  const [initialStep, setInitialStep] = useState(0);
  const [staticMap, setStaticMap] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ahora, setAhora] = useState<SolAhora>();

  useEffect(() => {
    leerSerieSol("verano")
      .then((s) => {
        setSerie(s);
        let mejor = s.i0;
        for (let i = s.i0; i < s.i1; i++)
          if (s.elevacion_deg[i] > s.elevacion_deg[mejor]) mejor = i;
        setInitialStep(mejor - 120);
        setPaso(mejor - 120);
      })
      .catch(() => setFailed(true));
  }, []);
  // Loop over the lit part of the lunation.
  const dia = useMemo(() => {
    if (!serie) return [0, 0];
    let a = serie.i1;
    let b = serie.i0;
    for (let i = serie.i0; i < serie.i1; i++)
      if (serie.elevacion_deg[i] > 0.4) {
        a = Math.min(a, i);
        b = Math.max(b, i);
      }
    return [a, b];
  }, [serie]);
  useEffect(() => {
    if (!andando || !serie) return;
    const reloj = window.setInterval(
      () => setPaso((p) => (p + 1 > dia[1] ? dia[0] : p + 1)),
      110,
    );
    return () => window.clearInterval(reloj);
  }, [andando, serie, dia]);
  useEffect(() => {
    if (!motor) {
      setAhora(undefined);
      return;
    }
    let vivo = true;
    const leer = () =>
      pedirSolAhora()
        .then((s) => vivo && setAhora(s))
        .catch(() => {});
    leer();
    const reloj = window.setInterval(leer, 60000);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, [motor]);

  const i = serie ? Math.min(Math.max(paso, dia[0]), dia[1]) : 0;
  const fecha = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const num = (v: number, d = 1) =>
    new Intl.NumberFormat(language, {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    }).format(v);
  const cuando = serie
    ? new Date(Date.parse(serie.t0_utc) + i * serie.paso_s * 1000)
    : null;

  return (
    <div className="hero-3d">
      {serie && (
        <TerrenoLunar
          onStatic={setStaticMap}
          azimut={serie.azimut_deg[i]}
          elevacion={serie.elevacion_deg[i]}
          capa="sombra"
          punto={{ fila: 249, col: 249 }}
          alto="clamp(300px, 46vh, 430px)"
          etiqueta={t(
            "3D relief of Mons Mouton at the lunar south pole; the shadows move with the Sun of the summer lunation of 2027",
            "Relieve 3D de Mons Mouton en el polo sur lunar; las sombras se mueven con el Sol de la lunación de verano de 2027",
          )}
          textoAcercar={t("Zoom in", "Acercar")}
          textoAlejar={t("Zoom out", "Alejar")}
          textoSinWebgl={t(
            "Static LOLA relief. Interactive 3D is unavailable here.",
            "Relieve LOLA estático. La vista 3D no está disponible aquí.",
          )}
        />
      )}
      {!serie && (
        <p role="status">
          {failed
            ? t(
                "The solar series is unavailable. Reopen the 3D view to retry.",
                "La serie solar no está disponible. Vuelve a abrir la vista 3D para reintentar.",
              )
            : t("Loading the solar series…", "Cargando la serie solar…")}
        </p>
      )}
      {serie && !staticMap && (
        <div className="hero-mandos">
          <button
            className="btn sec chico"
            onClick={() => setAndando((a) => !a)}
            aria-pressed={andando}
          >
            {andando
              ? t("❚❚ Pause the Sun", "❚❚ Pausar el Sol")
              : t("▶ Move the Sun", "▶ Mover el Sol")}
          </button>
          <button
            className="text-btn"
            onClick={() => {
              setPaso(initialStep);
              setAndando(false);
            }}
          >
            {t("Reset time", "Restablecer hora")}
          </button>
          <label htmlFor="hero-sol" className="sr-only">
            {t("Hour of the lunation", "Hora de la lunación")}
          </label>
          <input
            id="hero-sol"
            type="range"
            min={dia[0]}
            max={dia[1]}
            value={i}
            onChange={(e) => {
              setAndando(false);
              setPaso(Number(e.target.value));
            }}
            aria-valuetext={cuando ? fecha.format(cuando) : undefined}
          />
          <span className="mono">
            {cuando
              ? `${fecha.format(cuando)} UTC · ${t("Sun", "Sol")} ${num(serie!.elevacion_deg[i])}°`
              : "…"}
          </span>
        </div>
      )}
      <p className="hero-pie">
        {t(
          "LOLA source grid at 60 m, display mesh at 120 m. Solar positions come from JPL DE421 for the 2027 summer lunation.",
          "Grilla fuente LOLA de 60 m y malla visual de 120 m. Las posiciones solares provienen de JPL DE421 para la lunación de verano de 2027.",
        )}
      </p>
      {ahora && (
        <p className="hero-vivo" role="status">
          <span className="luz" aria-hidden="true" />
          {t(
            "Live engine · right now the Sun at Mons Mouton is at",
            "Motor en vivo · ahora mismo el Sol en Mons Mouton está a",
          )}{" "}
          <strong>{num(ahora.luna.elevacion_deg, 2)}°</strong>
          {ahora.luna.sobre_horizonte_liso
            ? ""
            : ` (${t("below the horizon", "bajo el horizonte")})`}
        </p>
      )}
      <button className="btn" onClick={onAbrir}>
        {t(
          "Park a rover on this terrain →",
          "Estacionar un rover en este terreno →",
        )}
      </button>
    </div>
  );
}
