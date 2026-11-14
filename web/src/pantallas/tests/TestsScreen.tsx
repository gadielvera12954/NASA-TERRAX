import React, { useEffect, useState } from 'react';
import { ShieldCheck, FileCheck } from 'lucide-react';

// Reads the real validation results written by the physics engine (motor/tests/validacion.py).
// Every test is shown, including failed and not-yet-run ones: a test that was not run is never shown as passed.
interface Prueba {
  id: string;
  grupo: 'respuesta_conocida' | 'mundo_real';
  nombre_en: string;
  formula: string | null;
  demuestra_en?: string;
  meta: { texto_en?: string; texto: string };
  resultado: { texto_en?: string; texto: string };
  estado: 'pasa' | 'falla' | 'pendiente';
  datos: string;
  dueno: string;
  dueno_en?: string;
}

interface Pruebas {
  resumen: { total: number; pasa: number; falla: number; pendiente: number };
  pruebas: Prueba[];
  meta: { generado_utc: string };
}

const CLASE: Record<Prueba['estado'], string> = { pasa: 'sost', falla: 'noal', pendiente: 'nopo' };
const DATOS: Record<string, string> = { sinteticos: 'synthetic', reales: 'real', maqueta: 'mock', ninguno: 'none' };
const ETIQUETA: Record<Prueba['estado'], string> = { pasa: 'Passed', falla: 'Failed', pendiente: 'Not run yet' };

const Fila: React.FC<{ p: Prueba }> = ({ p }) => (
  <div
    style={{
      padding: '10px 12px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--borde-dark)',
      borderRadius: '2px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
    }}
  >
    <div>
      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--texto)' }}>
        {p.nombre_en}
        {p.formula ? ` (${p.formula})` : ''}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--sec-dark)' }}>{p.demuestra_en}</div>
      <div style={{ fontSize: '10px', color: 'var(--sec-dark)', marginTop: '2px' }}>
        {p.resultado.texto_en} · Data: {DATOS[p.datos] ?? p.datos} · Owner: {p.dueno_en ?? p.dueno}
      </div>
    </div>
    <div style={{ textAlign: 'right', minWidth: '140px' }}>
      <span className={`etq ${CLASE[p.estado]}`}>{ETIQUETA[p.estado]}</span>
      <div style={{ fontSize: '10px', color: 'var(--sec-dark)', marginTop: '2px' }}>Target: {p.meta.texto_en ?? p.meta.texto}</div>
    </div>
  </div>
);

export const TestsScreen: React.FC = () => {
  const [datos, setDatos] = useState<Pruebas | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/pruebas.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setDatos)
      .catch((e) => setError(String(e)));
  }, []);

  const grupo = (g: Prueba['grupo']) => (datos ? datos.pruebas.filter((p) => p.grupo === g) : []);

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
          {datos
            ? `${datos.resumen.total} tests: ${datos.resumen.pasa} passed, ${datos.resumen.falla} failed, ${datos.resumen.pendiente} not run yet. Generated ${datos.meta.generado_utc}.`
            : error
              ? `Could not load pruebas.json (${error}).`
              : 'Loading test results…'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        <div className="panel">
          <div className="et" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="var(--sol)" /> Known-Answer Tests
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {grupo('respuesta_conocida').map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="et" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileCheck size={14} color="var(--dato)" /> Against the Real World
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {grupo('mundo_real').map((p) => (
              <Fila key={p.id} p={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
