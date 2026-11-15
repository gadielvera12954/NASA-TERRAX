/** Public UI contract. Other owners only need this module to open the SI. */
export const EVENTO_SI = "terrax:si";

export interface AperturaSI {
  pregunta: string;
  contexto?: Record<string, unknown>;
}

/** Opens and prefills the panel; never sends a question automatically. */
export function abrirSI(pregunta: string, contexto?: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent<AperturaSI>(EVENTO_SI, {
    detail: { pregunta, contexto },
  }));
}
