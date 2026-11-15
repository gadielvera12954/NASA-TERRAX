/**
 * Side-by-side comparison of up to three exported candidates or controls.
 * It only lays out what each exported card already says: it does not rescore or rerank.
 */
import { PointerEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/Language";
import { Goal, GoalPicker, siteName, Verdict } from "../../sistema/Catalogue";
import { Ficha } from "../../datos/contract";
import { readFicha, IndexEntry } from "../../datos/integration";
import { useAncho } from "./Graficos";
import BotonSI from "../../luz/BotonSI";

interface Propiedad {
  estado: string;
  peso: number;
  utilidad: number | null;
}
interface Cruda {
  id: string;
  nombre: string;
  etiqueta: string;
  record: Ficha;
  control?: string | null;
  maqueta: boolean;
  C: number | null;
  E: number;
  L: number;
  U: number;
  umbral?: number;
  requisitos: Record<string, { estado: string; valor: number; limite: number }>;
  propiedades: Record<string, Propiedad>;
  dimensiones: Record<string, { valor: string }>;
  luz_rasante?: {
    e_deg: number[];
    f_parcela: number[];
    f_referencia: number[];
  };
}
function detail(record: Ficha): Cruda {
  const raw = record.source as Partial<Cruda> | undefined;
  const properties = Object.entries(raw?.propiedades ?? {}).filter(
    ([, p]) =>
      p &&
      Number.isFinite(p.peso) &&
      (p.utilidad === null || Number.isFinite(p.utilidad)),
  );
  const curve = raw?.luz_rasante;
  const validCurve =
    curve &&
    [curve.e_deg, curve.f_parcela, curve.f_referencia].every(
      (a) =>
        Array.isArray(a) &&
        a.length > 1 &&
        a.length === curve.e_deg.length &&
        a.every(Number.isFinite),
    ) &&
    curve.e_deg.every((v, i) => i === 0 || v > curve.e_deg[i - 1]);
  return {
    ...record,
    record,
    nombre: record.lugar.nombre,
    propiedades: Object.fromEntries(properties),
    requisitos: Object.fromEntries(
      Object.entries(raw?.requisitos ?? {}).filter(
        ([, r]) => r && typeof r.estado === "string",
      ),
    ),
    dimensiones: Object.fromEntries(
      Object.entries(record.dimensiones).map(([key, valor]) => [
        key,
        { valor },
      ]),
    ),
    umbral: Number.isFinite(raw?.umbral) ? raw?.umbral : undefined,
    luz_rasante: validCurve ? curve : undefined,
  };
}
/** Fixed slots: a candidate keeps its colour and letter while it stays selected. */
const RANURAS = [
  { color: "var(--series-a)", letra: "A" },
  { color: "var(--series-b)", letra: "B" },
  { color: "var(--series-c)", letra: "C" },
];

function slots(indice: IndexEntry[], actual: string): (string | null)[] {
  const saved = new URLSearchParams(location.search).get("sites");
  const known = new Set(indice.map((entry) => entry.id));
  const defaults = [
    actual,
    ...indice.filter((c) => !c.control && c.id !== actual).map((c) => c.id),
  ]
    .filter((id) => known.has(id))
    .slice(0, 2);
  const ids = saved === null ? defaults : saved.split(",");
  return [0, 1, 2].map((k) =>
    known.has(ids[k]) && ids.indexOf(ids[k]) === k ? ids[k] : null,
  );
}
export default function Comparador({
  indice,
  actual,
  goal,
  changeGoal,
  openSite,
}: {
  indice: IndexEntry[];
  actual: string;
  goal: Goal;
  changeGoal: (g: Goal) => void;
  openSite: (id: string) => void;
}) {
  const { t, language } = useLanguage();
  const [ranuras, setRanuras] = useState(() => slots(indice, actual));
  const [fichas, setFichas] = useState<Record<string, Cruda | "error">>({});
  const [attempt, retry] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [ref, ancho] = useAncho<HTMLDivElement>();
  useEffect(() => {
    const url = new URL(location.href);
    if (url.hash === "#compare" && !url.searchParams.has("sites")) {
      url.searchParams.set("sites", ranuras.join(","));
      history.replaceState(null, "", url);
    }
  }, [ranuras]);
  useEffect(() => {
    const restore = () => setRanuras(slots(indice, actual));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [indice, actual]);
  useEffect(() => {
    let active = true;
    for (const id of ranuras) {
      if (!id) continue;
      readFicha(id)
        .then(detail)
        .then((f) => {
          if (active) setFichas((all) => ({ ...all, [id]: f }));
        })
        .catch(() => {
          if (active) setFichas((all) => ({ ...all, [id]: "error" }));
        });
    }
    return () => {
      active = false;
    };
  }, [ranuras, attempt]);
  const num = (v: number, d = 2) =>
    new Intl.NumberFormat(language, {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    }).format(v);
  const elegidas = ranuras
    .map((id, k) => ({ id, k, ficha: id ? fichas[id] : undefined }))
    .filter(
      (x): x is { id: string; k: number; ficha: Cruda } =>
        !!x.id && !!x.ficha && x.ficha !== "error",
    );
  const select = (k: number, id: string) => {
    const next = ranuras.map((v, i) => (i === k ? id || null : v));
    setRanuras(next);
    setCursor(null);
    const url = new URL(location.href);
    url.searchParams.set("sites", next.join(","));
    history.replaceState(null, "", url);
  };
  const propiedades: [string, string][] = [
    ["pendiente", t("Slope", "Pendiente")],
    ["luz_rasante", t("Grazing light", "Luz rasante")],
    ["rugosidad", t("Roughness", "Rugosidad")],
    ["material", t("Surface material", "Material superficial")],
    ["transitabilidad_fina", t("Fine traversability", "Transitabilidad fina")],
  ];
  const dimensiones: [string, string][] = [
    ["relieve", t("Terrain", "Relieve")],
    ["iluminacion", t("Light and shadows", "Luz y sombras")],
    ["operaciones_roboticas", t("Robotic operations", "Operaciones robóticas")],
    ["materiales", t("Materials", "Materiales")],
    ["temperatura", t("Temperature", "Temperatura")],
    ["agua_hielo", t("Water and ice", "Agua y hielo")],
    ["polvo_viento", t("Dust and wind", "Polvo y viento")],
    ["biologia", t("Biology", "Biología")],
  ];
  const estados: Record<string, string> = {
    Strong: t("Strong", "Fuerte"),
    Weak: t("Weak", "Débil"),
    Unknown: t("Unknown", "Desconocido"),
    "Not comparable": t("Not comparable", "No comparable"),
  };
  const focus =
    goal === "shadow"
      ? "iluminacion"
      : goal === "robot"
        ? "operaciones_roboticas"
        : "materiales";
  const pendingText = (record: Ficha) =>
    record.medir_primero
      .split("; ")
      .filter(Boolean)
      .map((v) =>
        v === "Surface material composition"
          ? t(v, "Composición del material superficial")
          : v === "Fine-scale traversability"
            ? t(v, "Transitabilidad a pequeña escala")
            : v === "Surface material composition, then rock distribution."
              ? t(
                  v,
                  "Composición del material superficial y luego distribución de las rocas.",
                )
              : v,
      )
      .join(" · ");
  // Grazing-light curve
  const conCurva = elegidas.filter((x) => x.ficha.luz_rasante);
  const curva = conCurva[0]?.ficha.luz_rasante;
  const alto = 230;
  const m = { izq: 44, der: 16, arriba: 12, abajo: 30 };
  const w = ancho - m.izq - m.der;
  const h = alto - m.arriba - m.abajo;
  const eMin = curva?.e_deg[0] ?? 1.5;
  const eMax = curva?.e_deg[curva.e_deg.length - 1] ?? 10;
  const yMax = useMemo(() => {
    let v = 0.2;
    for (const x of conCurva)
      for (const f of [
        ...x.ficha.luz_rasante!.f_parcela,
        ...x.ficha.luz_rasante!.f_referencia,
      ])
        v = Math.max(v, f);
    return Math.ceil(v * 5) / 5;
  }, [conCurva]);
  const px = (e: number) => m.izq + ((e - eMin) / (eMax - eMin)) * w;
  const py = (f: number) => m.arriba + h - (f / yMax) * h;
  const trazo = (es: number[], fs: number[]) =>
    es
      .map(
        (e, i) => `${i ? "L" : "M"}${px(e).toFixed(1)},${py(fs[i]).toFixed(1)}`,
      )
      .join("");
  const mover = (ev: PointerEvent<SVGSVGElement>) => {
    if (!curva) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const e = eMin + ((ev.clientX - r.left - m.izq) / w) * (eMax - eMin);
    let mejor = 0;
    curva.e_deg.forEach((v, i) => {
      if (Math.abs(v - e) < Math.abs(curva.e_deg[mejor] - e)) mejor = i;
    });
    setCursor(mejor);
  };

  return (
    <section className="comparador">
      <p className="lead">
        {t(
          "Read up to three exported records side by side. Compare the verdict, the conditions that matter for your rehearsal and the evidence still missing.",
          "Lee hasta tres fichas juntas. Compara el veredicto, las condiciones de tu ensayo y la evidencia que falta.",
        )}
      </p>
      <div className="comparison-setup">
        <GoalPicker goal={goal} change={changeGoal} />
        <div>
          <p className="muted">
            {t(
              "The goal highlights one dimension of the existing records. Scores are read directly from each file.",
              "El objetivo destaca una dimensión de las fichas existentes. Los puntajes provienen de cada archivo.",
            )}
          </p>
          <BotonSI
            texto={t(
              "Explain with SI: explain this comparison",
              "Explicar con SI: explicar esta comparación",
            )}
            disabled={!elegidas.length}
            pregunta={() => {
              const resumen = elegidas
                .map(
                  ({ id, ficha: f }) =>
                    `${id} (${siteName(f.nombre, t)}): C=${f.C === null ? t("unknown", "desconocido") : num(f.C)}, L–U=${num(f.L)}–${num(f.U)}, E=${num(f.E)}`,
                )
                .join("; ");
              return t(
                `Compare these candidate records for the "${goal}" rehearsal goal: ${resumen}. Which site fits best, why, and what must be measured first in the field?`,
                `Explica esta comparación para el objetivo de ensayo "${goal}": ${resumen}. ¿Qué sitio encaja mejor, por qué y qué hay que medir primero en el terreno?`,
              );
            }}
            contexto={() => ({
              pantalla: "compare",
              objetivo: goal,
              sitios: elegidas.map(({ id, ficha: f }) => ({
                id,
                nombre: f.nombre,
                etiqueta: f.etiqueta,
                C: f.C,
                E: f.E,
                L: f.L,
                U: f.U,
                medir_primero: f.record.medir_primero,
              })),
            })}
          />
        </div>
      </div>
      <div className="record-columns">
        {ranuras.map((id, k) => {
          const f = id ? fichas[id] : null;
          const control = indice.find((c) => c.id === id)?.control;
          return (
            <section className="record-column" key={k}>
              <label>
                <span className="slot-label">
                  <span
                    className="letra"
                    style={{ background: RANURAS[k].color }}
                  >
                    {RANURAS[k].letra}
                  </span>
                  {t("Comparison record", "Ficha para comparar")}
                </span>
                <select
                  value={id || ""}
                  onChange={(e) => select(k, e.target.value)}
                >
                  <option value="">
                    {t("Choose a record", "Elegir ficha")}
                  </option>
                  {[false, true].map((controlGroup) => (
                    <optgroup
                      key={String(controlGroup)}
                      label={
                        controlGroup
                          ? t("Scientific controls", "Controles científicos")
                          : t("Rehearsal sites", "Sitios de ensayo")
                      }
                    >
                      {indice
                        .filter((c) => !!c.control === controlGroup)
                        .map((c) => (
                          <option
                            key={c.id}
                            value={c.id}
                            disabled={c.id !== id && ranuras.includes(c.id)}
                          >
                            {siteName(c.nombre, t)}
                            {c.control ? " / " + c.id : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {f && f !== "error" ? (
                <>
                  <div className="record-tags">
                    <Verdict value={f.etiqueta} />
                    {f.maqueta && (
                      <span className="demo-tag">{t("Demo", "Demo")}</span>
                    )}
                  </div>
                  {control && (
                    <p className="muted">
                      {t(
                        "Method reference control",
                        "Control de referencia del método",
                      )}
                    </p>
                  )}
                  <dl>
                    <dt>{dimensiones.find(([key]) => key === focus)?.[1]}</dt>
                    <dd>
                      {estados[f.record.dimensiones[focus]] ??
                        t("Unknown", "Desconocido")}
                    </dd>
                    {goal !== "materials" && (
                      <>
                        <dt>
                          {goal === "shadow"
                            ? t(
                                "Grazing-light fit (0–1)",
                                "Ajuste de luz rasante (0–1)",
                              )
                            : t("Slope fit (0–1)", "Ajuste de pendiente (0–1)")}
                        </dt>
                        <dd>
                          {f.propiedades[
                            goal === "shadow" ? "luz_rasante" : "pendiente"
                          ]?.utilidad == null
                            ? t("Not measured", "Sin medir")
                            : num(
                                f.propiedades[
                                  goal === "shadow"
                                    ? "luz_rasante"
                                    : "pendiente"
                                ].utilidad!,
                              )}
                        </dd>
                      </>
                    )}
                    <dt>{t("Measure first", "Qué medir primero")}</dt>
                    <dd>
                      {pendingText(f.record) ||
                        t("No priority listed", "Sin prioridad indicada")}
                    </dd>
                  </dl>
                  <button className="text-btn" onClick={() => openSite(f.id)}>
                    {t("Open site record", "Abrir ficha")}
                  </button>
                </>
              ) : f === "error" ? (
                <p role="alert">
                  {t(
                    "This record could not be read.",
                    "No se pudo leer esta ficha.",
                  )}{" "}
                  <button
                    className="text-btn"
                    onClick={() => retry((n) => n + 1)}
                  >
                    {t("Retry", "Reintentar")}
                  </button>
                </p>
              ) : (
                <p className="muted" role="status">
                  {id
                    ? t("Loading record…", "Cargando ficha…")
                    : t(
                        "Choose a site or a reference control to add it here.",
                        "Elige un sitio o un control de referencia para añadirlo aquí.",
                      )}
                </p>
              )}
            </section>
          );
        })}
      </div>
      {!!elegidas.length && (
        <details className="panel technical">
          <summary>
            {t(
              "Compatibility, evidence and technical details",
              "Compatibilidad, evidencia y detalles técnicos",
            )}
          </summary>
          <p>
            {t(
              "C measures fit across known properties. It is not a similarity percentage. E is the weighted share with evidence, not the probability of success. L–U gives model limits, not a confidence interval.",
              "C mide el ajuste de las propiedades conocidas. No es un porcentaje de parecido. E es la cobertura ponderada de evidencia, no la probabilidad de acierto. L–U son límites del modelo, no un intervalo de confianza.",
            )}
          </p>
          <div className="carriles">
            {elegidas.map(({ id, k, ficha: f }) => (
              <div className="carril" key={id}>
                <div className="carril-nombre">
                  <span
                    className="letra"
                    style={{ background: RANURAS[k].color }}
                  >
                    {RANURAS[k].letra}
                  </span>
                  <span>
                    <strong>{id}</strong> · {siteName(f.nombre, t)}
                    {f.maqueta && (
                      <em className="maqueta"> {t("MOCK", "MAQUETA")}</em>
                    )}
                    <br />
                    <span className="muted">
                      <Verdict value={f.etiqueta} />
                    </span>
                  </span>
                </div>
                <div
                  className="carril-pista"
                  role="img"
                  aria-label={t(
                    `Compatibility ${f.C === null ? "unknown" : num(f.C)}, model bounds ${num(f.L)} to ${num(f.U)}, threshold ${f.umbral == null ? "—" : num(f.umbral)}`,
                    `Compatibilidad ${f.C === null ? "desconocida" : num(f.C)}, límites del modelo ${num(f.L)} a ${num(f.U)}, umbral ${f.umbral == null ? "—" : num(f.umbral)}`,
                  )}
                >
                  <i
                    className="rango"
                    style={{
                      left: `${100 * f.L}%`,
                      width: `${100 * (f.U - f.L)}%`,
                      background: RANURAS[k].color,
                    }}
                  />
                  {f.C !== null && (
                    <i
                      className="punto-c"
                      style={{
                        left: `${100 * f.C}%`,
                        borderColor: RANURAS[k].color,
                      }}
                    />
                  )}
                  {f.umbral != null && (
                    <i
                      className="umbral"
                      style={{ left: `${100 * f.umbral}%` }}
                    />
                  )}
                </div>
                <div className="carril-cifras mono">
                  C {f.C === null ? "—" : num(f.C)} · L–U {num(f.L)}–{num(f.U)}{" "}
                  · E {num(f.E)}
                </div>
              </div>
            ))}
            <p className="muted">
              {t(
                "Bar: worst case to best case (L–U) once the missing measurements are taken. Ring: compatibility with what is known (C). Vertical line: the threshold in the record. E is how much of the weight has evidence.",
                "Barra: del peor al mejor caso (L–U) cuando se hagan las mediciones que faltan. Aro: compatibilidad con lo conocido (C). Línea vertical: el umbral de la ficha. E es cuánto del peso tiene evidencia.",
              )}
            </p>
          </div>

          <h3>{t("Property by property", "Propiedad por propiedad")}</h3>
          <div className="tabla-scroll">
            <table className="tabla-comparar">
              <thead>
                <tr>
                  <th>{t("Property (weight)", "Propiedad (peso)")}</th>
                  {elegidas.map(({ id, k }) => (
                    <th key={id}>
                      <span
                        className="letra"
                        style={{ background: RANURAS[k].color }}
                      >
                        {RANURAS[k].letra}
                      </span>{" "}
                      {id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {propiedades.map(([clave, texto]) => (
                  <tr key={clave}>
                    <th scope="row">
                      {texto}
                      <span className="muted">
                        {" "}
                        ·{" "}
                        {elegidas[0]?.ficha.propiedades[clave]
                          ? num(
                              100 * elegidas[0].ficha.propiedades[clave].peso,
                              0,
                            ) + " %"
                          : t("Unknown", "Desconocido")}
                      </span>
                    </th>
                    {elegidas.map(({ id, k, ficha: f }) => {
                      const p = f.propiedades[clave];
                      return (
                        <td key={id}>
                          {p && p.utilidad !== null ? (
                            <span className="utilidad">
                              <span className="barra">
                                <i
                                  style={{
                                    width: `${100 * p.utilidad}%`,
                                    background: RANURAS[k].color,
                                  }}
                                />
                              </span>
                              <span className="mono">{num(p.utilidad)}</span>
                            </span>
                          ) : (
                            <span className="sin-medir">
                              {t("Not measured yet", "Aún sin medir")}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th scope="row">
                    {t("Essential requirements", "Requisitos indispensables")}
                  </th>
                  {elegidas.map(({ id, ficha: f }) => {
                    const fallas = Object.entries(f.requisitos ?? {}).filter(
                      ([, r]) => r.estado !== "cumple",
                    );
                    return (
                      <td key={id}>
                        {!Object.keys(f.requisitos).length
                          ? t("Not supplied", "Sin datos")
                          : fallas.length === 0
                            ? t("✓ Met", "✓ Cumple")
                            : fallas
                                .map(([nombreReq, r]) =>
                                  nombreReq === "vegetacion"
                                    ? t(
                                        `× Vegetation: NDVI ${num(r.valor)} (limit ${num(r.limite)})`,
                                        `× Vegetación: NDVI ${num(r.valor)} (límite ${num(r.limite)})`,
                                      )
                                    : t(
                                        `× Slope: ${num(r.valor, 1)}° (limit ${num(r.limite, 0)}°)`,
                                        `× Pendiente: ${num(r.valor, 1)}° (límite ${num(r.limite, 0)}°)`,
                                      ),
                                )
                                .join(" · ")}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted">
            {t(
              "Utility from 0 to 1: how close the candidate's distribution is to Mons Mouton for that property (F18). A property without measurement adds no utility and widens the L–U bar.",
              "Utilidad de 0 a 1: qué tan cerca está la distribución de la candidata de la de Mons Mouton en esa propiedad (F18). Una propiedad sin medición no suma utilidad y ensancha la barra L–U.",
            )}
          </p>

          {curva && (
            <>
              <h3>
                {t(
                  "How much terrain is in shadow as the Sun drops?",
                  "¿Cuánto terreno queda en sombra cuando baja el Sol?",
                )}
              </h3>
              <div className="pista-cabeza" ref={ref}>
                <span className="leyenda">
                  {conCurva.map(({ id, k }) => (
                    <span key={id}>
                      <svg width="22" height="8" aria-hidden="true">
                        <line
                          x1="0"
                          y1="4"
                          x2="22"
                          y2="4"
                          stroke={RANURAS[k].color}
                          strokeDasharray={
                            k === 1 ? "9 4" : k === 2 ? "2 4" : undefined
                          }
                          strokeWidth="2"
                        />
                      </svg>
                      {RANURAS[k].letra} · {id}
                    </span>
                  ))}
                  <span>
                    <svg width="22" height="8" aria-hidden="true">
                      <line
                        x1="0"
                        y1="4"
                        x2="22"
                        y2="4"
                        stroke="var(--texto-sec)"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                      />
                    </svg>
                    {t("Mons Mouton (reference)", "Mons Mouton (referencia)")}
                  </span>
                </span>
                <span className="mono lectura-reloj">
                  {cursor !== null &&
                    `${t("Sun", "Sol")} ${num(curva.e_deg[cursor], 1)}° · ${t("ref.", "ref.")} ${num(100 * curva.f_referencia[cursor], 0)} % · ` +
                      conCurva
                        .map(
                          ({ k, ficha: f }) =>
                            `${RANURAS[k].letra} ${num(100 * f.luz_rasante!.f_parcela[cursor], 0)} %`,
                        )
                        .join(" · ")}
                </span>
              </div>
              <svg
                width={ancho}
                height={alto}
                onPointerMove={mover}
                onPointerLeave={() => setCursor(null)}
                role="presentation"
                className="curva-luz"
              >
                <rect
                  x={m.izq}
                  y={m.arriba}
                  width={w}
                  height={h}
                  className="lienzo"
                />
                {Array.from(
                  { length: Math.round(yMax * 5) + 1 },
                  (_, i) => i / 5,
                ).map((v) => (
                  <g key={v}>
                    <line
                      x1={m.izq}
                      x2={m.izq + w}
                      y1={py(v)}
                      y2={py(v)}
                      className="rejilla"
                    />
                    <text
                      x={m.izq - 6}
                      y={py(v) + 4}
                      textAnchor="end"
                      className="eje"
                    >
                      {num(100 * v, 0)} %
                    </text>
                  </g>
                ))}
                {[2, 4, 6, 8, 10].map((e) => (
                  <text
                    key={e}
                    x={px(e)}
                    y={alto - 10}
                    textAnchor="middle"
                    className="eje"
                  >
                    {e}°
                  </text>
                ))}
                <path
                  d={trazo(curva.e_deg, curva.f_referencia)}
                  fill="none"
                  stroke="var(--texto-sec)"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
                {conCurva.map(({ id, k, ficha: f }) => (
                  <g key={id}>
                    <path
                      d={trazo(f.luz_rasante!.e_deg, f.luz_rasante!.f_parcela)}
                      fill="none"
                      stroke={RANURAS[k].color}
                      strokeDasharray={
                        k === 1 ? "9 4" : k === 2 ? "2 4" : undefined
                      }
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <text
                      x={px(f.luz_rasante!.e_deg[0]) + 6 + 14 * k}
                      y={py(f.luz_rasante!.f_parcela[0]) - 6}
                      className="eje fuerte"
                    >
                      {RANURAS[k].letra}
                    </text>
                  </g>
                ))}
                {cursor !== null && (
                  <g>
                    <line
                      x1={px(curva.e_deg[cursor])}
                      x2={px(curva.e_deg[cursor])}
                      y1={m.arriba}
                      y2={m.arriba + h}
                      className="cursor"
                    />
                    {conCurva.map(({ id, k, ficha: f }) => (
                      <circle
                        key={id}
                        cx={px(curva.e_deg[cursor])}
                        cy={py(f.luz_rasante!.f_parcela[cursor])}
                        r="4"
                        fill={RANURAS[k].color}
                        className="punto"
                      />
                    ))}
                  </g>
                )}
              </svg>
              <details>
                <summary>
                  {t("Shadow curve values", "Valores de las curvas de sombra")}
                </summary>
                {conCurva.map(({ id, ficha: f }) => (
                  <div className="tabla-scroll" key={id}>
                    <table className="tabla-comparar">
                      <caption>{id}</caption>
                      <thead>
                        <tr>
                          <th>
                            {t("Sun elevation (°)", "Elevación solar (°)")}
                          </th>
                          <th>
                            {t("Site shadow (%)", "Sombra del sitio (%)")}
                          </th>
                          <th>Mons Mouton (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.luz_rasante!.e_deg.map((e, i) => (
                          <tr key={e}>
                            <th>{num(e, 1)}</th>
                            <td>{num(f.luz_rasante!.f_parcela[i] * 100, 1)}</td>
                            <td>
                              {num(f.luz_rasante!.f_referencia[i] * 100, 1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </details>
              <p className="muted">
                {t(
                  "Horizontal: Sun elevation. Vertical: share of the plot in shadow. The closer a line follows the dashed one, the more the long shadows of that place resemble the lunar site.",
                  "Horizontal: altura del Sol. Vertical: parte de la parcela en sombra. Cuanto más sigue una línea a la punteada, más se parecen las sombras largas de ese lugar a las del sitio lunar.",
                )}
              </p>
            </>
          )}

          <h3>
            {t(
              "The eight dimensions of the challenge",
              "Las ocho dimensiones del desafío",
            )}
          </h3>
          <div className="tabla-scroll">
            <table className="tabla-comparar">
              <thead>
                <tr>
                  <th>{t("Dimension", "Dimensión")}</th>
                  {elegidas.map(({ id, k }) => (
                    <th key={id}>
                      <span
                        className="letra"
                        style={{ background: RANURAS[k].color }}
                      >
                        {RANURAS[k].letra}
                      </span>{" "}
                      {id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dimensiones.map(([clave, texto]) => (
                  <tr key={clave}>
                    <th scope="row">{texto}</th>
                    {elegidas.map(({ id, ficha: f }) => {
                      const v = f.dimensiones[clave]?.valor;
                      return (
                        <td key={id} className={`dim-${v}`}>
                          {estados[v] ?? v ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
