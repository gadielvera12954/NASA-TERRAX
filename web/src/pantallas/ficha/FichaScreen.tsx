import React from 'react';
import { FranjaLimites } from '../../graficos/FranjaLimites';

export interface FichaScreenProps {
  candidataId?: string;
  onNavegarDosMundos: () => void;
}

export const FichaScreen: React.FC<FichaScreenProps> = ({
  candidataId = 'P-07',
  onNavegarDosMundos,
}) => {
  const dimensiones = [
    { nombre: 'Terrain, slope, roughness', estado: 'Strong', clase: 'sost' },
    { nombre: 'Illumination & grazing shadow', estado: 'Strong', clase: 'sost' },
    { nombre: 'Geology & materials', estado: 'Not comparable', clase: 'inco' },
    { nombre: 'Temperature extremes', estado: 'Weak', clase: 'noal' },
    { nombre: 'Water and ice', estado: 'Weak', clase: 'noal' },
    { nombre: 'Dust and wind', estado: 'Unknown', clase: 'nopo' },
    { nombre: 'Biology', estado: 'Weak', clase: 'noal' },
    { nombre: 'Robotic operations', estado: 'Strong', clase: 'sost' },
  ];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Open Analog Card · Evaluation Model
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 600 }}>
          Candidate <span style={{ color: 'var(--sol)' }}>{candidataId}</span> · Payunia Volcanic Field
        </h1>
        <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
          Compatibility and evidence evaluated separately. Never reduced to an arbitrary similarity percentage.
        </p>
      </div>

      {/* 3-column instrument layout from doc03_diseno */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', alignItems: 'stretch' }}>
        {/* Column 1: Scores and Bounds */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="et">Candidate {candidataId}</span>
              <span className="etq huec">With gaps</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '16px 0' }}>
              <div style={{ background: '#050E28', padding: '12px', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}>
                <span className="et">Compatibility (C)</span>
                <div className="cifra-grande" style={{ fontSize: '32px', color: 'var(--sol)' }}>
                  0.82
                </div>
              </div>
              <div style={{ background: '#050E28', padding: '12px', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}>
                <span className="et">Evidence (E)</span>
                <div className="cifra-grande" style={{ fontSize: '32px', color: 'var(--dato)' }}>
                  0.70
                </div>
              </div>
            </div>

            {/* Bounds Graphic Widget */}
            <div style={{ marginTop: '16px', background: '#050E28', padding: '12px', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}>
              <FranjaLimites c={0.82} e={0.70} l={0.574} u={0.874} ancho={320} />
            </div>

            <p style={{ fontSize: '13px', color: 'var(--texto)', lineHeight: 1.5, marginTop: '16px' }}>
              "Fits what we know. Measuring the surface material on the ground could change first place."
            </p>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button onClick={onNavegarDosMundos} className="btn" style={{ width: '100%' }}>
              Compare {candidataId} with Moon in Two Worlds
            </button>
          </div>
        </div>

        {/* Column 2: Challenge Dimensions */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '12px' }}>
            Analog Profile · 8 Challenge Dimensions
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {dimensiones.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: 'var(--texto)' }}>{d.nombre}</span>
                <span className={`etq ${d.clase}`} style={{ fontSize: '10px' }}>
                  {d.estado}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Rehearsal Window & Non-Transferables */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="et" style={{ marginBottom: '6px' }}>
              Rehearsal Window (Payunia, Argentina)
            </div>
            <h4 style={{ fontSize: '17px', color: 'var(--sol)', marginBottom: '4px' }}>
              19:41 to 20:12 (Local UTC-3)
            </h4>
            <div style={{ fontSize: '12px', color: 'var(--texto-sec)', marginBottom: '14px' }}>
              Sun altitude drops from 7.0° to 1.5° (Azimuth: 252° to 248° WSW)
            </div>

            <div style={{ borderTop: '1px solid var(--borde-dark)', paddingTop: '12px', marginBottom: '12px' }}>
              <span className="et" style={{ color: 'var(--error)' }}>
                Does Not Transfer to Earth
              </span>
              <p style={{ fontSize: '12px', color: 'var(--texto-sec)', marginTop: '4px', lineHeight: 1.4 }}>
                Solar power generation curves, sharp shadow contrast (presence of atmosphere), 1/6 g lunar gravity, electrostatic regolith adhesion.
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--borde-dark)', paddingTop: '12px' }}>
              <span className="et" style={{ color: 'var(--sol)' }}>
                Measure First in the Field
              </span>
              <p style={{ fontSize: '12px', color: 'var(--texto)', marginTop: '4px', lineHeight: 1.4 }}>
                1. Surface material grain size and basalt compaction.<br />
                2. Boulder distribution on slopes &gt; 15°.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button className="btn sec" style={{ flex: 1, fontSize: '12px' }}>
              Export PDF Card
            </button>
            <button className="btn sec" style={{ flex: 1, fontSize: '12px' }}>
              Field Kit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
