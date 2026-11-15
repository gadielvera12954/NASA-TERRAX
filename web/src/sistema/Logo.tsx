/**
 * The TERRA-X mark: Earth low over the lunar horizon, as it is seen from the south pole.
 *
 * Two shapes. The curve at the bottom is the Moon's horizon, lit from the left by a Sun that never
 * climbs above about 7° there: bright on the side facing it, falling into shadow on the other.
 * Above it, Earth, half lit by the same Sun. Practice on Earth, prepare for the Moon.
 * Same drawing as /favicon.svg.
 */
import { useId } from "react";

export function LogoMarca({ size = 36, fondo = false, titulo }: { size?: number; fondo?: boolean; titulo?: string }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg
      className="logo-marca"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      <defs>
        <linearGradient id={`luna-${u}`} x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#F1EEE7" />
          <stop offset="0.45" stopColor="#B9B4A9" />
          <stop offset="1" stopColor="#4E4B46" />
        </linearGradient>
        <linearGradient id={`tierra-${u}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8EC0F2" />
          <stop offset="0.5" stopColor="#3D78C2" />
          <stop offset="0.5" stopColor="#14243D" />
          <stop offset="1" stopColor="#0E1A2E" />
        </linearGradient>
        <clipPath id={`marco-${u}`}>
          <rect x="0" y="0" width="48" height="48" rx={fondo ? 11 : 0} />
        </clipPath>
      </defs>
      <g clipPath={`url(#marco-${u})`}>
        {fondo && <rect x="0" y="0" width="48" height="48" fill="#0E0F12" />}
        <circle cx="32" cy="22.5" r="6.5" fill={`url(#tierra-${u})`} />
        <circle cx="32" cy="22.5" r="6.5" fill="none" stroke="#9CC6F2" strokeOpacity="0.35" strokeWidth="0.8" />
        <circle cx="24" cy="96" r="64" fill={`url(#luna-${u})`} />
      </g>
      {fondo && <rect x="0.5" y="0.5" width="47" height="47" rx="10.5" fill="none" stroke="#ECEAE4" strokeOpacity="0.16" />}
    </svg>
  );
}

/** Wordmark: the mark and the name. */
export function Logotipo({ claro = false }: { claro?: boolean }) {
  return (
    <span className={claro ? "logotipo claro" : "logotipo"}>
      <LogoMarca size={38} fondo />
      <span className="logotipo-texto">
        TERRA<span className="logotipo-guion">-</span>
        <span className="logotipo-x">X</span>
      </span>
    </span>
  );
}
