import React, { useState } from 'react';
import { SolProvider } from './luz/SolContext';
import { BarraHorizonte } from './luz/BarraHorizonte';
import { MissionScreen } from './pantallas/mission/MissionScreen';
import { DestinationScreen } from './pantallas/destination/DestinationScreen';
import { DosMundosScreen } from './pantallas/dos-mundos/DosMundosScreen';
import { SearchScreen } from './pantallas/search/SearchScreen';
import { FichaScreen } from './pantallas/ficha/FichaScreen';
import { TestsScreen } from './pantallas/tests/TestsScreen';
import { DataScreen } from './pantallas/data/DataScreen';
import { FieldScreen } from './pantallas/field/FieldScreen';
import { LearnScreen } from './pantallas/learn/LearnScreen';
import { Recorrido90Segundos } from './recorrido/Recorrido90Segundos';
import { Sparkles, AlertCircle } from 'lucide-react';
import './sistema/tokens.css';

export type PantallaId =
  | 'mission'
  | 'destination'
  | 'search'
  | 'two worlds'
  | 'ficha'
  | 'field'
  | 'learn'
  | 'tests'
  | 'data';

export const AppContent: React.FC = () => {
  const [pantallaActual, setPantallaActual] = useState<PantallaId>('mission');
  const [candidataSeleccionada, setCandidataSeleccionada] = useState<string>('P-07');
  const [idioma, setIdioma] = useState<'EN' | 'ES' | 'GN'>('EN');
  const [mostrarRecorrido, setMostrarRecorrido] = useState<boolean>(false);
  const [isMockData] = useState<boolean>(true); // Controlled by manifest

  const navItems: { id: PantallaId; label: string }[] = [
    { id: 'mission', label: 'Mission' },
    { id: 'destination', label: 'Destination' },
    { id: 'search', label: 'Search' },
    { id: 'two worlds', label: 'Two Worlds' },
    { id: 'field', label: 'Field' },
    { id: 'learn', label: 'Learn' },
    { id: 'tests', label: 'Tests' },
    { id: 'data', label: 'Data' },
  ];

  const handleSeleccionarParcela = (id: string) => {
    setCandidataSeleccionada(id);
    setPantallaActual('ficha');
  };

  const handleNavegarDesdeRecorrido = (tab: string) => {
    const matched = navItems.find((n) => n.id.toLowerCase() === tab.toLowerCase());
    if (matched) {
      setPantallaActual(matched.id);
    } else if (tab.includes('card') || tab.includes('ficha')) {
      setPantallaActual('ficha');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--noche)' }}>
      {/* Top Banner for Mock Data requirement */}
      {isMockData && (
        <div className="banner-mock">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={13} />
            <span>MOCK DATA ACTIVE · PRECOMPUTED HORIZON CONTRATO v1.0.0</span>
          </div>
          <span>ALL FIGURES BACKED BY REPRODUCIBLE TESTS</span>
        </div>
      )}

      {/* Main Sticky Navigation */}
      <nav className="terra-nav">
        {/* Brand Logo & Brand Mark (split circle: half moon grey, half earth red, yellow divider) */}
        <div
          className="logo"
          onClick={() => setPantallaActual('mission')}
          style={{ cursor: 'pointer' }}
        >
          <span className="symbol" />
          <span>TERRA-X</span>
        </div>

        {/* Center Route Links */}
        <div className="nav-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setPantallaActual(item.id)}
              className={`nav-link ${pantallaActual === item.id ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right CTA & Language Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setMostrarRecorrido(true)}
            className="btn"
            style={{ fontSize: '11px', padding: '5px 12px', gap: '6px' }}
          >
            <Sparkles size={13} /> 90s Tour
          </button>

          {/* Language Switcher: EN (Default per rules), ES, GN */}
          <div style={{ display: 'flex', gap: '2px', background: '#07173F', padding: '2px', borderRadius: '2px', border: '1px solid var(--borde-dark)' }}>
            {(['EN', 'ES', 'GN'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setIdioma(lang)}
                style={{
                  background: idioma === lang ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  color: idioma === lang ? 'var(--sol)' : 'var(--sec-dark)',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontFamily: 'var(--mono)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Screen Body */}
      <main style={{ flex: 1 }}>
        {pantallaActual === 'mission' && (
          <MissionScreen
            onIniciarRecorrido={() => setMostrarRecorrido(true)}
            onNavegar={(tab) => setPantallaActual(tab as PantallaId)}
          />
        )}
        {pantallaActual === 'destination' && <DestinationScreen />}
        {pantallaActual === 'search' && <SearchScreen onSeleccionarParcela={handleSeleccionarParcela} />}
        {pantallaActual === 'two worlds' && <DosMundosScreen />}
        {pantallaActual === 'ficha' && (
          <FichaScreen
            candidataId={candidataSeleccionada}
            onNavegarDosMundos={() => setPantallaActual('two worlds')}
          />
        )}
        {pantallaActual === 'field' && <FieldScreen />}
        {pantallaActual === 'learn' && <LearnScreen />}
        {pantallaActual === 'tests' && <TestsScreen />}
        {pantallaActual === 'data' && <DataScreen />}
      </main>

      {/* Fixed Horizon Bar at Bottom (Replaces traditional footer, controls Sol everywhere) */}
      <BarraHorizonte />

      {/* 90-Second Guided Tour Modal */}
      {mostrarRecorrido && (
        <Recorrido90Segundos
          onCerrar={() => setMostrarRecorrido(false)}
          onIrAPantalla={handleNavegarDesdeRecorrido}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <SolProvider>
      <AppContent />
    </SolProvider>
  );
};

export default App;
