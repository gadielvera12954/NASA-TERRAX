import React from 'react';
import { AlertTriangle, ShieldCheck, HelpCircle, XCircle } from 'lucide-react';

export interface SearchScreenProps {
  onSeleccionarParcela: (id: string) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({ onSeleccionarParcela }) => {
  const candidatas = [
    {
      id: 'P-07',
      coords: '36.41°S 69.20°W',
      nombre: 'Payunia Sector North / Malacara',
      etiqueta: 'With gaps',
      clase: 'huec',
      c: 0.82,
      e: 0.70,
      icon: HelpCircle,
    },
    {
      id: 'P-23',
      coords: '36.58°S 69.05°W',
      nombre: 'Payunia Central Lava Plateau',
      etiqueta: 'With gaps',
      clase: 'huec',
      c: 0.79,
      e: 0.68,
      icon: HelpCircle,
    },
    {
      id: 'P-12',
      coords: '36.30°S 68.92°W',
      nombre: 'Payunia East Flank',
      etiqueta: 'Not enough',
      clase: 'noal',
      c: 0.61,
      e: 0.55,
      icon: AlertTriangle,
    },
    {
      id: 'Control-1',
      coords: '84.60°S 31.00°E',
      nombre: 'Control: Mons Mouton crop',
      etiqueta: 'Sustained',
      clase: 'sost',
      c: 1.00,
      e: 1.00,
      icon: ShieldCheck,
    },
    {
      id: 'Control-2',
      coords: '20.10°S 61.20°W',
      nombre: 'Control: Médanos del Chaco (Vegetated)',
      etiqueta: 'Incompatible',
      clase: 'inco',
      c: 0.12,
      e: 0.88,
      icon: XCircle,
    },
  ];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Candidate Search · Argentina (Payunia Volcanic Field, Mendoza)
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 900 }}>
          Scanned 40 parcels at 60 m resolution.
        </h1>
        <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
          Positive and negative controls must land in their expected positions to validate our Wasserstein score ranking.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Side: Map with Candidates */}
        <div className="panel" style={{ padding: '12px' }}>
          <div style={{ position: 'relative', width: '100%', height: '380px', borderRadius: '2px', overflow: 'hidden' }}>
            <img
              src="/img/ui_tierra_top.png"
              alt="Satellite top-down elevation of Payunia"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Candidate Markers Overlay */}
            <svg
              viewBox="0 0 400 276"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              {/* Highlight bounding boxes */}
              <g fill="none" stroke="#E7F434" strokeWidth="1.8">
                <rect x="120" y="70" width="36" height="36" />
                <rect x="240" y="150" width="36" height="36" />
                <rect x="310" y="60" width="36" height="36" />
              </g>

              {/* Labels */}
              <g fill="#07173F" stroke="#E7F434" strokeWidth="1">
                <rect x="108" y="46" width="60" height="19" rx="2" />
                <rect x="228" y="126" width="60" height="19" rx="2" />
                <rect x="298" y="36" width="60" height="19" rx="2" />
              </g>

              <g fill="#FFFFFF" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="Overpass, Arial">
                <text x="138" y="60">P-07 ★</text>
                <text x="258" y="140">P-23</text>
                <text x="328" y="50">P-12</text>
              </g>
            </svg>

            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                background: 'rgba(7, 23, 63, 0.90)',
                border: '1px solid var(--borde-dark)',
                borderRadius: '2px',
                padding: '4px 8px',
                fontSize: '11px',
                fontFamily: 'var(--mono)',
                color: 'var(--sol)',
              }}
            >
              NASADEM 1 arc-second · 60m Grids
            </div>
          </div>
        </div>

        {/* Right Side: List of Candidates */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '10px' }}>
            Ranked Candidates & Verification Controls
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {candidatas.map((c) => {
              const IconComp = c.icon;
              return (
                <div
                  key={c.id}
                  onClick={() => onSeleccionarParcela(c.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '2px',
                    border: '1px solid var(--borde-dark)',
                    background: c.id === 'P-07' ? 'rgba(231, 244, 52, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                    borderColor: c.id === 'P-07' ? 'var(--sol)' : 'var(--borde-dark)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--tit)', fontWeight: 800, fontSize: '14px', color: 'var(--texto)' }}>
                        {c.id}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--sec-dark)' }}>
                        {c.coords}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--texto-sec)', marginTop: '2px' }}>
                      {c.nombre}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--sol)' }}>
                      C: {c.c.toFixed(2)}
                    </div>
                    <span className={`etq ${c.clase}`}>
                      <IconComp size={11} />
                      {c.etiqueta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{ marginTop: '14px', fontSize: '11px', color: 'var(--sec-dark)', lineHeight: 1.4 }}>
            Click on any candidate to inspect its complete Analog Card, compatibility bounds, and rehearsal timetable.
          </p>
        </div>
      </div>
    </div>
  );
};
