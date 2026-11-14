import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export const DataScreen: React.FC = () => {
  // Sources come from manifest.json, written from the real downloads (versions and SHA-256 of every crop).
  const [fuentes, setFuentes] = useState<
    { id: string; entidad: string; coordenadas: string; resolucion: string; licencia: string; sha256: string | null }[]
  >([]);
  useEffect(() => {
    fetch('/data/manifest.json')
      .then((r) => r.json())
      .then((m) => setFuentes(m.fuentes ?? []))
      .catch(() => setFuentes([]));
  }, []);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Open Data Registry & Reproducibility
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 900 }}>
          Data Sources, Integrity Hashes & Licenses
        </h1>
        <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
          Every file consumed by TERRA-X has a public source, exact versioning, and cryptographic SHA-256 hash.
        </p>
      </div>

      <div className="panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {fuentes.map((f, i) => (
            <div
              key={i}
              style={{
                background: '#07173F',
                border: '1px solid var(--borde-dark)',
                borderRadius: '2px',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', color: 'var(--sol)' }}>{f.id}</h3>
                  <div style={{ fontSize: '12px', color: 'var(--texto-sec)' }}>{f.entidad}</div>
                </div>
                <span className="etq sost" style={{ fontSize: '10px' }}>
                  <ShieldCheck size={11} /> {f.licencia}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', margin: '8px 0' }}>
                <div>
                  <span className="et">Coverage: </span>
                  <span style={{ color: 'var(--texto)' }}>{f.coordenadas}</span>
                </div>
                <div>
                  <span className="et">Resolution: </span>
                  <span style={{ color: 'var(--texto)' }}>{f.resolucion}</span>
                </div>
              </div>

              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span className="et">SHA-256: </span>
                <code style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--dato)' }}>
                  {f.sha256 ?? 'live API query (no file hash); saved responses are hashed in manifest_parte3.json'}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
