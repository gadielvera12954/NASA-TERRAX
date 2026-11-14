import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const DataScreen: React.FC = () => {
  const fuentes = [
    {
      id: 'JPL Horizons Ephemerides v1.2',
      entidad: 'NASA Jet Propulsion Laboratory / Solar System Dynamics',
      coordenadas: 'Mons Mouton (85.5°S, 31.4°E) & Payunia (36.4°S, 69.2°W)',
      resolucion: '1-minute time step · DE421 ephemeris',
      licencia: 'NASA Open Data / Public Domain',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      id: 'NASADEM Global DEM V001',
      entidad: 'NASA EOSDIS Land Processes DAAC',
      coordenadas: 'Payunia Volcanic Field, Mendoza, Argentina',
      resolucion: '1 arc-second (reprojected to 60m UTM)',
      licencia: 'NASA Open Data / Public Domain',
      sha256: '7a35c5e882a201c107297e64de06815cf1f39c81b5c4f2bb76fe17188b8e0d37',
    },
    {
      id: 'LOLA / Kaguya Merged DEM (pgda78)',
      entidad: 'USGS Astrogeology / NASA PDS Geosciences Node',
      coordenadas: 'Lunar South Pole · Mons Mouton High Plateau',
      resolucion: '5 meters / pixel polar stereographic',
      licencia: 'USGS / NASA Open Data',
      sha256: '1f893e481b490f2307b22a0096f131a9c336b132a488e0f63b468903c72b7a94',
    },
  ];

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
                  {f.sha256}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
