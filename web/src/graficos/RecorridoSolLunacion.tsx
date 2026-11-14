import React, { useState } from 'react';

export interface RecorridoSolLunacionProps {
  ancho?: number;
  alto?: number;
}

export const RecorridoSolLunacion: React.FC<RecorridoSolLunacionProps> = ({
  ancho = 520,
  alto = 180,
}) => {
  const [temporada, setTemporada] = useState<'verano' | 'invierno' | 'ambas'>('verano');

  const padLeft = 36;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 30;
  const graphW = ancho - padLeft - padRight;
  const graphH = alto - padTop - padBottom;

  // 29.5 days = 708 hours
  const totalHoras = 708;
  const minAlt = -8.0;
  const maxAlt = 8.0;

  const sx = (h: number) => padLeft + (h / totalHoras) * graphW;
  const sy = (alt: number) => padTop + (1 - (alt - minAlt) / (maxAlt - minAlt)) * graphH;

  // Generate solar elevation curve for a lunation (sine wave with axial precession tilt)
  const generateCurve = (picoMax: number, picoMin: number, phase: number) => {
    let pts: [number, number][] = [];
    const steps = 140;
    for (let i = 0; i <= steps; i++) {
      const h = (i / steps) * totalHoras;
      const angle = (h / totalHoras) * 2 * Math.PI + phase;
      const alt = ((picoMax - picoMin) / 2) * Math.sin(angle) + (picoMax + picoMin) / 2;
      pts.push([sx(h), sy(alt)]);
    }
    return 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
  };

  // Summer: Oct 27 - Nov 26, 2027 (Peak: +6.94°, Min: -4.07°, longest full night touching it: 298 h, flat horizon)
  const veranoPath = generateCurve(6.94, -4.07, 0);

  // Winter: May 03 - Jun 01, 2027 (Peak: +3.87°, Min: -6.93°, longest full night touching it: 418 h, flat horizon)
  const inviernoPath = generateCurve(3.87, -6.93, 0.4);

  const yZero = sy(0);

  return (
    <div style={{ width: ancho, fontFamily: 'var(--txt)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--sec-dark)', textTransform: 'uppercase' }}>
          Solar Elevation over 29.5-day Lunation · Mons Mouton
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setTemporada('verano')}
            className={`btn ${temporada === 'verano' ? '' : 'sec'}`}
            style={{ padding: '2px 8px', fontSize: '10px' }}
          >
            Summer (Peak 6.94°)
          </button>
          <button
            onClick={() => setTemporada('invierno')}
            className={`btn ${temporada === 'invierno' ? '' : 'sec'}`}
            style={{ padding: '2px 8px', fontSize: '10px' }}
          >
            Winter (Peak 3.87°)
          </button>
          <button
            onClick={() => setTemporada('ambas')}
            className={`btn ${temporada === 'ambas' ? '' : 'sec'}`}
            style={{ padding: '2px 8px', fontSize: '10px' }}
          >
            Compare Both
          </button>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', height: 'auto', display: 'block', background: '#091A42', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}
      >
        {/* Shaded darkness zone (under 0° horizon) */}
        <rect
          x={padLeft}
          y={yZero}
          width={graphW}
          height={padTop + graphH - yZero}
          fill="rgba(7, 23, 63, 0.75)"
        />

        {/* 0° Horizon Baseline */}
        <line
          x1={padLeft}
          y1={yZero}
          x2={padLeft + graphW}
          y2={yZero}
          stroke="var(--sol)"
          strokeWidth="1.2"
        />
        <text
          x={padLeft - 6}
          y={yZero + 3}
          fill="var(--sol)"
          fontSize="9"
          fontFamily="var(--mono)"
          fontWeight="700"
          textAnchor="end"
        >
          0°
        </text>

        {/* Altitude guidelines: +6°, +4°, -4°, -6° */}
        {[6, 4, -4, -6].map((deg) => (
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
              {deg > 0 ? `+${deg}°` : `${deg}°`}
            </text>
          </g>
        ))}

        {/* Day markers along the 29.5 day cycle */}
        {[0, 7, 14, 21, 29.5].map((day) => {
          const hours = day * 24;
          return (
            <g key={day}>
              <line
                x1={sx(hours)}
                y1={padTop}
                x2={sx(hours)}
                y2={padTop + graphH}
                stroke="#162955"
                strokeWidth="1"
              />
              <text
                x={sx(hours)}
                y={padTop + graphH + 16}
                fill="var(--sec-dark)"
                fontSize="9"
                fontFamily="var(--mono)"
                textAnchor="middle"
              >
                Day {day}
              </text>
            </g>
          );
        })}

        {/* Summer Curve */}
        {(temporada === 'verano' || temporada === 'ambas') && (
          <path
            d={veranoPath}
            fill="none"
            stroke="var(--sol)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}

        {/* Winter Curve */}
        {(temporada === 'invierno' || temporada === 'ambas') && (
          <path
            d={inviernoPath}
            fill="none"
            stroke="#2491FF"
            strokeWidth="2.2"
            strokeDasharray={temporada === 'ambas' ? '4,3' : undefined}
            strokeLinecap="round"
          />
        )}

        {/* Critical Darkness Warning Annotation */}
        <rect
          x={padLeft + 12}
          y={padTop + graphH - 26}
          width={185}
          height={20}
          fill="rgba(139, 10, 3, 0.45)"
          stroke="var(--alerta)"
          strokeWidth="1"
          rx="2"
        />
        <text
          x={padLeft + 18}
          y={padTop + graphH - 13}
          fill="#FCA5A5"
          fontSize="9"
          fontFamily="var(--mono)"
          fontWeight="700"
        >
          {temporada === 'verano' ? '298 h NIGHT, FLAT HORIZON (SUMMER)' : '418 h NIGHT, FLAT HORIZON (WINTER)'}
        </text>
      </svg>
    </div>
  );
};
