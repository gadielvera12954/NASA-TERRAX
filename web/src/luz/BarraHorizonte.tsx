import React, { useRef, useCallback } from 'react';
import { useSol } from './SolContext';
import { Compass, Play, Pause, RotateCcw } from 'lucide-react';

export const BarraHorizonte: React.FC = () => {
  const {
    elevacion,
    azimut,
    mundo,
    longitudSombraPx,
    setElevacion,
    setAzimut,
    setMundo,
    isAnimando,
    toggleAnimando,
    resetSol,
  } = useSol();

  const trackRef = useRef<HTMLDivElement>(null);

  // Drag interaction on the horizon track
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const updateFromX = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = x / rect.width;
      // Map 0 -> 1.5° and 1 -> 10.0°
      const newEl = 1.5 + ratio * (10.0 - 1.5);
      setElevacion(newEl);
    };

    updateFromX(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      updateFromX(ev.clientX);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [setElevacion]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setElevacion((prev) => prev + 0.1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setElevacion((prev) => prev - 0.1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setElevacion(1.5);
    } else if (e.key === 'End') {
      e.preventDefault();
      setElevacion(10.0);
    }
  }, [setElevacion]);

  // Position of Sun dot along the track [1.5° -> 0%, 10° -> 100%]
  const percent = ((elevacion - 1.5) / (10.0 - 1.5)) * 100;

  return (
    <div
      className="horizonte-bar-fixed"
      role="region"
      aria-label="Solar Elevation and Shadow Control Bar"
    >
      {/* Left Label & World Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
        <button
          onClick={() => setMundo(mundo === 'luna' ? 'tierra' : 'luna')}
          style={{
            background: mundo === 'luna' ? '#1E293B' : 'rgba(194, 65, 12, 0.25)',
            border: `1px solid ${mundo === 'luna' ? '#94A3B8' : 'var(--tierra)'}`,
            borderRadius: '2px',
            color: mundo === 'luna' ? 'var(--luna)' : 'var(--tierra)',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          title="Toggle Shadow Physics: Moon (vacuum, 0 blur) vs Earth (atmosphere)"
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: mundo === 'luna' ? '#F4F6FB' : 'var(--tierra)',
            }}
          />
          {mundo === 'luna' ? 'Moon (Vacuum)' : 'Earth (Payunia)'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--sec-dark)', letterSpacing: '0.06em' }}>
            Grazing Sun
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 700, color: 'var(--sol)' }}>
            {elevacion.toFixed(2)}°
          </span>
        </div>
      </div>

      {/* Center Interactive Track */}
      <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div
          ref={trackRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          role="slider"
          aria-valuemin={1.5}
          aria-valuemax={10.0}
          aria-valuenow={elevacion}
          aria-label="Solar Elevation Angle"
          style={{
            position: 'relative',
            height: '18px',
            cursor: 'ew-resize',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Baseline Horizon Line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, #1B2A52 0%, #324779 50%, #1B2A52 100%)',
            }}
          />

          {/* Reference Marks */}
          <div style={{ position: 'absolute', left: '0%', height: '8px', width: '1px', background: '#475569' }} />
          <div style={{ position: 'absolute', left: '17.6%', height: '6px', width: '1px', background: '#475569' }} /> {/* 3.0° */}
          <div style={{ position: 'absolute', left: '41.1%', height: '8px', width: '1px', background: 'var(--sol)' }} /> {/* 5.0° */}
          <div style={{ position: 'absolute', left: '64.2%', height: '10px', width: '1px', background: 'var(--sol)' }} /> {/* 6.96° Mons Mouton peak */}
          <div style={{ position: 'absolute', left: '100%', height: '8px', width: '1px', background: '#475569' }} />

          {/* The Draggable Sun Point */}
          <div
            style={{
              position: 'absolute',
              left: `${percent}%`,
              transform: 'translate(-50%, 0)',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: 'var(--sol)',
              boxShadow: '0 0 10px rgba(231, 244, 52, 0.9), 0 0 20px rgba(231, 244, 52, 0.4)',
              transition: 'transform 0.05s linear',
            }}
          />
        </div>

        {/* Labels below track */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--mono)',
            fontSize: '10px',
            color: 'var(--sec-dark)',
          }}
        >
          <span>1.5° (Grazing min)</span>
          <span style={{ color: 'var(--sol)' }}>Peak 6.96° (Mons Mouton)</span>
          <span>10.0° (Max)</span>
        </div>
      </div>

      {/* Right Controls: Azimuth & Shadow Length & Playback */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '320px', justifyContent: 'flex-end' }}>
        {/* Azimuth controller */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--texto-sec)' }}>
          <Compass size={14} color="var(--dato)" />
          <span style={{ fontFamily: 'var(--mono)' }}>Az: {azimut.toFixed(0)}°</span>
          <input
            type="range"
            min="0"
            max="359"
            value={azimut}
            onChange={(e) => setAzimut(Number(e.target.value))}
            style={{ width: '60px', accentColor: 'var(--dato)' }}
            title="Adjust Sun Azimuth (0° to 360°)"
          />
        </div>

        {/* Calculated shadow read-out */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
          <span style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--sec-dark)' }}>
            Largo Sombra (h=2px)
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 700, color: 'var(--texto)' }}>
            {longitudSombraPx.toFixed(1)} px
          </span>
        </div>

        {/* Play/Pause grazing sun motion */}
        <button
          onClick={toggleAnimando}
          style={{
            background: isAnimando ? 'var(--sol)' : 'rgba(255, 255, 255, 0.08)',
            color: isAnimando ? 'var(--noche)' : 'var(--texto)',
            border: '1px solid var(--borde-light)',
            borderRadius: '2px',
            padding: '5px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title={isAnimando ? 'Pause Sun movement' : 'Animate Sun trajectory'}
        >
          {isAnimando ? <Pause size={13} /> : <Play size={13} />}
        </button>

        <button
          onClick={resetSol}
          style={{
            background: 'transparent',
            color: 'var(--sec-dark)',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
          }}
          title="Reset Sun to 3.0° / 250°"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
};
