/**
 * "Explain with the SI" from any scientific view, without touching the app shell.
 *
 * Contract with Nahum (000-entrega-hoy, N1): `web/src/si/abrirSI.ts` exports
 * `abrirSI(pregunta, contexto?)`, which fires the `terrax:si` CustomEvent that AsistenteSI listens to.
 * When that module is present it is used as is. Until it lands, we also dispatch `terrax:si` directly
 * and open the existing assistant through its own trigger, typing the question into its own field so
 * the button works immediately in both standalone and integrated runs.
 */
type AbrirSI = (pregunta: string, contexto?: Record<string, unknown>) => void;

// Vite resolves the glob at build time: an empty object while the file does not exist.
const modulos = import.meta.glob<{ abrirSI?: AbrirSI }>("../si/abrirSI.ts", { eager: true });
const abrirOficial: AbrirSI | undefined = Object.values(modulos)[0]?.abrirSI;

/** The assistant field accepts 600 characters. */
const MAXIMO = 600;

function escribirEnAsistente(pregunta: string): boolean {
  const consola = document.getElementById("terrax-guia");
  const disparador = document.querySelector<HTMLButtonElement>(".si-trigger");
  if (!consola || !disparador) return false;
  if (consola.getAttribute("data-open") !== "true") disparador.click();
  // The trigger focuses its field after 60 ms; write after that so the cursor lands at the end.
  window.setTimeout(() => {
    const campo = consola.querySelector<HTMLInputElement>("input[type='text']");
    if (!campo) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(campo, pregunta);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.focus();
    campo.setSelectionRange(pregunta.length, pregunta.length);
  }, 90);
  return true;
}

export function explicarConSI(pregunta: string, contexto?: Record<string, unknown>): void {
  const texto = pregunta.replace(/\s+/g, " ").trim().slice(0, MAXIMO);
  if (!texto) return;
  if (abrirOficial) {
    abrirOficial(texto, contexto);
    return;
  }
  window.dispatchEvent(
    new CustomEvent("terrax:si", {
      detail: { pregunta: texto, contexto },
    }),
  );
  escribirEnAsistente(texto);
}
