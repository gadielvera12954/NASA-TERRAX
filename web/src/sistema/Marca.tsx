/** Drawn marks for verdicts and test states (one icon set, one stroke weight), instead of glyphs. */
import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleOff,
  CircleX,
  LucideIcon,
  X,
} from "lucide-react";

const ICONOS: Record<string, LucideIcon> = {
  sostenido: CircleCheck,
  analogo_sostenido: CircleCheck,
  con_huecos: CircleDashed,
  no_alcanza: CircleOff,
  no_puede: CircleHelp,
  no_podemos_concluir: CircleHelp,
  incompatible: CircleX,
  pasa: Check,
  falla: X,
  pendiente: CircleHelp,
  ok: Check,
  mal: X,
};

export function Marca({ tono, size = 15 }: { tono: string; size?: number }) {
  const Icono = ICONOS[tono] ?? CircleHelp;
  return <Icono aria-hidden="true" size={size} strokeWidth={2} style={{ flex: "none" }} />;
}
