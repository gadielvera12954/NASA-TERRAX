import React from 'react';

export const LearnScreen: React.FC = () => {
  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 80px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div className="et" style={{ marginBottom: '4px' }}>
          Educational Outreach · Yvy ha Jasy (Earth and Moon)
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: 900 }}>
          Educational Cards in Spanish & Jopara (Guaraní)
        </h1>
        <p style={{ color: 'var(--texto-sec)', fontSize: '14px', marginTop: '4px' }}>
          Connecting lunar science with local Paraguayan soil and skies for classrooms and young explorers.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {/* Card 1 */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '8px' }}>
            Yvy ha Jasy · Tarjeta 1
          </div>
          <h3 style={{ fontSize: '18px', marginBottom: '10px', color: 'var(--sol)' }}>
            ¿La tierra colorada es suelo lunar?
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-sec)', lineHeight: 1.5, marginBottom: '16px' }}>
            No. La <b>yvy pytã</b> (tierra colorada) es basalto profundamente oxidado y meteorizado por millones de años de lluvia y agua líquida. En la Luna no hay agua líquida ni atmósfera oxigenada.
          </p>
          <span className="etq inco" style={{ fontSize: '10px' }}>
            Error conceptual común
          </span>
        </div>

        {/* Card 2 */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '8px' }}>
            Yvy ha Jasy · Tarjeta 2
          </div>
          <h3 style={{ fontSize: '18px', marginBottom: '10px', color: 'var(--sol)' }}>
            Medí tu sombra como en la Luna
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-sec)', lineHeight: 1.5, marginBottom: '16px' }}>
            A las 18:36 del 14 de noviembre en Ciudad del Este, el Sol se posa a exactamente 5.0° del horizonte. Una tablita de 50 cm de altura proyecta una sombra de 5,72 m.
          </p>
          <span className="etq sost" style={{ fontSize: '10px' }}>
            Experimento en el patio
          </span>
        </div>

        {/* Card 3: Glossary */}
        <div className="panel">
          <div className="et" style={{ marginBottom: '8px' }}>
            Glosario Jopara / Guaraní
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '10px 0' }}>
            <div className="fila-dato">
              <span className="label" style={{ fontFamily: 'var(--mono)', color: 'var(--sol)' }}>yvy</span>
              <span className="val">tierra / suelo</span>
            </div>
            <div className="fila-dato">
              <span className="label" style={{ fontFamily: 'var(--mono)', color: 'var(--luna)' }}>jasy</span>
              <span className="val">luna</span>
            </div>
            <div className="fila-dato">
              <span className="label" style={{ fontFamily: 'var(--mono)', color: 'var(--sol)' }}>kuarahy</span>
              <span className="val">sol</span>
            </div>
            <div className="fila-dato">
              <span className="label" style={{ fontFamily: 'var(--mono)', color: 'var(--tierra)' }}>yvy pytã</span>
              <span className="val">tierra colorada</span>
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--sec-dark)', marginTop: '8px' }}>
            Revisado por hablante nativo para precisión etnográfica y científica.
          </p>
        </div>
      </div>
    </div>
  );
};
