import React, { useMemo } from 'react';
import { useSol } from '../luz/SolContext';

export interface PerfilHorizonteProps {
  ancho?: number;
  alto?: number;
  sitio?: string;
}

export const PerfilHorizonte: React.FC<PerfilHorizonteProps> = ({
  ancho = 520,
  alto = 160,
  sitio = 'Mons Mouton Plateau (85.5°S, 31.4°E)',
}) => {
  const { elevacion, azimut } = useSol();

  // Synthetic 72 azimuth angles (every 5° from 0° to 355°)
  const horizonAngles = useMemo(() => {
    const angles: { az: number; alt: number }[] = [];
    for (let i = 0; i < 72; i++) {
      const az = i * 5;
      const rad = (az * Math.PI) / 180;
      // Realistic lunar rim elevations: saddles at 1.8° - 2.5°, peaks rising to 5.8° - 6.8°
      const alt =
        3.2 +
        Math.sin(rad * 2 + 0.4) * 1.8 +
        Math.cos(rad * 4 - 0.2) * 0.9 +
        Math.sin(rad * 7) * 0.4;
      angles.push({ az, alt: Math.max(0.5, Math.min(8.0, alt)) });
    }
    return angles;
  }, []);

  const padLeft = 36;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 26;
  const graphW = ancho - padLeft - padRight;
  const graphH = alto - padTop - padBottom;

  // Scale functions
  const maxAlt = 8.0;
  const sx = (az: number) => padLeft + (az / 360) * graphW;
  const sy = (alt: number) => padTop + (1 - alt / maxAlt) * graphH;

  // SVG points for polygon
  const pathD = useMemo(() => {
    let d = `M ${padLeft} ${padTop + graphH}`;
    horizonAngles.forEach((pt) => {
      d += ` L ${sx(pt.az).toFixed(1)} ${sy(pt.alt).toFixed(1)}`;
    });
    // Complete loop
    d += ` L ${padLeft + graphW} ${sy(horizonAngles[0].alt).toFixed(1)}`;
    d += ` L ${padLeft + graphW} ${padTop + graphH} Z`;
    return d;
  }, [horizonAngles, graphW, graphH]);

  // Current horizon obstruction at current azimuth
  const currentHorizonIdx = Math.floor(azimut / 5) % 72;
  const currentObstruction = horizonAngles[currentHorizonIdx]?.alt || 3.0;
  const isSunVisible = elevacion >= currentObstruction;

  const sunX = sx(azimut);
  const sunY = sy(elevacion);

  return (
    <div style={{ width: ancho, fontFamily: 'var(--txt)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          fontSize: '11px',
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--sec-dark)', textTransform: 'uppercase' }}>
          360° Horizon Obstruction Profile · {sitio}
        </span>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '11px',
            fontWeight: 700,
            color: isSunVisible ? '#34D399' : '#F87171',
            background: isSunVisible ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isSunVisible ? '#10B981' : '#EF4444'}`,
            padding: '2px 6px',
            borderRadius: '2px',
          }}
        >
          {isSunVisible ? 'SUN DIRECTLY VISIBLE' : 'OCCULTED BY CRATER RIM'}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', height: 'auto', display: 'block', background: '#091A42', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}
      >
        {/* Grid lines for altitude: 2°, 4°, 6°, 8° */}
        {[2, 4, 6, 8].map((deg) => (
          <g key={deg}>
            <line
              x1={padLeft}
              y1={sy(deg)}
              x2={padLeft + graphW}
              y2={sy(deg)}
              stroke="#1E3160"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <text
              x={padLeft - 6}
              y={sy(deg) + 3}
              fill="var(--sec-dark)"
              fontSize="9"
              fontFamily="var(--mono)"
              textAnchor="end"
            >
              {deg}°
            </text>
          </g>
        ))}

        {/* Azimuth tick markers: N (0°), E (90°), S (180°), W (270°), N (360°) */}
        {[
          { az: 0, label: 'N (0°)' },
          { az: 90, label: 'E (90°)' },
          { az: 180, label: 'S (180°)' },
          { az: 270, label: 'W (270°)' },
          { az: 360, label: 'N (360°)' },
        ].map((tick) => (
          <g key={tick.az}>
            <line
              x1={sx(tick.az)}
              y1={padTop}
              x2={sx(tick.az)}
              y2={padTop + graphH}
              stroke="#162955"
              strokeWidth="1"
            />
            <text
              x={sx(tick.az)}
              y={padTop + graphH + 15}
              fill="var(--sec-dark)"
              fontSize="9"
              fontFamily="var(--mono)"
              textAnchor="middle"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Horizon Terrain Silhouette fill */}
        <path d={pathD} fill="#142C66" stroke="#2491FF" strokeWidth="1.5" />

        {/* Global Sun Elevation horizontal bar */}
        <line
          x1={padLeft}
          y1={sunY}
          x2={padLeft + graphW}
          y2={sunY}
          stroke="rgba(231, 244, 52, 0.45)"
          strokeWidth="1"
          strokeDasharray="3,3"
        />

        {/* Current Sun position marker */}
        <line
          x1={sunX}
          y1={padTop}
          x2={sunX}
          y2={padTop + graphH}
          stroke="var(--sol)"
          strokeWidth="1.2"
        />
        <circle
          cx={sunX}
          cy={sunY}
          r="5"
          fill="var(--sol)"
          stroke="#07173F"
          strokeWidth="1.5"
          style={{ filter: 'drop-shadow(0 0 6px var(--sol))' }}
        />
        <text
          x={Math.min(padLeft + graphW - 35, Math.max(padLeft + 35, sunX))}
          y={sunY - 8}
          fill="var(--sol)"
          fontSize="9"
          fontFamily="var(--mono)"
          fontWeight="700"
          textAnchor="middle"
        >
          {elevacion.toFixed(1)}°
        </text>
      </svg>
    </div>
  );
};
