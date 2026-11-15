import { useSol } from './SolContext';

export function BarraHorizonte() {
  const { elevacion, azimut, mundo, setElevacion, setAzimut, setMundo, resetSol, isAnimando, toggleAnimando } = useSol();
  return <section className="specialist-sun" aria-label="Solar settings for this scientific view">
    <h2>Solar settings for this view</h2>
    <label>Sun elevation · {elevacion.toFixed(1)}°
      <input type="range" min="1.5" max="10" step="0.1" value={elevacion} onChange={e => setElevacion(Number(e.target.value))} />
    </label>
    <label>Sun azimuth · {azimut.toFixed(0)}°
      <input type="range" min="0" max="359" value={azimut} onChange={e => setAzimut(Number(e.target.value))} />
    </label>
    <label>Environment <select value={mundo} onChange={e => setMundo(e.target.value === 'luna' ? 'luna' : 'tierra')}>
      <option value="luna">Moon</option><option value="tierra">Earth</option>
    </select></label>
    <button className="btn sec" aria-pressed={isAnimando} onClick={toggleAnimando}>{isAnimando ? 'Pause Sun' : 'Move Sun'}</button>
    <button className="btn sec" onClick={resetSol}>Reset settings</button>
  </section>;
}
