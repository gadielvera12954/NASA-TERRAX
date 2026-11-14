import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Mundo = 'luna' | 'tierra';

export interface SolState {
  elevacion: number;       // In degrees [1.5, 10.0]
  azimut: number;          // In degrees [0, 360)
  mundo: Mundo;            // 'luna' (hard shadows) or 'tierra' (diffuse shadows)
  alturaVirtualPx: number; // 2.0 px by design document
  longitudSombraPx: number;// 2 / tan(elevacion)
  sombraX: number;
  sombraY: number;
  desenfoque: number;      // 0 for Moon, >0 for Earth
  isAnimando: boolean;
  setElevacion: (val: number | ((prev: number) => number)) => void;
  setAzimut: (val: number | ((prev: number) => number)) => void;
  setMundo: (val: Mundo) => void;
  toggleAnimando: () => void;
  resetSol: () => void;
}

const SolContext = createContext<SolState | null>(null);

const VIRTUAL_HEIGHT = 2.0; // 2 px virtual panel height from design spec

export const SolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [elevacion, setElevacionState] = useState<number>(3.0);
  const [azimut, setAzimutState] = useState<number>(250.0);
  const [mundo, setMundo] = useState<Mundo>('luna');
  const [isAnimando, setIsAnimando] = useState<boolean>(false);

  // Clamped elevation setter
  const setElevacion = useCallback((val: number | ((prev: number) => number)) => {
    setElevacionState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      const clamped = Math.max(1.5, Math.min(10.0, next));
      return Math.round(clamped * 100) / 100;
    });
  }, []);

  // Azimuth setter [0, 360)
  const setAzimut = useCallback((val: number | ((prev: number) => number)) => {
    setAzimutState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      const normalized = ((next % 360) + 360) % 360;
      return Math.round(normalized * 10) / 10;
    });
  }, []);

  const resetSol = useCallback(() => {
    setElevacionState(3.0);
    setAzimutState(250.0);
    setMundo('luna');
  }, []);

  const toggleAnimando = useCallback(() => {
    setIsAnimando((prev) => !prev);
  }, []);

  // Compute physical shadow metrics
  // Formula: L = altura / tan(elevacion)
  const radEl = (elevacion * Math.PI) / 180;
  const longitudSombraPx = VIRTUAL_HEIGHT / Math.tan(radEl);

  // Direction opposite to azimuth
  const opuestoAzRad = ((azimut + 180) * Math.PI) / 180;
  const sombraX = longitudSombraPx * Math.sin(opuestoAzRad);
  const sombraY = -longitudSombraPx * Math.cos(opuestoAzRad);

  // Lunar vacuum = 0 blur; Earth atmosphere = diffused blur
  const desenfoque = mundo === 'luna' ? 0 : Math.max(3, Math.round(longitudSombraPx * 0.12));

  // Sync to root CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sol-el', `${elevacion.toFixed(2)}deg`);
    root.style.setProperty('--sol-az', `${azimut.toFixed(1)}deg`);
    root.style.setProperty('--sombra-x', `${sombraX.toFixed(1)}px`);
    root.style.setProperty('--sombra-y', `${sombraY.toFixed(1)}px`);
    root.style.setProperty('--sombra-blur', `${desenfoque}px`);
    root.style.setProperty(
      '--sombra-color',
      mundo === 'luna' ? 'rgba(0, 0, 0, 0.90)' : 'rgba(10, 15, 30, 0.65)'
    );
  }, [elevacion, azimut, sombraX, sombraY, desenfoque, mundo]);

  // Subtle animation loop when enabled
  useEffect(() => {
    if (!isAnimando) return;
    const interval = setInterval(() => {
      setElevacionState((prev) => {
        let next = prev + 0.05;
        if (next > 7.0) next = 1.5;
        return Math.round(next * 100) / 100;
      });
      setAzimutState((prev) => (prev + 0.3) % 360);
    }, 100);
    return () => clearInterval(interval);
  }, [isAnimando]);

  return (
    <SolContext.Provider
      value={{
        elevacion,
        azimut,
        mundo,
        alturaVirtualPx: VIRTUAL_HEIGHT,
        longitudSombraPx,
        sombraX,
        sombraY,
        desenfoque,
        isAnimando,
        setElevacion,
        setAzimut,
        setMundo,
        toggleAnimando,
        resetSol,
      }}
    >
      {children}
    </SolContext.Provider>
  );
};

export const useSol = (): SolState => {
  const context = useContext(SolContext);
  if (!context) {
    throw new Error('useSol must be used within a SolProvider');
  }
  return context;
};
