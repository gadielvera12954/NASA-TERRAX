import React, { useEffect, useState } from 'react';
import { useSol } from '../../luz/SolContext';
import { PerfilHorizonte } from '../../graficos/PerfilHorizonte';
import { RecorridoSolLunacion } from '../../graficos/RecorridoSolLunacion';
import { TerrainShadowCanvas } from '../../luz/TerrainShadowCanvas';
import { AlertTriangle, BatteryCharging, Clock, MapPin, Sun } from 'lucide-react';

export const DestinationScreen: React.FC = () => {
  const { elevacion, azimut } = useSol();
  const [estacion, setEstacion] = useState<'summer' | 'winter'>('summer');
  const [vistaMapa, setVistaMapa] = useState<'refugios' | 'canvas3d'>('refugios');

  // Real destination cards written by the physics engine (motor/destino): ficha_<lunation>.json uses LOLA relief;
  // if it is not there yet, ficha_liso_<lunation>.json (real Sun, flat horizon) is shown and labelled as such.
  const [fichas, setFichas] = useState<Record<string, any>>({});
  useEffect(() => {
    const cargar = async (n: string) => {
      for (const archivo of [`ficha_${n}.json`, `ficha_liso_${n}.json`]) {
        const r = await fetch(`/data/destino/${archivo}`);
        if (r.ok) return r.json();
      }
      return null;
    };
    Promise.all([cargar('verano'), cargar('invierno')]).then(([verano, invierno]) => setFichas({ summer: verano, winter: invierno }));
  }, []);
  const f = fichas[estacion];
  const r = f?.resultado;
  const pct = (x?: number) => (x === undefined || x === null ? '—' : `${Math.round(100 * x)} %`);
  const fechaPico = f ? new Date(f.lunacion.fecha_sol_max).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';
  const datosEstacion = {
    picoSol: f ? `${f.lunacion.sol_max_deg.toFixed(2)}°` : '—',
    fechaPico,
    supervivenciaPct: f?.refugios ? Math.round(1000 * f.refugios.fraccion_terreno) / 10 : null,
    solEnPaneles: r ? `${pct(r.sol_en_paneles_frac)} of the lunation` : '—',
    tramoOscuroMax: r ? `${Math.round(r.tramo_oscuro_mas_largo_h)} h${r.tramo_oscuro_mas_largo_h > 50 ? ' (EXCEEDS 50 h LIMIT)' : ''}` : '—',
    bateriaMin: r ? `${pct(r.bateria_minima_frac)}${r.bateria_minima_frac === 0 ? ' (Depleted)' : ''}` : '—',
    refugioCercano: f?.refugios?.refugio_mas_cercano_km != null ? `${f.refugios.refugio_mas_cercano_km.toFixed(1)} km` : 'None in this crop',
    condicionCritica: f
      ? `With the rover tilted ${f.ab.inclinacion_deg}°, the longest stretch below 108.4 W is ${Math.round(f.ab.inclinado.tramo_oscuro_mas_largo_h)} h (flat ground: ${Math.round(f.ab.plano.tramo_oscuro_mas_largo_h)} h).`
      : 'Loading…',
    horizonte: f?.horizonte?.tipo === 'relieve' ? 'LOLA relief (PGDA 90), 60 m grid' : 'Flat horizon (no relief yet)',
    maqueta: Boolean(f?.maqueta),
    mapa: f?.refugios ? `/data/destino/vista_refugios_${estacion === 'summer' ? 'verano' : 'invierno'}.png` : '/img/ui_refugios.png',
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Screen Title & First Verdict Header */}
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Destination · Lunar South Pole (Mons Mouton · 84.60°S, 31.00°E)
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 600 }}>
          {datosEstacion.supervivenciaPct === null ? (
            <>On flat ground, a parked rover <span style={{ color: 'var(--sol)' }}>does not survive</span> the lunar night.</>
          ) : datosEstacion.supervivenciaPct === 0 ? (
            <>No point of this 30 × 30 km area <span style={{ color: 'var(--sol)' }}>survives the lunar night</span>.</>
          ) : (
            <>The mission survives on <span style={{ color: 'var(--sol)' }}>{datosEstacion.supervivenciaPct} %</span> of this terrain.</>
          )}
        </h1>
        <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
          Current Grazing Sun: <b style={{ color: 'var(--sol)' }}>{elevacion.toFixed(2)}°</b> @ <b style={{ color: 'var(--dato)' }}>{azimut.toFixed(0)}°</b>. Elsewhere, darkness exceeds the 50 h VIPER battery survival limit.
        </p>
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Interactive Map & View Mode */}
        <div className="panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setVistaMapa('refugios')}
                className={`btn ${vistaMapa === 'refugios' ? '' : 'sec'}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                Safe-Haven Map
              </button>
              <button
                onClick={() => setVistaMapa('canvas3d')}
                className={`btn ${vistaMapa === 'canvas3d' ? '' : 'sec'}`}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                Live Shadow Raycast
              </button>
            </div>

            {/* Summer / Winter Season Selector */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--paper)', padding: '2px', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}>
              <button
                onClick={() => setEstacion('summer')}
                style={{
                  background: estacion === 'summer' ? 'var(--sol)' : 'transparent',
                  color: estacion === 'summer' ? 'var(--noche)' : 'var(--texto-sec)',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Summer
              </button>
              <button
                onClick={() => setEstacion('winter')}
                style={{
                  background: estacion === 'winter' ? 'var(--alerta)' : 'transparent',
                  color: estacion === 'winter' ? '#FFFFFF' : 'var(--texto-sec)',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Winter
              </button>
            </div>
          </div>

          {/* Map Display Container */}
          <div style={{ position: 'relative', width: '100%', height: '340px', background: '#050D24', borderRadius: '2px', overflow: 'hidden' }}>
            {vistaMapa === 'refugios' ? (
              <>
                <img
                  src={datosEstacion.mapa}
                  alt="Safe-haven map showing darkness stretches across Mons Mouton"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: 'none',
                    transition: 'filter 0.3s ease',
                  }}
                />

                {/* Legend Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--borde-dark)',
                    padding: '6px 10px',
                    borderRadius: '2px',
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                  }}
                >
                  <b style={{ color: 'var(--sol)' }}>SAFE-HAVEN MAP</b> · Hours in a row without Sun
                </div>

                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--borde-dark)',
                    padding: '6px 10px',
                    borderRadius: '2px',
                    fontFamily: 'var(--mono)',
                    fontSize: '10px',
                    color: 'var(--texto-sec)',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  <span style={{ color: 'var(--success)' }}>● ≤ 50 h (Viable)</span>
                  <span style={{ color: 'var(--ochre-ink)' }}>● 50-100 h</span>
                  <span style={{ color: 'var(--error)' }}>● &gt; 100 h (Lethal)</span>
                </div>
              </>
            ) : (
              <TerrainShadowCanvas
                width={560}
                height={340}
                terrainType="mons_mouton"
              />
            )}
          </div>

          {/* Subtext info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--sec-dark)' }}>
            <span>{datosEstacion.horizonte}{datosEstacion.maqueta ? ' · MOCK DATA' : ''}</span>
            <span>Sun Peak: <b style={{ color: 'var(--sol)' }}>{datosEstacion.picoSol}</b> · {datosEstacion.fechaPico}</span>
          </div>
        </div>

        {/* Right Column: Telemetry, Critical Conditions & Horizon Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Key Metrics Panel */}
          <div className="panel">
            <div className="et" style={{ marginBottom: '8px' }}>
              Operational Telemetry ({estacion === 'summer' ? 'Summer Lunation' : 'Winter Lunation'})
            </div>
            <div className="fila-dato">
              <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sun size={14} color="var(--sol)" /> Sun on Panels
              </span>
              <span className="val" style={{ color: 'var(--sol)' }}>{datosEstacion.solEnPaneles}</span>
            </div>
            <div className="fila-dato">
              <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} color="var(--ochre-ink)" /> Longest Dark Stretch
              </span>
              <span className="val" style={{ color: estacion === 'winter' ? 'var(--error)' : 'var(--texto)' }}>
                {datosEstacion.tramoOscuroMax}
              </span>
            </div>
            <div className="fila-dato">
              <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BatteryCharging size={14} color="var(--success)" /> Lowest Battery Reserve
              </span>
              <span className="val" style={{ color: estacion === 'winter' ? 'var(--error)' : 'var(--success)' }}>
                {datosEstacion.bateriaMin}
              </span>
            </div>
            <div className="fila-dato">
              <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} color="var(--dato)" /> Nearest Safe Haven
              </span>
              <span className="val">{datosEstacion.refugioCercano}</span>
            </div>
          </div>

          {/* Critical Condition Box */}
          <div
            className="panel"
            style={{
              borderColor: estacion === 'winter' ? 'var(--alerta)' : 'var(--borde-light)',
              background: estacion === 'winter' ? 'rgba(139, 10, 3, 0.2)' : 'var(--noche-panel)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ochre-ink)', marginBottom: '6px' }}>
              <AlertTriangle size={15} />
              <span className="et" style={{ color: 'var(--ochre-ink)' }}>Critical Condition</span>
            </div>
            <p style={{ fontFamily: 'var(--txt)', fontSize: '13px', lineHeight: 1.4, color: 'var(--texto)' }}>
              "{datosEstacion.condicionCritica}"
            </p>
          </div>

          {/* Horizon Profile widget */}
          <div className="panel" style={{ padding: '12px' }}>
            <PerfilHorizonte ancho={460} alto={140} sitio="Mons Mouton (84.60°S)" />
          </div>
        </div>
      </div>

      {/* Lunation Curve full width at bottom of screen */}
      <div style={{ marginTop: '20px' }}>
        <div className="panel" style={{ padding: '16px' }}>
          <RecorridoSolLunacion ancho={1190} alto={160} />
        </div>
      </div>
    </div>
  );
};
