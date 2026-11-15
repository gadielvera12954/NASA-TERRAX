import {
  ArrowUpRight,
  Check,
  CircleHelp,
  MapPin,
  Minus,
  X,
} from "lucide-react";
import { useLanguage } from "../i18n/Language";
import type { IndexEntry } from "../datos/integration";

type Translate = (en: string, es: string) => string;
export const goals = {
  shadow: ["Observe light and shadows", "Observar luz y sombras"],
  robot: ["Practice robotic operations", "Practicar operaciones robóticas"],
  materials: ["Study surface materials", "Estudiar materiales superficiales"],
} as const;
export type Goal = keyof typeof goals;

export function siteName(name: string, t: Translate) {
  return name
    .replace(/\s*\((?:maqueta|mock)\)\s*$/i, "")
    .replace(
      "Recorte de Mons Mouton con ruido",
      t("Mons Mouton, noise sample", "Mons Mouton, muestra con ruido"),
    )
    .replace("Recorte de Mons Mouton", "Mons Mouton")
    .replace(" (control positivo)", "")
    .replace(" (control negativo)", "")
    .replace(" (control)", "");
}
export function Verdict({ value }: { value?: string }) {
  const { t } = useLanguage();
  const labels: Record<string, [string, string]> = {
    sostenido: ["Supported", "Respaldado"],
    analogo_sostenido: ["Supported", "Respaldado"],
    con_huecos: ["With evidence gaps", "Con vacíos de evidencia"],
    no_alcanza: ["Insufficient fit", "Ajuste insuficiente"],
    incompatible: ["Incompatible", "Incompatible"],
    no_puede: ["Inconclusive", "Sin conclusión"],
    no_podemos_concluir: ["Inconclusive", "Sin conclusión"],
  };
  const tag = value ?? "";
  const Icon = ["sostenido", "analogo_sostenido"].includes(tag)
    ? Check
    : tag === "incompatible"
      ? X
      : tag === "no_alcanza"
        ? Minus
        : CircleHelp;
  return (
    <span className={`verdict tag-${tag}`}>
      <Icon aria-hidden="true" size={15} />
      {labels[tag]
        ? t(...labels[tag])
        : t("Verdict unavailable", "Veredicto no disponible")}
    </span>
  );
}
export function GoalPicker({
  goal,
  change,
}: {
  goal: Goal;
  change: (g: Goal) => void;
}) {
  const { t } = useLanguage();
  return (
    <label>
      {t("Practice goal", "Objetivo del ensayo")}
      <select value={goal} onChange={(e) => change(e.target.value as Goal)}>
        {Object.entries(goals).map(([key, label]) => (
          <option key={key} value={key}>
            {t(label[0], label[1])}
          </option>
        ))}
      </select>
    </label>
  );
}
export function SiteList({
  entries,
  openSite,
}: {
  entries: IndexEntry[];
  openSite: (id: string) => void;
}) {
  const { t, language } = useLanguage();
  const coord = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  return (
    <ul className="site-list">
      {entries.map((site) => {
        const url = new URL(location.href);
        url.searchParams.set("candidate", site.id);
        url.hash = "card";
        return (
          <li key={site.id}>
            <a
              href={url.search + url.hash}
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  openSite(site.id);
                }
              }}
            >
              <span className="site-name">
                <MapPin size={19} aria-hidden="true" />
                {siteName(site.nombre, t)}
              </span>
              <span className="coordinates">
                {site.lugar &&
                Number.isFinite(site.lugar.lat) &&
                Number.isFinite(site.lugar.lon)
                  ? `${coord.format(site.lugar.lat)}°, ${coord.format(site.lugar.lon)}°`
                  : t("Coordinates unavailable", "Sin coordenadas")}
              </span>
              <Verdict value={site.etiqueta} />
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
