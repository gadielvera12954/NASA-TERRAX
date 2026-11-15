import React, { useState } from 'react';
import { Download } from 'lucide-react';

export const FieldScreen: React.FC = () => {
  const [medidaIngresada, setMedidaIngresada] = useState<string>('5.72');
  const [resultadoCalc, setResultadoCalc] = useState<string | null>(null);

  const calcularError = () => {
    const val = parseFloat(medidaIngresada);
    if (isNaN(val)) return;
    const teorico = 5.72; // h = 0.50m / tan(5°) = 5.715m ≈ 5.72m
    const errorPct = Math.abs((val - teorico) / teorico) * 100;
    setResultadoCalc(`Measured: ${val.toFixed(2)} m · Expected theoretical: 5.72 m · Discrepancy: ${errorPct.toFixed(1)} %`);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Ground Calibration & Field Kit
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 600 }}>
          Sunset Shadow Ground Measurement Protocol
        </h1>
        <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
          On November 14 at 18:36 (Ciudad del Este), the Sun reaches exactly 5.0° elevation. A 50 cm vertical board casts a 5.72 m shadow.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Protocol Details */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '12px' }}>
            Equipment & Geometric Setup (F14)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="fila-dato">
              <span className="label">Target Date & Sunset Time</span>
              <span className="val" style={{ color: 'var(--sol)' }}>Nov 14, 2026 · 18:36 Local</span>
            </div>
            <div className="fila-dato">
              <span className="label">Solar Elevation Angle</span>
              <span className="val">5.00° (Grazing condition)</span>
            </div>
            <div className="fila-dato">
              <span className="label">Object Height (Vertical Board)</span>
              <span className="val">50.0 cm (0.50 m)</span>
            </div>
            <div className="fila-dato">
              <span className="label">Theoretical Shadow Length</span>
              <span className="val" style={{ color: 'var(--sol)' }}>5.72 m (h / tan(5°))</span>
            </div>
            <div className="fila-dato">
              <span className="label">Atmospheric Refraction Correction</span>
              <span className="val">+0.16° (Saemundsson formula F15)</span>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button className="btn sec" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={14} /> Download Field Observation Sheet (.pdf)
            </button>
          </div>
        </div>

        {/* Observation Logging Tool */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '12px' }}>
            Log Field Measurement
          </div>
          <p style={{ fontSize: '13px', color: 'var(--texto)', marginBottom: '14px' }}>
            Enter your ground tape measurement of the 50 cm board shadow:
          </p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="number"
              step="0.01"
              value={medidaIngresada}
              onChange={(e) => setMedidaIngresada(e.target.value)}
              style={{
                flex: 1,
                background: 'var(--paper)',
                border: '1px solid var(--borde-light)',
                borderRadius: '2px',
                color: 'var(--texto)',
                padding: '8px 12px',
                fontFamily: 'var(--mono)',
                fontSize: '14px',
              }}
              placeholder="e.g. 5.72"
            />
            <button onClick={calcularError} className="btn" style={{ padding: '8px 16px' }}>
              Verify
            </button>
          </div>

          {resultadoCalc && (
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--sol)',
                padding: '12px',
                borderRadius: '2px',
                fontFamily: 'var(--mono)',
                fontSize: '12px',
                color: 'var(--texto)',
              }}
            >
              {resultadoCalc}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
