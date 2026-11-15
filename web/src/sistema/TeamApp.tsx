import React, { useEffect, useState } from 'react';
import { SolProvider } from '../luz/SolContext';
import { BarraHorizonte } from '../luz/BarraHorizonte';
import { MissionScreen } from '../pantallas/mission/MissionScreen';
import { DestinationScreen } from '../pantallas/destination/DestinationScreen';
import { DosMundosScreen } from '../pantallas/dos-mundos/DosMundosScreen';
import { SearchScreen } from '../pantallas/search/SearchScreen';
import { TestsScreen } from '../pantallas/tests/TestsScreen';
import { DataScreen } from '../pantallas/data/DataScreen';
import { FieldScreen } from '../pantallas/field/FieldScreen';
import { LearnScreen } from '../pantallas/learn/LearnScreen';
import { Recorrido90Segundos } from '../recorrido/Recorrido90Segundos';
import { Sparkles, AlertCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import '../sistema/tokens.css';

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
  const [mostrarRecorrido, setMostrarRecorrido] = useState<boolean>(false);
  // Scope the legacy manifest notice to the specialist views using example site records.
  const [isMockData, setIsMockData] = useState<boolean>(true);
  useEffect(() => {
    fetch('/data/manifest.json')
      .then((r) => r.json())
      .then((m) => setIsMockData(Boolean(m.maqueta)))
      .catch(() => setIsMockData(true));
  }, []);

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
    const url = new URL('/', location.origin);
    url.searchParams.set('candidate', id);
    url.hash = 'card';
    location.assign(url);
  };

  const handleNavegarDesdeRecorrido = (tab: string) => {
    const matched = navItems.find((n) => n.id.toLowerCase() === tab.toLowerCase());
    if (matched) {
      setPantallaActual(matched.id);
    } else if (tab.includes('card') || tab.includes('ficha')) {
      handleSeleccionarParcela('P-07');
    }
  };

  return (
    <div className="team-workspace" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--noche)' }}>
      {/* Top Banner for Mock Data requirement */}
      {isMockData && ['search', 'ficha', 'two worlds'].includes(pantallaActual) && (
        <div className="banner-mock">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={13} />
            <span>Demonstration site records</span>
          </div>
          <a href="/#checks">Sources and verification</a>
        </div>
      )}

      {/* Main Sticky Navigation */}
      <nav className="terra-nav">
        <a className="logo" href="/#home"><span className="symbol" aria-hidden="true" />TERRA-X</a>
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

          <a href="/#home">Bilingual atlas</a>
          <ThemeToggle />
        </div>
      </nav>

      {(pantallaActual === 'destination' || pantallaActual === 'two worlds') && <BarraHorizonte />}
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
        {pantallaActual === 'field' && <FieldScreen />}
        {pantallaActual === 'learn' && <LearnScreen />}
        {pantallaActual === 'tests' && <TestsScreen />}
        {pantallaActual === 'data' && <DataScreen />}
      </main>



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
