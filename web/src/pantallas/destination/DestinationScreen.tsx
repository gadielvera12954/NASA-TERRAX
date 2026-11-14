import React, { useState } from 'react';
import { useSol } from '../../luz/SolContext';
import { PerfilHorizonte } from '../../graficos/PerfilHorizonte';
import { RecorridoSolLunacion } from '../../graficos/RecorridoSolLunacion';
import { TerrainShadowCanvas } from '../../luz/TerrainShadowCanvas';
import { AlertTriangle, BatteryCharging, Clock, MapPin, Sun } from 'lucide-react';

export const DestinationScreen: React.FC = () => {
  const { elevacion, azimut } = useSol();
  const [estacion, setEstacion] = useState<'summer' | 'winter'>('summer');
  const [vistaMapa, setVistaMapa] = useState<'refugios' | 'canvas3d'>('refugios');

  // Stats vary between summer and winter lunations based on JPL Horizons and team models
  const datosEstacion = {
    summer: {
      picoSol: '6.94°',
      fechaPico: 'Nov 11, 2027',
      supervivenciaPct: 18,
      solEnPaneles: '61 % of the lunation',
      tramoOscuroMax: '38 h',
      bateriaMin: '34 %',
      refugioCercano: '1.2 km',
      condicionCritica: 'With the rover tilted 15°, the dark stretch rises to 57 h.',
      horasTotalesOscuridad: '148 h',
    },
    winter: {
      picoSol: '3.87°',
      fechaPico: 'May 18, 2027',
      supervivenciaPct: 4,
      solEnPaneles: '32 % of the lunation',
      tramoOscuroMax: '64 h (EXCEEDS 50h LIMIT)',
      bateriaMin: '0 % (Depleted)',
      refugioCercano: '4.8 km',
      condicionCritica: 'Without active route repositioning, VIPER freezes permanently.',
      horasTotalesOscuridad: '210 h',
    },
  }[estacion];

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Screen Title & First Verdict Header */}
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Destination · Lunar South Pole (Mons Mouton Plateau · 85.5°S, 31.4°E)
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 900 }}>
          The mission survives on <span style={{ color: 'var(--sol)' }}>{datosEstacion.supervivenciaPct} %</span> of this terrain.
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
            <div style={{ display: 'flex', gap: '4px', background: '#07173F', padding: '2px', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}>
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
                  src="/img/ui_refugios.png"
                  alt="Safe-haven map showing darkness stretches across Mons Mouton"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: estacion === 'winter' ? 'hue-rotate(180deg) brightness(0.7)' : 'none',
                    transition: 'filter 0.3s ease',
                  }}
                />

                {/* Legend Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(7, 23, 63, 0.90)',
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
                    background: 'rgba(7, 23, 63, 0.90)',
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
                  <span style={{ color: '#34D399' }}>● ≤ 50 h (Viable)</span>
                  <span style={{ color: '#FBBF24' }}>● 50-100 h</span>
                  <span style={{ color: '#F87171' }}>● &gt; 100 h (Lethal)</span>
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
            <span>Mons Mouton LOLA 5m DEM · USGS/NASA</span>
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
                <Clock size={14} color="#F59E0B" /> Longest Dark Stretch
              </span>
              <span className="val" style={{ color: estacion === 'winter' ? '#EF4444' : 'var(--texto)' }}>
                {datosEstacion.tramoOscuroMax}
              </span>
            </div>
            <div className="fila-dato">
              <span className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BatteryCharging size={14} color="#10B981" /> Lowest Battery Reserve
              </span>
              <span className="val" style={{ color: estacion === 'winter' ? '#EF4444' : '#34D399' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', marginBottom: '6px' }}>
              <AlertTriangle size={15} />
              <span className="et" style={{ color: '#F59E0B' }}>Critical Condition</span>
            </div>
            <p style={{ fontFamily: 'var(--txt)', fontSize: '13px', lineHeight: 1.4, color: 'var(--texto)' }}>
              "{datosEstacion.condicionCritica}"
            </p>
          </div>

          {/* Horizon Profile widget */}
          <div className="panel" style={{ padding: '12px' }}>
            <PerfilHorizonte ancho={460} alto={140} sitio="Mons Mouton Rim (85.5°S)" />
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
