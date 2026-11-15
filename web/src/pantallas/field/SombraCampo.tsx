/**
 * Field kit: measure the shadow of a 0.50 m board and check it against the engine.
 * With the live engine the Sun comes from DE421 + refraction (F15) for the exact minute;
 * without it the person types the Sun elevation and only the geometry (F14) is applied.
 */
import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "../../i18n/Language";
import { ErrorMotor, EstadoMotor, IndiceLab, SombraCampo as Respuesta, leerIndiceLab, pedirSombra } from "../../datos/laboratorio";

const RAD = Math.PI / 180;

export default function SombraCampo({ motor }: { motor: EstadoMotor | null }) {
  const { t, language } = useLanguage();
  const [idx, setIdx] = useState<IndiceLab>();
  const [fecha, setFecha] = useState("2026-11-14");
  const [hora, setHora] = useState("18:10");
  const [alto, setAlto] = useState("0.50");
  const [medida, setMedida] = useState("");
  const [suelo, setSuelo] = useState("");
  const [elevacion, setElevacion] = useState("10");
  const [resp, setResp] = useState<Respuesta>();
  const [estado, setEstado] = useState<"" | "calculando" | "error">("");
  const [error, setError] = useState("");

  useEffect(() => {
    leerIndiceLab()
      .then((i) => {
        setIdx(i);
        setFecha(i.campo.fecha);
        setAlto(i.campo.tablita_alto_m.toFixed(2));
      })
      .catch(() => {});
  }, []);

  const num = (v: number, d = 2) => new Intl.NumberFormat(language, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const h = Number(alto.replace(",", ".")) || 0;
  const m = medida.trim() === "" ? null : Number(medida.replace(",", "."));
  const meta = resp?.meta_error_frac ?? idx?.campo.meta_error_frac ?? 0.05;

  // Without the engine: geometry only, from a typed Sun elevation.
  const eManual = Number(elevacion.replace(",", "."));
  const manual = !motor && eManual > 0.3 && eManual < 89 && h > 0 ? h / Math.tan(eManual * RAD) : null;

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!motor) return;
    setEstado("calculando");
    setError("");
    try {
      const cuerpo: Record<string, unknown> = { fecha, hora_local: hora, alto_m: h };
      if (m !== null) cuerpo.largo_sombra_m = m;
      if (suelo.trim() !== "") cuerpo.inclinacion_suelo_deg = Number(suelo.replace(",", "."));
      setResp(await pedirSombra(cuerpo));
      setEstado("");
    } catch (e) {
      setError(e instanceof ErrorMotor ? e.message : "");
      setEstado("error");
    }
  };

  const calculada = motor ? (resp?.comparacion?.sombra_corregida_m ?? resp?.prediccion.sombra_m ?? null) : manual;
  const medidaVista = motor ? (resp?.comparacion?.sombra_medida_m ?? null) : m;
  const errorFrac = motor
    ? (resp?.comparacion?.error_corregido_frac ?? null)
    : manual !== null && m !== null && m > 0
      ? Math.abs(m - manual) / manual
      : null;
  const eVista = motor ? (resp?.prediccion.elevacion_aparente_deg ?? null) : manual !== null ? eManual : null;

  // Side view, to scale
  const W = 640;
  const H = 150;
  const largoMax = Math.max(calculada ?? 0, medidaVista ?? 0, 1);
  const escala = (W - 90) / largoMax;
  const x0 = 60;
  const suelY = H - 34;
  const altoPx = Math.min(H - 60, Math.max(14, h * escala));

  return (
    <section className="panel campo">
      <h2>{t("Field kit: check a real shadow", "Kit de campo: comprueba una sombra real")}</h2>
      <p>
        {t(
          "Stand a board upright on level ground near sunset, measure its shadow and compare. If the measured and computed lengths agree within 5 %, the Sun model that drives every lunar number here holds on real ground.",
          "Para una tablita vertical sobre suelo nivelado cerca del atardecer, mide su sombra y compara. Si lo medido y lo calculado coinciden dentro del 5 %, el modelo del Sol que mueve todos los números lunares de esta app se sostiene en terreno real.",
        )}
      </p>
      <form className="campos campo-form" onSubmit={enviar}>
        {motor ? (
          <>
            <label>
              {t("Date", "Fecha")}
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </label>
            <label>
              {t("Local time (UTC−3)", "Hora local (UTC−3)")}
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
            </label>
          </>
        ) : (
          <label>
            {t("Sun elevation from your printed sheet (°)", "Altura del Sol de tu planilla impresa (°)")}
            <input type="number" min="0.5" max="60" step="0.1" value={elevacion} onChange={(e) => setElevacion(e.target.value)} />
          </label>
        )}
        <label>
          {t("Board height (m)", "Alto de la tablita (m)")}
          <input type="number" min="0.05" max="5" step="0.01" value={alto} onChange={(e) => setAlto(e.target.value)} required />
        </label>
        <label>
          {t("Measured shadow (m)", "Sombra medida (m)")}
          <input type="number" min="0.01" max="500" step="0.01" value={medida} onChange={(e) => setMedida(e.target.value)} placeholder={t("optional", "opcional")} />
        </label>
        {motor && (
          <label>
            {t("Ground tilt along the shadow (°)", "Inclinación del suelo a lo largo de la sombra (°)")}
            <input type="number" min="-20" max="20" step="0.1" value={suelo} onChange={(e) => setSuelo(e.target.value)} placeholder="0" />
          </label>
        )}
        {motor && (
          <button className="btn" type="submit" disabled={estado === "calculando"}>
            {estado === "calculando" ? t("Asking the engine…", "Consultando al motor…") : t("Compute with the live engine", "Calcular con el motor en vivo")}
          </button>
        )}
      </form>
      <p className="muted">
        {motor
          ? t(
              `Place: ${resp?.lugar.nombre ?? idx?.campo.lugar.nombre ?? "Ciudad del Este"} (the team's measurement site). The engine computes the Sun for that exact minute with DE421 and atmospheric refraction.`,
              `Lugar: ${resp?.lugar.nombre ?? idx?.campo.lugar.nombre ?? "Ciudad del Este"} (el sitio de medición del equipo). El motor calcula el Sol de ese minuto exacto con DE421 y refracción atmosférica.`,
            )
          : t(
              "The live engine is not connected, so the app cannot compute the Sun for your time. Type the elevation from the team's measurement sheet; only the geometry is applied.",
              "El motor en vivo no está conectado, así que la app no puede calcular el Sol para tu hora. Escribe la altura de la planilla de medición del equipo; solo se aplica la geometría.",
            )}
      </p>
      {estado === "error" && (
        <p role="alert" className="notice">
          {error || t("The engine did not answer. Check that it is running.", "El motor no respondió. Comprueba que esté en marcha.")}
        </p>
      )}
      {calculada !== null && eVista !== null && (
        <div className="campo-resultado" aria-live="polite">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Side view of the board and its shadow, to scale", "Vista lateral de la tablita y su sombra, a escala")}>
            <line x1="10" x2={W - 10} y1={suelY} y2={suelY} className="suelo" />
            <rect x={x0 - 4} y={suelY - altoPx} width="8" height={altoPx} className="tablita" />
            <line x1={x0} y1={suelY - altoPx} x2={x0 + calculada * escala} y2={suelY} className="rayo" />
            <line x1={x0} x2={x0 + calculada * escala} y1={suelY + 8} y2={suelY + 8} className="calc" />
            <text x={x0 + (calculada * escala) / 2} y={suelY + 26} textAnchor="middle" className="eje">
              {t("computed", "calculada")} {num(calculada)} m
            </text>
            {medidaVista !== null && (
              <g>
                <line x1={x0 + medidaVista * escala} x2={x0 + medidaVista * escala} y1={suelY - 16} y2={suelY + 4} className="medida" />
                <text x={Math.min(W - 60, x0 + medidaVista * escala)} y={suelY - 22} textAnchor="middle" className="eje fuerte">
                  {t("measured", "medida")} {num(medidaVista)} m
                </text>
              </g>
            )}
          </svg>
          <div className="condiciones">
            <div className="nd">
              <strong>{num(eVista, 2)}°</strong>
              <span>{motor ? t("apparent Sun elevation (with refraction)", "altura aparente del Sol (con refracción)") : t("Sun elevation you typed", "altura del Sol que escribiste")}</span>
            </div>
            <div className="nd">
              <strong>{num(calculada)} m</strong>
              <span>{t("computed shadow: height ÷ tan(elevation)", "sombra calculada: alto ÷ tan(altura)")}</span>
            </div>
            {errorFrac !== null && (
              <div className={errorFrac <= meta ? "bien" : "mal"}>
                <strong>{num(100 * errorFrac, 1)} %</strong>
                <span>
                  {errorFrac <= meta
                    ? t(`difference · within the ${num(100 * meta, 0)} % goal`, `diferencia · dentro de la meta de ${num(100 * meta, 0)} %`)
                    : t(`difference · above the ${num(100 * meta, 0)} % goal`, `diferencia · por encima de la meta de ${num(100 * meta, 0)} %`)}
                </span>
              </div>
            )}
            {motor && resp?.prediccion.penumbra_m != null && (
              <div className="nd">
                <strong>{num(resp.prediccion.penumbra_m)} m</strong>
                <span>{t("fuzzy tip: measure to its middle", "punta difusa: mide hasta su mitad")}</span>
              </div>
            )}
          </div>
          {motor && resp && !resp.prediccion.en_rango_h2 && (
            <p className="muted">
              {t(
                `The 5 % goal is defined for a Sun between ${resp.prediccion.rango_h2_deg[0]}° and ${resp.prediccion.rango_h2_deg[1]}°; at this hour it is outside that range.`,
                `La meta del 5 % está definida para un Sol entre ${resp.prediccion.rango_h2_deg[0]}° y ${resp.prediccion.rango_h2_deg[1]}°; a esta hora está fuera de ese rango.`,
              )}
            </p>
          )}
          {motor &&
            resp?.comparacion?.avisos.map((a) => (
              <p className="muted" key={a} lang="es">
                {t("Engine note", "Aviso del motor")}: {a}
              </p>
            ))}
        </div>
      )}
      {motor && resp && resp.prediccion.sombra_m === null && (
        <p className="notice">
          {t(
            `At that time the Sun is at ${num(resp.prediccion.elevacion_aparente_deg, 1)}°: there is no shadow to measure.`,
            `A esa hora el Sol está a ${num(resp.prediccion.elevacion_aparente_deg, 1)}°: no hay sombra que medir.`,
          )}
        </p>
      )}
    </section>
  );
}
