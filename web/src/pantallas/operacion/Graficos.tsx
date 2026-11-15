/**
 * Charts of the 3D lab. Plain SVG, one y-axis per chart (small multiples share the time axis),
 * the cursor is the lab's clock: hovering a chart moves the Sun in the 3D scene.
 */
import { PointerEvent, ReactNode, useEffect, useMemo, useState } from "react";

export function useAncho<T extends HTMLElement>(): [(element: T | null) => void, number] {
  const [element, setElement] = useState<T | null>(null);
  const [ancho, setAncho] = useState(280);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setAncho(Math.max(120, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, ancho];
}

const M = { izq: 44, der: 12, arriba: 8, abajo: 4 };

export interface Linea {
  valores: number[];
  color: string;
  nombre: string;
  punteada?: boolean;
}
export interface PropsPista {
  titulo: string;
  lineas: Linea[];
  dominio: [number, number];
  marcas: number[];
  formato: (v: number) => string;
  referencia?: { valor: number; texto: string };
  /** Index ranges shaded as "not enough power / night". */
  franjas?: [number, number][];
  textoFranja?: string;
  i0: number;
  i1: number;
  paso: number;
  onPaso: (i: number) => void;
  ancho: number;
  alto?: number;
}

export function Pista(p: PropsPista) {
  const alto = p.alto ?? 118;
  const n = p.lineas[0].valores.length;
  const w = p.ancho - M.izq - M.der;
  const h = alto - M.arriba - M.abajo;
  const x = (i: number) => M.izq + (i / (n - 1)) * w;
  const y = (v: number) =>
    M.arriba + h - ((Math.min(p.dominio[1], Math.max(p.dominio[0], v)) - p.dominio[0]) / (p.dominio[1] - p.dominio[0])) * h;
  const trazos = useMemo(
    () =>
      p.lineas.map((l) => {
        let d = "";
        for (let i = 0; i < n; i++) d += `${i ? "L" : "M"}${x(i).toFixed(1)},${y(l.valores[i]).toFixed(1)}`;
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.lineas, p.ancho, alto, p.dominio[0], p.dominio[1]],
  );
  const mover = (ev: PointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const i = Math.round(((ev.clientX - r.left - M.izq) / w) * (n - 1));
    p.onPaso(Math.min(n - 1, Math.max(0, i)));
  };
  return (
    <div className="pista">
      <div className="pista-cabeza">
        <strong>{p.titulo}</strong>
        {p.lineas.length > 1 && (
          <span className="leyenda">
            {p.lineas.map((l) => (
              <span key={l.nombre}>
                <svg width="22" height="8" aria-hidden="true">
                  <line x1="0" y1="4" x2="22" y2="4" stroke={l.color} strokeWidth="2" strokeDasharray={l.punteada ? "4 3" : undefined} />
                </svg>
                {l.nombre}
              </span>
            ))}
            {p.textoFranja && (
              <span>
                <svg width="12" height="10" aria-hidden="true">
                  <rect width="12" height="10" className="franja" />
                </svg>
                {p.textoFranja}
              </span>
            )}
          </span>
        )}
      </div>
      <svg width={p.ancho} height={alto} onPointerMove={mover} onPointerDown={mover} role="presentation">
        <rect x={M.izq} y={M.arriba} width={w} height={h} className="lienzo" />
        {p.franjas?.map(([a, b]) => (
          <rect key={a} x={x(a)} y={M.arriba} width={Math.max(1, x(b) - x(a))} height={h} className="franja" />
        ))}
        <rect x={M.izq} y={M.arriba} width={x(p.i0) - M.izq} height={h} className="margen" />
        <rect x={x(p.i1)} y={M.arriba} width={M.izq + w - x(p.i1)} height={h} className="margen" />
        {p.marcas.map((v) => (
          <g key={v}>
            <line x1={M.izq} x2={M.izq + w} y1={y(v)} y2={y(v)} className="rejilla" />
            <text x={M.izq - 6} y={y(v) + 4} textAnchor="end" className="eje">
              {p.formato(v)}
            </text>
          </g>
        ))}
        {p.referencia && (
          <g>
            <line x1={M.izq} x2={M.izq + w} y1={y(p.referencia.valor)} y2={y(p.referencia.valor)} className="referencia" />
            <text x={M.izq + w - 4} y={y(p.referencia.valor) - 4} textAnchor="end" className="eje fuerte">
              {p.referencia.texto}
            </text>
          </g>
        )}
        {trazos.map((d, k) => (
          <path
            key={p.lineas[k].nombre}
            d={d}
            fill="none"
            stroke={p.lineas[k].color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeDasharray={p.lineas[k].punteada ? "4 3" : undefined}
          />
        ))}
        <line x1={x(p.paso)} x2={x(p.paso)} y1={M.arriba} y2={M.arriba + h} className="cursor" />
        {p.lineas.map((l) => (
          <circle key={l.nombre} cx={x(p.paso)} cy={y(l.valores[p.paso])} r="4" fill={l.color} className="punto" />
        ))}
      </svg>
    </div>
  );
}

export function EjeTiempo(p: { t0: number; pasoS: number; n: number; ancho: number; idioma: string }) {
  const w = p.ancho - M.izq - M.der;
  const dias: { i: number; texto: string }[] = [];
  const fmt = new Intl.DateTimeFormat(p.idioma, { day: "numeric", month: "short", timeZone: "UTC" });
  const cada = p.ancho < 520 ? 10 : 5;
  const primerDia = Math.ceil(p.t0 / 86400000) * 86400000;
  for (let t = primerDia, k = 0; ; t += 86400000, k++) {
    const i = (t - p.t0) / 1000 / p.pasoS;
    if (i > p.n - 1) break;
    if (k % cada === 0) dias.push({ i, texto: fmt.format(new Date(t)) });
  }
  return (
    <svg width={p.ancho} height={22} aria-hidden="true" className="eje-tiempo">
      {dias.map((d) => {
        const x = M.izq + (d.i / (p.n - 1)) * w;
        return (
          <g key={d.i}>
            <line x1={x} x2={x} y1={0} y2={5} className="rejilla" />
            <text x={x} y={17} textAnchor="middle" className="eje">
              {d.texto}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizon silhouette around the rover with the Sun's path over the period. */
export function PerfilCielo(p: {
  horizonte: number[] | null;
  conv: number;
  az: number[];
  el: number[];
  i0: number;
  i1: number;
  paso: number;
  ancho: number;
  textos: { norte: string; este: string; sur: string; oeste: string; sol: string; horizonte: string; liso: string };
  children?: ReactNode;
}) {
  const alto = 190;
  const m = { izq: 44, der: 12, arriba: 10, abajo: 24 };
  const w = p.ancho - m.izq - m.der;
  const h = alto - m.arriba - m.abajo;
  const dom: [number, number] = [-8, 12];
  const x = (az: number) => m.izq + (((az % 360) + 360) % 360 / 360) * w;
  const y = (e: number) => m.arriba + h - ((Math.min(dom[1], Math.max(dom[0], e)) - dom[0]) / (dom[1] - dom[0])) * h;
  const silueta = useMemo(() => {
    if (!p.horizonte) return null;
    const n = p.horizonte.length;
    // The profile is stored by grid azimuth; the chart uses geographic azimuth.
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) pts.push([((((k * 360) / n - p.conv) % 360) + 360) % 360, p.horizonte[k]]);
    pts.sort((a, b) => a[0] - b[0]);
    pts.push([360, pts[0][1]]);
    pts.unshift([0, pts[pts.length - 1][1]]);
    return `M${m.izq},${m.arriba + h}` + pts.map(([a, e]) => `L${x(a === 360 ? 359.999 : a).toFixed(1)},${y(e).toFixed(1)}`).join("") + `L${m.izq + w},${m.arriba + h}Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.horizonte, p.conv, p.ancho]);
  const camino = useMemo(() => {
    let d = "";
    let previo = -1;
    for (let i = p.i0; i < p.i1; i++) {
      const xi = x(p.az[i]);
      const salto = previo < 0 || Math.abs(xi - previo) > w / 2;
      d += `${salto ? "M" : "L"}${xi.toFixed(1)},${y(p.el[i]).toFixed(1)}`;
      previo = xi;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.az, p.el, p.i0, p.i1, p.ancho]);
  const rumbos: [number, string][] = [
    [0, p.textos.norte],
    [90, p.textos.este],
    [180, p.textos.sur],
    [270, p.textos.oeste],
  ];
  return (
    <div className="pista">
      <div className="pista-cabeza">
        <strong>{p.children}</strong>
        <span className="leyenda">
          <span>
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" stroke="var(--sol)" strokeWidth="2" />
            </svg>
            {p.textos.sol}
          </span>
          <span>
            <svg width="12" height="10" aria-hidden="true">
              <rect width="12" height="10" className="silueta" />
            </svg>
            {p.horizonte ? p.textos.horizonte : p.textos.liso}
          </span>
        </span>
      </div>
      <svg width={p.ancho} height={alto} role="presentation">
        <rect x={m.izq} y={m.arriba} width={w} height={h} className="lienzo" />
        {[-5, 0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={m.izq} x2={m.izq + w} y1={y(v)} y2={y(v)} className={v === 0 ? "referencia" : "rejilla"} />
            <text x={m.izq - 6} y={y(v) + 4} textAnchor="end" className="eje">
              {v}°
            </text>
          </g>
        ))}
        {rumbos.map(([a, txt]) => (
          <g key={a}>
            <line x1={x(a)} x2={x(a)} y1={m.arriba} y2={m.arriba + h} className="rejilla" />
            <text x={x(a) + (a === 0 ? 4 : 0)} y={alto - 7} textAnchor={a === 0 ? "start" : "middle"} className="eje">
              {txt}
            </text>
          </g>
        ))}
        {silueta && <path d={silueta} className="silueta" />}
        <path d={camino} fill="none" stroke="var(--sol)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(p.az[p.paso])} cy={y(p.el[p.paso])} r="6" fill="var(--sol)" className="punto" />
      </svg>
    </div>
  );
}
