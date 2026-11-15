import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, ChevronRight, ChevronLeft, X, ExternalLink, CheckCircle2 } from 'lucide-react';
import { FranjaLimites } from '../graficos/FranjaLimites';

export interface RecorridoStep {
  id: number;
  segundoInicio: number;
  segundoFin: number;
  pantalla: string;
  titulo: string;
  texto: string;
  imagen: string;
  badge?: string;
  detalles: string[];
}

const PASOS_RECORRIDO: RecorridoStep[] = [
  {
    id: 1,
    segundoInicio: 0,
    segundoFin: 10,
    pantalla: 'Mission Hook',
    titulo: 'Before sending a rover to the Moon’s south pole, where do you rehearse?',
    texto: 'Open NASA data. The same code on both worlds. What transfers, what does not, and what to measure next.',
    imagen: '/img/ui_luna3d.png',
    badge: 'Step 1 of 6 · The Challenge',
    detalles: [
      'Highest Sun at Mons Mouton: 6.96°',
      'Sun below a flat horizon: 289-418 h in a row each lunation (2027)',
      'VIPER dark survival capacity: 50 h limit',
    ],
  },
  {
    id: 2,
    segundoInicio: 10,
    segundoFin: 25,
    pantalla: 'Destination · Safe Havens',
    titulo: 'The Sun never climbs above 7°. On flat ground, a rover would be dark for over 289 hours. It survives only here.',
    texto: 'With real LOLA relief, no point of the 30 × 30 km area around the center of Mons Mouton stays under 50 h of darkness: the best one still loses the Sun for 219 h in summer. Our shadows match NASA’s illumination map (ρ = 0.985).',
    imagen: '/img/ui_refugios.png',
    badge: 'Step 2 of 6 · Lunar Physics',
    detalles: [
      'Safe haven definition: Darkness stretches ≤ 50 hours',
      'Summer lunation: Oct 27 – Nov 26, 2027',
      'LOLA DEM topography from NASA (PGDA 90), 60 m grid',
    ],
  },
  {
    id: 3,
    segundoInicio: 25,
    segundoFin: 45,
    pantalla: 'Search · Candidate Scanning',
    titulo: 'We scan Argentina with the same code, at the same scale. The controls must land where they should.',
    texto: 'Using NASADEM 60m grids, we scan 40 parcels in Payunia, Mendoza. Two negative and positive controls guarantee that the ranking is scientific and not biased.',
    imagen: '/img/ui_tierra_top.png',
    badge: 'Step 3 of 6 · Earth Analogs',
    detalles: [
      'Candidate P-07: Payunia (36.41°S, 69.20°W)',
      'Negative control: Vegetated parcel correctly rejected',
      'Positive control: Mons Mouton crop lands at #1',
    ],
  },
  {
    id: 4,
    segundoInicio: 45,
    segundoFin: 65,
    pantalla: 'Two Worlds · The Curtain',
    titulo: 'Same Sun height. Same shadows. Two worlds.',
    texto: 'A single physical engine calculates shadow casting on both bodies. The only differences are gravity (1/6g vs 1g) and atmospheric optics (hard vacuum vs diffused penumbra).',
    imagen: '/img/ui_luna3d_b.png',
    badge: 'Step 4 of 6 · Live Parity',
    detalles: [
      'Sun at 3.0°: 47% shadow on Moon vs 41% on Payunia P-07',
      'Shadow length: L = h / tan(elevation) with 2px virtual height',
      'Parity test: 1,000 cases match Python within 0 px',
    ],
  },
  {
    id: 5,
    segundoInicio: 65,
    segundoFin: 80,
    pantalla: 'Candidate Card P-07',
    titulo: 'What matches, how much, and what does not. What to measure first, and at what time.',
    texto: 'Candidate P-07 achieves Compatibility C=0.82 with Evidence E=0.70. On November 14, from 19:41 to 20:12, the sunset Sun angle matches Mons Mouton (7° down to 1.5°).',
    imagen: '/img/ui_tierra3d.png',
    badge: 'Step 5 of 6 · The Analog Card',
    detalles: [
      'Rehearsal window: 19:41 to 20:12 (Azimuth 252° to 248°)',
      'Threshold 0.70 bounds: [0.574, 0.874]',
      'Measure first: Surface material composition',
    ],
  },
  {
    id: 6,
    segundoInicio: 80,
    segundoFin: 90,
    pantalla: 'Open Verification & Tests',
    titulo: 'Every claim has a test. Every test is public, passed or not.',
    texto: 'Synthetic tests (post on plane, sphere, Gaussian surface vs Smith) and JPL Horizons ephemeris comparisons. Even when a test fails, it is transparently reported.',
    imagen: '/img/cover_tierra.png',
    badge: 'Step 6 of 6 · Scientific Integrity',
    detalles: [
      'Post on plane: Passed (≤ 1 px error)',
      'Sphere curvature: Passed (0 px error)',
      'JPL Horizons Sun position: Passed (0.00001° on the Moon)',
      'Sunset shadow field test: measured Nov 14, reported passed or failed',
    ],
  },
];

