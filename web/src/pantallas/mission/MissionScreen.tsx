import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface MissionScreenProps {
  onIniciarRecorrido: () => void;
  onNavegar: (tab: string) => void;
}

export const MissionScreen: React.FC<MissionScreenProps> = ({ onIniciarRecorrido, onNavegar }) => {
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '36px 20px 80px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '32px', alignItems: 'center' }}>
        {/* Left Side: Headline & Mission Statement */}
        <div>
          <div className="et" style={{ marginBottom: '8px', color: 'var(--sol)' }}>
            NASA SPACE APPS CHALLENGE 2026 · TERRA-X
          </div>
          <h1 style={{ fontSize: '38px', lineHeight: 1.12, marginBottom: '16px', fontWeight: 600 }}>
            Find where on Earth to rehearse a Moon-base operation.
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--texto-sec)', lineHeight: 1.55, marginBottom: '24px' }}>
            Open NASA data. The same code on both worlds. What transfers, what does not, and what to measure next.
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '32px' }}>
            <button onClick={onIniciarRecorrido} className="btn" style={{ padding: '10px 20px', fontSize: '14px' }}>
              <Sparkles size={16} /> Take the 90-second tour
            </button>
            <button
              onClick={() => onNavegar('two worlds')}
              className="btn sec"
              style={{ padding: '10px 20px', fontSize: '14px' }}
            >
              Explore Two Worlds <ArrowRight size={15} />
            </button>
          </div>

          {/* Three Key Scientific Figures from JPL Horizons & NASA */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div className="panel" style={{ padding: '14px' }}>
              <div className="cifra-grande">6.96°</div>
              <div className="cifra-label">Highest Sun at Mons Mouton</div>
            </div>
            <div className="panel" style={{ padding: '14px' }}>
              <div className="cifra-grande">289–418 h</div>
              <div className="cifra-label">Sun below a flat horizon, each lunation</div>
            </div>
            <div className="panel" style={{ padding: '14px' }}>
              <div className="cifra-grande">50 h</div>
              <div className="cifra-label">Darkness VIPER can survive</div>
            </div>
          </div>
        </div>

        {/* Right Side: Hero Visual with Real Physical Shadow */}
        <div className="panel panel-lit" style={{ padding: '8px', overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: '100%', height: '360px', borderRadius: '2px', overflow: 'hidden' }}>
            <img
              src="/img/ui_luna3d.png"
              alt="Lunar South Pole Mons Mouton 3D view"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(7, 23, 63, 0.92)',
                border: '1px solid var(--sol)',
                padding: '4px 10px',
                borderRadius: '2px',
                fontFamily: 'var(--mono)',
                fontSize: '11px',
                color: 'var(--sol)',
              }}
            >
              MONS MOUTON · 84.60°S
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px 4px', fontSize: '11px', color: 'var(--sec-dark)' }}>
            <span>LOLA DEM (PGDA 90) · NASA</span>
            <span style={{ color: 'var(--sol)' }}>Dynamic Grazing Shadow Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
