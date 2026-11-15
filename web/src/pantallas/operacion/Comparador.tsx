/**
 * Side-by-side comparison of up to three exported candidates or controls.
 * It only lays out what each exported card already says: it does not rescore or rerank.
 */
import { PointerEvent, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/Language";
import { IndexEntry } from "../../datos/integration";
import { useAncho } from "./Graficos";
import { Marca } from "../../sistema/Marca";

interface Propiedad {
  estado: string;
  peso: number;
  utilidad: number | null;
}
interface Cruda {
  id: string;
  nombre: string;
  etiqueta: string;
  control: string | null;
  maqueta: boolean;
  C: number | null;
  E: number;
  L: number;
  U: number;
  umbral: number;
  requisitos: Record<string, { estado: string; valor: number; limite: number }>;
  propiedades: Record<string, Propiedad>;
  dimensiones: Record<string, { valor: string }>;
  luz_rasante?: { e_deg: number[]; f_parcela: number[]; f_referencia: number[] };
}
function esCruda(v: unknown): v is Cruda {
  const o = v as Cruda;
  return (
    !!o &&
    typeof o === "object" &&
    typeof o.id === "string" &&
    typeof o.nombre === "string" &&
    typeof o.L === "number" &&
    typeof o.U === "number" &&
    typeof o.umbral === "number" &&
    !!o.propiedades &&
    typeof o.propiedades === "object" &&
    Object.values(o.propiedades).every((p) => p && typeof p.peso === "number") &&
    !!o.dimensiones &&
    typeof o.dimensiones === "object"
  );
}

/** Fixed slots: a candidate keeps its colour and letter while it stays selected. */
const RANURAS = [
  { color: "#E7F434", letra: "A" },
  { color: "#2491FF", letra: "B" },
  { color: "#FF8A5B", letra: "C" },
];

export default function Comparador({ indice, actual }: { indice: IndexEntry[]; actual: string }) {
  const { t, language } = useLanguage();
  const [ranuras, setRanuras] = useState<(string | null)[]>([null, null, null]);
  const [fichas, setFichas] = useState<Record<string, Cruda | "error">>({});
  const [cursor, setCursor] = useState<number | null>(null);
  const [ref, ancho] = useAncho<HTMLDivElement>();

  // Start with the open candidate next to the positive control (the lunar site against itself).
  useEffect(() => {
    if (!indice.length) return;
    const ids = indice.map((c) => c.id);
    const inicio = [ids.includes(actual) ? actual : ids[0]];
    for (const id of ["CTRL-MM", ...ids]) if (inicio.length < 2 && !inicio.includes(id) && ids.includes(id)) inicio.push(id);
    setRanuras([inicio[0] ?? null, inicio[1] ?? null, null]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice]);

  useEffect(() => {
    for (const id of ranuras) {
      if (!id || fichas[id]) continue;
      fetch(`/data/fichas/${id}.json`, { cache: "no-cache" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((v) => setFichas((f) => ({ ...f, [id]: esCruda(v) ? v : "error" })))
        .catch(() => setFichas((f) => ({ ...f, [id]: "error" })));
    }
  }, [ranuras, fichas]);

  const num = (v: number, d = 2) => new Intl.NumberFormat(language, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v);
  const elegidas = ranuras
    .map((id, k) => ({ id, k, ficha: id ? fichas[id] : undefined }))
    .filter((x): x is { id: string; k: number; ficha: Cruda } => !!x.id && !!x.ficha && x.ficha !== "error");
  const alternar = (id: string) =>
    setRanuras((r) => {
      if (r.includes(id)) return r.map((x) => (x === id ? null : x));
      const libre = r.indexOf(null);
      if (libre < 0) return r;
      const copia = [...r];
      copia[libre] = id;
      return copia;
    });

  const veredictos: Record<string, string> = {
    analogo_sostenido: t("Supported", "Respaldado"),
    con_huecos: t("With gaps", "Con vacíos"),
    no_alcanza: t("Insufficient", "Insuficiente"),
    no_podemos_concluir: t("Cannot conclude", "No se puede concluir"),
    incompatible: t("Incompatible", "Incompatible"),
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
    fuerte: t("Strong", "Fuerte"),
    debil: t("Weak", "Débil"),
    desconocido: t("Unknown", "Desconocido"),
    no_comparable: t("Not comparable", "No comparable"),
  };
  const nombre = (f: Cruda) => f.nombre.replace(" (maqueta)", "");

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
    for (const x of conCurva) for (const f of [...x.ficha.luz_rasante!.f_parcela, ...x.ficha.luz_rasante!.f_referencia]) v = Math.max(v, f);
    return Math.ceil(v * 5) / 5;
  }, [conCurva]);
  const px = (e: number) => m.izq + ((e - eMin) / (eMax - eMin)) * w;
  const py = (f: number) => m.arriba + h - (f / yMax) * h;
  const trazo = (es: number[], fs: number[]) => es.map((e, i) => `${i ? "L" : "M"}${px(e).toFixed(1)},${py(fs[i]).toFixed(1)}`).join("");
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

  if (!indice.length)
    return (
      <section className="panel comparador">
        <h2>{t("Compare candidates side by side", "Compara candidatas lado a lado")}</h2>
        <p className="muted">
          {t("The candidate index is not available, so there is nothing to compare yet.", "El índice de candidatas no está disponible; todavía no hay qué comparar.")}
        </p>
      </section>
    );

  return (
    <section className="panel comparador" ref={ref}>
      <h2>{t("Compare candidates side by side", "Compara candidatas lado a lado")}</h2>
      <p>
        {t(
          "Pick up to three. The controls are there on purpose: the lunar site compared with itself must come first, and a dune field must be rejected.",
          "Elige hasta tres. Los controles están a propósito: el sitio lunar comparado consigo mismo debe quedar primero y un campo de médanos debe ser rechazado.",
        )}
      </p>
      <div className="selector" role="group" aria-label={t("Candidates to compare", "Candidatas para comparar")}>
        {indice.map((c) => {
          const k = ranuras.indexOf(c.id);
          return (
            <button key={c.id} aria-pressed={k >= 0} onClick={() => alternar(c.id)} disabled={k < 0 && !ranuras.includes(null)}>
              {k >= 0 && (
                <span className="letra" style={{ background: RANURAS[k].color }}>
                  {RANURAS[k].letra}
                </span>
              )}
              {c.id}
            </button>
          );
        })}
      </div>
      {elegidas.some((x) => x.ficha.maqueta) && (
        <p className="aviso-maqueta">
          {t(
            "Cards marked MOCK hold example values, not validated results. The comparison shows how the method works.",
            "Las fichas marcadas MAQUETA tienen valores de ejemplo, no resultados validados. La comparación muestra cómo funciona el método.",
          )}
        </p>
      )}

      <h3>{t("How well does each one fit?", "¿Qué tan bien encaja cada una?")}</h3>
      <div className="carriles">
        {elegidas.map(({ id, k, ficha: f }) => (
          <div className="carril" key={id}>
            <div className="carril-nombre">
              <span className="letra" style={{ background: RANURAS[k].color }}>
                {RANURAS[k].letra}
              </span>
              <span>
                <strong>{id}</strong> · {nombre(f)}
                {f.maqueta && <em className="maqueta"> {t("MOCK", "MAQUETA")}</em>}
                <br />
                <span className="muted marca-linea">
                  <Marca tono={f.etiqueta} size={13} />
                  {veredictos[f.etiqueta] ?? f.etiqueta}
                </span>
              </span>
            </div>
            <div className="carril-pista" role="img" aria-label={t(
              `Compatibility ${f.C === null ? "unknown" : num(f.C)}, model bounds ${num(f.L)} to ${num(f.U)}, threshold ${num(f.umbral)}`,
              `Compatibilidad ${f.C === null ? "desconocida" : num(f.C)}, límites del modelo ${num(f.L)} a ${num(f.U)}, umbral ${num(f.umbral)}`,
            )}>
              <i className="rango" style={{ left: `${100 * f.L}%`, width: `${100 * (f.U - f.L)}%`, background: RANURAS[k].color }} />
              {f.C !== null && <i className="punto-c" style={{ left: `${100 * f.C}%`, borderColor: RANURAS[k].color }} />}
              <i className="umbral" style={{ left: `${100 * f.umbral}%` }} />
            </div>
            <div className="carril-cifras mono">
              C {f.C === null ? "—" : num(f.C)} · L–U {num(f.L)}–{num(f.U)} · E {num(f.E)}
            </div>
          </div>
        ))}
        <p className="muted">
          {t(
            "Bar: worst case to best case (L–U) once the missing measurements are taken. Ring: compatibility with what is known (C). White line: the 0.70 threshold. E is how much of the weight has evidence.",
            "Barra: del peor al mejor caso (L–U) cuando se hagan las mediciones que faltan. Aro: compatibilidad con lo conocido (C). Línea blanca: el umbral de 0,70. E es cuánto del peso tiene evidencia.",
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
                  <span className="letra" style={{ background: RANURAS[k].color }}>
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
                  <span className="muted"> · {num(100 * (elegidas[0]?.ficha.propiedades[clave]?.peso ?? 0), 0)} %</span>
                </th>
                {elegidas.map(({ id, k, ficha: f }) => {
                  const p = f.propiedades[clave];
                  return (
                    <td key={id}>
                      {p && p.utilidad !== null ? (
                        <span className="utilidad">
                          <span className="barra">
                            <i style={{ width: `${100 * p.utilidad}%`, background: RANURAS[k].color }} />
                          </span>
                          <span className="mono">{num(p.utilidad)}</span>
                        </span>
                      ) : (
                        <span className="sin-medir">{t("Not measured yet", "Aún sin medir")}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">{t("Essential requirements", "Requisitos indispensables")}</th>
              {elegidas.map(({ id, ficha: f }) => {
                const fallas = Object.entries(f.requisitos ?? {}).filter(([, r]) => r.estado !== "cumple");
                return (
                  <td key={id}>
                    <span className="marca-linea">
                      <Marca tono={fallas.length === 0 ? "ok" : "mal"} size={13} />
                      {fallas.length === 0
                        ? t("Met", "Cumple")
                        : fallas
                            .map(([nombreReq, r]) =>
                              nombreReq === "vegetacion"
                                ? t(`Vegetation: NDVI ${num(r.valor)} (limit ${num(r.limite)})`, `Vegetación: NDVI ${num(r.valor)} (límite ${num(r.limite)})`)
                                : t(`Slope: ${num(r.valor, 1)}° (limit ${num(r.limite, 0)}°)`, `Pendiente: ${num(r.valor, 1)}° (límite ${num(r.limite, 0)}°)`),
                            )
                            .join(" · ")}
                    </span>
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
          <h3>{t("How much terrain is in shadow as the Sun drops?", "¿Cuánto terreno queda en sombra cuando baja el Sol?")}</h3>
          <div className="pista-cabeza">
            <span className="leyenda">
              {conCurva.map(({ id, k }) => (
                <span key={id}>
                  <svg width="22" height="8" aria-hidden="true">
                    <line x1="0" y1="4" x2="22" y2="4" stroke={RANURAS[k].color} strokeWidth="2" />
                  </svg>
                  {RANURAS[k].letra} · {id}
                </span>
              ))}
              <span>
                <svg width="22" height="8" aria-hidden="true">
                  <line x1="0" y1="4" x2="22" y2="4" stroke="var(--texto-sec)" strokeWidth="2" strokeDasharray="4 3" />
                </svg>
                {t("Mons Mouton (reference)", "Mons Mouton (referencia)")}
              </span>
            </span>
            <span className="mono lectura-reloj">
              {cursor !== null &&
                `${t("Sun", "Sol")} ${num(curva.e_deg[cursor], 1)}° · ${t("ref.", "ref.")} ${num(100 * curva.f_referencia[cursor], 0)} % · ` +
                  conCurva.map(({ k, ficha: f }) => `${RANURAS[k].letra} ${num(100 * f.luz_rasante!.f_parcela[cursor], 0)} %`).join(" · ")}
            </span>
          </div>
          <svg width={ancho} height={alto} onPointerMove={mover} onPointerLeave={() => setCursor(null)} role="presentation" className="curva-luz">
            <rect x={m.izq} y={m.arriba} width={w} height={h} className="lienzo" />
            {Array.from({ length: Math.round(yMax * 5) + 1 }, (_, i) => i / 5).map((v) => (
              <g key={v}>
                <line x1={m.izq} x2={m.izq + w} y1={py(v)} y2={py(v)} className="rejilla" />
                <text x={m.izq - 6} y={py(v) + 4} textAnchor="end" className="eje">
                  {num(100 * v, 0)} %
                </text>
              </g>
            ))}
            {[2, 4, 6, 8, 10].map((e) => (
              <text key={e} x={px(e)} y={alto - 10} textAnchor="middle" className="eje">
                {e}°
              </text>
            ))}
            <path d={trazo(curva.e_deg, curva.f_referencia)} fill="none" stroke="var(--texto-sec)" strokeWidth="2" strokeDasharray="4 3" />
            {conCurva.map(({ id, k, ficha: f }) => (
              <g key={id}>
                <path d={trazo(f.luz_rasante!.e_deg, f.luz_rasante!.f_parcela)} fill="none" stroke={RANURAS[k].color} strokeWidth="2" strokeLinejoin="round" />
                <text x={px(f.luz_rasante!.e_deg[0]) + 6 + 14 * k} y={py(f.luz_rasante!.f_parcela[0]) - 6} className="eje fuerte">
                  {RANURAS[k].letra}
                </text>
              </g>
            ))}
            {cursor !== null && (
              <g>
                <line x1={px(curva.e_deg[cursor])} x2={px(curva.e_deg[cursor])} y1={m.arriba} y2={m.arriba + h} className="cursor" />
                {conCurva.map(({ id, k, ficha: f }) => (
                  <circle key={id} cx={px(curva.e_deg[cursor])} cy={py(f.luz_rasante!.f_parcela[cursor])} r="4" fill={RANURAS[k].color} className="punto" />
                ))}
              </g>
            )}
          </svg>
          <p className="muted">
            {t(
              "Horizontal: Sun elevation. Vertical: share of the plot in shadow. The closer a line follows the dashed one, the more the long shadows of that place resemble the lunar site.",
              "Horizontal: altura del Sol. Vertical: parte de la parcela en sombra. Cuanto más sigue una línea a la punteada, más se parecen las sombras largas de ese lugar a las del sitio lunar.",
            )}
          </p>
        </>
      )}

      <h3>{t("The eight dimensions of the challenge", "Las ocho dimensiones del desafío")}</h3>
      <div className="tabla-scroll">
        <table className="tabla-comparar">
          <thead>
            <tr>
              <th>{t("Dimension", "Dimensión")}</th>
              {elegidas.map(({ id, k }) => (
                <th key={id}>
                  <span className="letra" style={{ background: RANURAS[k].color }}>
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
    </section>
  );
}