export interface Recorrido90SegundosProps {
  onCerrar: () => void;
  onIrAPantalla?: (pantalla: string) => void;
}

export const Recorrido90Segundos: React.FC<Recorrido90SegundosProps> = ({ onCerrar, onIrAPantalla }) => {
  const [segundoActual, setSegundoActual] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const pasoTotal = PASOS_RECORRIDO.length;

  // Find active step based on current second
  const pasoActivoIdx = PASOS_RECORRIDO.findIndex(
    (p) => segundoActual >= p.segundoInicio && segundoActual < p.segundoFin
  );
  const pasoActual = PASOS_RECORRIDO[pasoActivoIdx === -1 ? pasoTotal - 1 : pasoActivoIdx];

  // Timer loop (1 second clock)
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSegundoActual((prev) => {
        if (prev >= 90) {
          setIsPlaying(false);
          return 90;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const saltarAPaso = (idx: number) => {
    setSegundoActual(PASOS_RECORRIDO[idx].segundoInicio);
  };

  const pasoAnterior = () => {
    if (pasoActivoIdx > 0) saltarAPaso(pasoActivoIdx - 1);
  };

  const pasoSiguiente = () => {
    if (pasoActivoIdx < pasoTotal - 1) saltarAPaso(pasoActivoIdx + 1);
    else setSegundoActual(90);
  };

  const reiniciar = () => {
    setSegundoActual(0);
    setIsPlaying(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 13, 36, 0.96)',
        backdropFilter: 'blur(8px)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header & Progress */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--borde-dark)',
          background: 'var(--paper)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontFamily: 'var(--tit)', fontWeight: 600, color: 'var(--sol)', fontSize: '18px' }}>
            TERRA-X · 90-SECOND JURY TOUR
          </span>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '13px',
              padding: '2px 8px',
              borderRadius: '2px',
              background: 'var(--paper)',
              border: '1px solid var(--sol)',
              color: 'var(--sol)',
            }}
          >
            {segundoActual}s / 90s
          </span>
        </div>

        {/* Step pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {PASOS_RECORRIDO.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => saltarAPaso(idx)}
              style={{
                background: idx === pasoActivoIdx ? 'var(--sol)' : 'rgba(255, 255, 255, 0.08)',
                color: idx === pasoActivoIdx ? 'var(--noche)' : 'var(--texto-sec)',
                border: 'none',
                borderRadius: '2px',
                padding: '4px 10px',
                fontSize: '11px',
                fontFamily: 'var(--txt)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {idx + 1}. {p.pantalla.split(' · ')[0]}
            </button>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onCerrar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--texto)',
            cursor: 'pointer',
            padding: '4px',
          }}
          title="Exit Tour"
        >
          <X size={20} />
        </button>
      </div>

      {/* Progress Bar Line */}
      <div style={{ width: '100%', height: '3px', background: '#11255B' }}>
        <div
          style={{
            width: `${(segundoActual / 90) * 100}%`,
            height: '100%',
            background: 'var(--sol)',
            boxShadow: '0 0 8px var(--sol)',
            transition: 'width 0.25s linear',
          }}
        />
      </div>

      {/* Center Stage Presentation */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px' }}>
        <div
          style={{
            maxWidth: '1050px',
            width: '100%',
            background: 'var(--noche-panel)',
            border: '1px solid var(--borde-light)',
            borderRadius: '2px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            overflow: 'hidden',
          }}
        >
          {/* Left: Step visual / image */}
          <div style={{ position: 'relative', height: '420px', background: '#050D24', overflow: 'hidden' }}>
            <img
              src={pasoActual.imagen}
              alt={pasoActual.titulo}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--sol)',
                padding: '4px 10px',
                borderRadius: '2px',
                fontSize: '11px',
                fontFamily: 'var(--mono)',
                color: 'var(--sol)',
              }}
            >
              {pasoActual.badge}
            </div>

            {/* Special graphic widget for Step 5 */}
            {pasoActual.id === 5 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  right: '16px',
                  background: 'rgba(7, 23, 63, 0.94)',
                  padding: '12px',
                  borderRadius: '2px',
                  border: '1px solid var(--borde-dark)',
                }}
              >
                <FranjaLimites c={0.82} e={0.7} l={0.574} u={0.874} ancho={400} />
              </div>
            )}
          </div>

          {/* Right: Step narrative & arguments */}
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="et" style={{ marginBottom: '8px' }}>
                {pasoActual.segundoInicio}s – {pasoActual.segundoFin}s · {pasoActual.pantalla}
              </div>
              <h2 style={{ fontSize: '22px', lineHeight: 1.25, marginBottom: '14px', color: 'var(--texto)' }}>
                "{pasoActual.titulo}"
              </h2>
              <p style={{ color: 'var(--texto-sec)', fontSize: '14px', lineHeight: 1.5, marginBottom: '20px' }}>
                {pasoActual.texto}
              </p>

              {/* Bullet highlights */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pasoActual.detalles.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      color: 'var(--texto)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    <CheckCircle2 size={13} color="var(--sol)" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom jump link */}
            {onIrAPantalla && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--borde-dark)' }}>
                <button
                  onClick={() => {
                    onIrAPantalla(pasoActual.pantalla.split(' · ')[0].toLowerCase());
                    onCerrar();
                  }}
                  className="btn sec"
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <ExternalLink size={13} /> Open full {pasoActual.pantalla} screen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Playback Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '16px 24px',
          borderTop: '1px solid var(--borde-dark)',
          background: 'var(--paper)',
        }}
      >
        <button
          onClick={pasoAnterior}
          disabled={pasoActivoIdx === 0}
          className="btn sec"
          style={{ padding: '8px 12px', opacity: pasoActivoIdx === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <button
          onClick={() => setIsPlaying((p) => !p)}
          className="btn"
          style={{ minWidth: '120px' }}
        >
          {isPlaying ? (
            <>
              <Pause size={16} /> Pause
            </>
          ) : (
            <>
              <Play size={16} /> Play
            </>
          )}
        </button>

        <button
          onClick={pasoSiguiente}
          disabled={segundoActual >= 90}
          className="btn sec"
          style={{ padding: '8px 12px', opacity: segundoActual >= 90 ? 0.4 : 1 }}
        >
          Next <ChevronRight size={16} />
        </button>

        <button
          onClick={reiniciar}
          className="btn sec"
          style={{ padding: '8px 10px', marginLeft: '12px' }}
          title="Restart from 0s"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
};
