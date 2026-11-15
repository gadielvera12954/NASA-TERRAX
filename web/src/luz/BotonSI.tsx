/** Secondary action that hands what is on screen to the SI assistant. Same button classes as the views. */
import { Sparkles } from "lucide-react";
import { explicarConSI } from "./explicarConSI";

export default function BotonSI({
  texto,
  pregunta,
  contexto,
  disabled,
}: {
  texto: string;
  /** Built at click time so it carries the numbers of that moment. */
  pregunta: () => string;
  contexto?: () => Record<string, unknown>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn sec chico boton-si"
      disabled={disabled}
      aria-controls="terrax-guia"
      onClick={() => explicarConSI(pregunta(), contexto?.())}
    >
      <Sparkles aria-hidden="true" size={16} />
      {texto}
    </button>
  );
}
