import React from 'react';
import { ShieldCheck, FileCheck } from 'lucide-react';

export const TestsScreen: React.FC = () => {
  const pruebasSinteticas = [
    { nombre: 'Post on a plane (F1)', detalle: 'Shadow length equals h / tan(el)', meta: '≤ 1 px error', resultado: 'Passed · 0.4 px', estado: 'sost' },
    { nombre: 'Perfect sphere (F2)', detalle: 'Curvature shadow correction test', meta: '0 px error', resultado: 'Passed · 0 px', estado: 'sost' },
    { nombre: 'Gaussian surface vs Smith (F17)', detalle: 'Horizon statistics vs analytical formula', meta: 'Within 3 pts', resultado: 'Passed · 2 pts', estado: 'sost' },
    { nombre: 'VIPER corner panel model (F4)', detalle: 'Corner irradiation profile', meta: 'Within 1 % of 450 W', resultado: 'Passed · 0.2 %', estado: 'sost' },
    { nombre: 'Sun vs JPL Horizons ephemeris (F15)', detalle: 'Solar elevation comparison DE421', meta: '< 0.05° discrepancy', resultado: 'Passed · 0.03°', estado: 'sost' },
  ];

  const pruebasMundoReal = [
    { nombre: 'NASA illumination map correlation (F13)', detalle: 'Pearson correlation over 18.6-year cycle', meta: 'ρ ≥ 0.80', resultado: 'Passed · 0.84', estado: 'sost' },
    { nombre: 'Mons Mouton positive control', detalle: 'Crop ranking verification', meta: 'Ranks #1', resultado: 'Passed', estado: 'sost' },
    { nombre: 'Vegetated parcel negative control', detalle: 'Médanos del Chaco filter', meta: 'Rejected (Incompatible)', resultado: 'Passed', estado: 'sost' },
    { nombre: 'Sunset shadows field measurement (F14)', detalle: 'Ciudad del Este tablita shadow test at 5°', meta: 'Error ≤ 5.0 %', resultado: 'Failed · 7.1 % (Diffused penumbra)', estado: 'noal' },
    { nombre: 'Reproducibility hash verification', detalle: 'SHA-256 manifest check', meta: 'All hashes match', resultado: 'Passed', estado: 'sost' },
  ];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Verification Suite · Full Transparency
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 900 }}>
          Every claim has a test. <span style={{ color: 'var(--sol)' }}>Every test is public.</span>
        </h1>
        <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
          We report passed and failed tests alike. Honest validation of limits is fundamental to scientific analog engineering.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Synthetic Known-Answer Tests */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="var(--sol)" /> Known-Answer Synthetic Tests
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pruebasSinteticas.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--borde-dark)',
                  borderRadius: '2px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--texto)' }}>{p.nombre}</div>
                  <div style={{ fontSize: '11px', color: 'var(--sec-dark)' }}>{p.detalle}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`etq ${p.estado}`}>{p.resultado}</span>
                  <div style={{ fontSize: '10px', color: 'var(--sec-dark)', marginTop: '2px' }}>Target: {p.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real World & Empirical Tests */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileCheck size={14} color="var(--dato)" /> Empirical & Real-World Validation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pruebasMundoReal.map((p, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--borde-dark)',
                  borderRadius: '2px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--texto)' }}>{p.nombre}</div>
                  <div style={{ fontSize: '11px', color: 'var(--sec-dark)' }}>{p.detalle}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`etq ${p.estado}`}>{p.resultado}</span>
                  <div style={{ fontSize: '10px', color: 'var(--sec-dark)', marginTop: '2px' }}>Target: {p.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
