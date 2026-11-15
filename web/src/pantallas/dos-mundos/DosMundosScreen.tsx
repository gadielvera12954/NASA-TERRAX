import React, { useState, useRef, useCallback } from 'react';
import { useSol } from '../../luz/SolContext';
import { TerrainShadowCanvas } from '../../luz/TerrainShadowCanvas';
import BotonSI from '../../luz/BotonSI';
import { escribiendoEnCampo } from '../../luz/EscenarioCortina';
import { Split, ArrowLeftRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export const DosMundosScreen: React.FC = () => {
  const { elevacion, azimut } = useSol();
  const [cortinaPos, setCortinaPos] = useState<number>(50); // percentage [0, 100]
  const [lunaStats, setLunaStats] = useState({ shadowPercent: 47, sunLitPercent: 53 });
  const [tierraStats, setTierraStats] = useState({ shadowPercent: 41, sunLitPercent: 59 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Dragging the vertical curtain separator
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    containerRef.current.focus({ preventScroll: true });
    const rect = containerRef.current.getBoundingClientRect();
    const updatePos = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const pct = (x / rect.width) * 100;
      setCortinaPos(Math.max(5, Math.min(95, Math.round(pct))));
    };

    updatePos(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      updatePos(ev.clientX);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (escribiendoEnCampo(e.target)) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCortinaPos((c) => Math.max(5, c - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCortinaPos((c) => Math.min(95, c + step));
    } else if (e.key === 'Home' || e.key === 't' || e.key === 'T') {
      e.preventDefault();
      setCortinaPos(5);
    } else if (e.key === 'End' || e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      setCortinaPos(95);
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }} onKeyDown={handleKeyDown}>
      {/* Title & Core Project Statement */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="et" style={{ marginBottom: '4px' }}>
            Comparative Engine · Same Code on Two Worlds
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 600 }}>
            Same Sun height. Same shadows. <span style={{ color: 'var(--sol)' }}>Two worlds.</span>
          </h1>
          <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
            Sun: <b style={{ color: 'var(--sol)' }}>{elevacion.toFixed(2)}°</b> @ <b style={{ color: 'var(--dato)' }}>{azimut.toFixed(0)}°</b>. Drag the yellow curtain (or use ←/→, Home/End, L/T) to compare Mons Mouton with Candidate P-07 in Payunia, Argentina.
          </p>
        </div>
        <BotonSI
          texto="Explain with SI"
          pregunta={() =>
            `In Two Worlds with the Sun at ${elevacion.toFixed(2)}° elevation and ${azimut.toFixed(0)}° azimuth, Mons Mouton has ${lunaStats.shadowPercent}% shadow coverage vs ${tierraStats.shadowPercent}% on Payunia P-07. Explain what transfers and what does not.`
          }
          contexto={() => ({
            pantalla: 'two worlds',
            elevacion_sol_deg: elevacion,
            azimut_sol_deg: azimut,
            sombra_luna_pct: lunaStats.shadowPercent,
            sombra_tierra_pct: tierraStats.shadowPercent,
          })}
        />
      </div>

      {/* Flagship Split Screen Viewport */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="group"
        aria-label="Two Worlds comparison stage. Use Left and Right arrows, Home, End, L for Moon and T for Earth."
        style={{
          position: 'relative',
          height: '420px',
          borderRadius: '2px',
          overflow: 'hidden',
          border: '1px solid var(--borde-dark)',
          background: '#050D24',
          userSelect: 'none',
        }}
      >
        {/* Left Side: Moon (Mons Mouton) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${cortinaPos}%`,
            overflow: 'hidden',
            borderRight: '2px solid var(--sol)',
            zIndex: 10,
          }}
        >
          {/* Full-width container pinned to the left */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '1200px', height: '100%' }}>
            <img
              src="/img/ui_luna3d.png"
              alt="Moon Mons Mouton 3D terrain"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Moon Badge */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              background: 'rgba(7, 23, 63, 0.92)',
              border: '1px solid #94A3B8',
              borderRadius: '2px',
              padding: '6px 12px',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              color: 'var(--luna)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F4F6FB' }} />
            <b>Mons Mouton, Moon</b> · {lunaStats.shadowPercent}% in shadow
          </div>

          {/* Moon Physics Specs Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              background: 'rgba(7, 23, 63, 0.92)',
              border: '1px solid var(--borde-dark)',
              borderRadius: '2px',
              padding: '8px 12px',
              fontSize: '11px',
              color: 'var(--texto-sec)',
            }}
          >
            <div style={{ color: 'var(--luna)', fontWeight: 700 }}>VACUUM OPTICS</div>
            <div>Atmospheric blur: <b>0.0 px (Hard edge)</b></div>
            <div>Gravity: <b>1.62 m/s² (1/6 g)</b></div>
          </div>
        </div>

        {/* Right Side: Earth (Payunia P-07) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: `${100 - cortinaPos}%`,
            overflow: 'hidden',
          }}
        >
          {/* Full-width container pinned to the right */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '1200px',
              height: '100%',
            }}
          >
            <img
              src="/img/ui_tierra3d.png"
              alt="Earth Payunia P-07 volcanic terrain"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Earth Badge */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(7, 23, 63, 0.92)',
              border: '1px solid var(--tierra)',
              borderRadius: '2px',
              padding: '6px 12px',
              fontFamily: 'var(--mono)',
              fontSize: '12px',
              color: '#FFA07A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--tierra)' }} />
            <b>Payunia P-07, Earth</b> · {tierraStats.shadowPercent}% in shadow
          </div>

          {/* Earth Physics Specs Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              background: 'rgba(7, 23, 63, 0.92)',
              border: '1px solid var(--borde-dark)',
              borderRadius: '2px',
              padding: '8px 12px',
              fontSize: '11px',
              color: 'var(--texto-sec)',
              textAlign: 'right',
            }}
          >
            <div style={{ color: 'var(--tierra)', fontWeight: 700 }}>ATMOSPHERIC OPTICS</div>
            <div>Atmospheric diffusion: <b>Penumbra gradient</b></div>
            <div>Gravity: <b>9.81 m/s² (1 g)</b></div>
          </div>
        </div>

        {/* The Draggable Curtain Divider Handle */}
        <div
          onPointerDown={handlePointerDown}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${cortinaPos}%`,
            transform: 'translateX(-50%)',
            width: '44px',
            cursor: 'ew-resize',
            touchAction: 'none',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Drag curtain left / right"
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--sol)',
              color: 'var(--noche)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(231, 244, 52, 0.9)',
            }}
          >
            <ArrowLeftRight size={14} />
          </div>
        </div>
      </div>

      {/* Bottom Controls & Dual Raycasting Canvas Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        {/* Left Side: Moon Raycast Canvas */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="et">Moon: Mons Mouton LOLA DEM (PGDA 90), 60 m</span>
            <span className="etq sost">{lunaStats.shadowPercent}% Shadowed</span>
          </div>
          <TerrainShadowCanvas
            width={560}
            height={220}
            terrainType="mons_mouton"
            onStatsChange={setLunaStats}
          />
        </div>

        {/* Right Side: Earth Raycast Canvas */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="et">Earth: Payunia P-07 NASADEM 60m</span>
            <span className="etq huec">{tierraStats.shadowPercent}% Shadowed</span>
          </div>
          <TerrainShadowCanvas
            width={560}
            height={220}
            terrainType="payunia_p07"
            onStatsChange={setTierraStats}
          />
        </div>
      </div>

      {/* Transferability Breakdown Matrix */}
      <div style={{ marginTop: '20px' }} className="panel">
        <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Split size={16} color="var(--sol)" /> What Transfers & What Does Not Transfer
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ background: 'var(--paper)', padding: '12px', borderRadius: '2px', borderLeft: '3px solid var(--success)' }}>
            <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> TRANSFERS
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Low Grazing Shadow Geometry</div>
            <div style={{ fontSize: '11px', color: 'var(--sec-dark)', marginTop: '2px' }}>
              Sun at 1.5°–7° creates identical occultation angles on 60m terrain relief.
            </div>
          </div>

          <div style={{ background: 'var(--paper)', padding: '12px', borderRadius: '2px', borderLeft: '3px solid var(--success)' }}>
            <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> TRANSFERS
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Rover Mobility on Slopes</div>
            <div style={{ fontSize: '11px', color: 'var(--sec-dark)', marginTop: '2px' }}>
              Rough basaltic terrain matches 15° slope thresholds for wheel traction testing.
            </div>
          </div>

          <div style={{ background: 'var(--paper)', padding: '12px', borderRadius: '2px', borderLeft: '3px solid var(--error)' }}>
            <div style={{ color: 'var(--error)', fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={13} /> DOES NOT TRANSFER
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Solar Power Generation</div>
            <div style={{ fontSize: '11px', color: 'var(--sec-dark)', marginTop: '2px' }}>
              Atmospheric absorption reduces terrestrial solar irradiance below lunar constants (1361 W/m²).
            </div>
          </div>

          <div style={{ background: 'var(--paper)', padding: '12px', borderRadius: '2px', borderLeft: '3px solid var(--error)' }}>
            <div style={{ color: 'var(--error)', fontWeight: 700, fontSize: '12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldAlert size={13} /> DOES NOT TRANSFER
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Vacuum & Thermal Extreme</div>
            <div style={{ fontSize: '11px', color: 'var(--sec-dark)', marginTop: '2px' }}>
              Absence of vacuum on Earth eliminates regolith electrostatic levitation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
