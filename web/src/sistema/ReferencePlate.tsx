import { lazy, Suspense, useState } from "react";
import { Box, Layers, Map } from "lucide-react";
import { useLanguage } from "../i18n/Language";
import type { EstadoMotor } from "../datos/laboratorio";
const HeroTerreno = lazy(() => import("../pantallas/operacion/HeroTerreno"));

export default function ReferencePlate({
  motor,
  openLab,
}: {
  motor: EstadoMotor | null;
  openLab: () => void;
}) {
  const { t } = useLanguage();
  const [interactive, setInteractive] = useState(false);
  const map = (
    <div className="relief-map">
      <img
        src="/img/mons-mouton-atlas.webp"
        width="1200"
        height="700"
        alt={t(
          "Elevation contours across the cratered surface of Mons Mouton.",
          "Curvas de nivel sobre la superficie de cráteres de Mons Mouton.",
        )}
      />
      <div className="map-key">
        <span aria-hidden="true" />
        {t("100 m contours", "Curvas cada 100 m")}
      </div>
    </div>
  );
  return (
    <figure className="reference-plate">
      <div className="plate-heading">
        <div>
          <Layers size={17} aria-hidden="true" />
          <span>{t("Lunar reference", "Referencia lunar")}</span>
        </div>
        <button
          aria-pressed={interactive}
          onClick={() => setInteractive((v) => !v)}
        >
          {interactive ? <Map size={16} /> : <Box size={16} />}
          {interactive
            ? t("View map", "Ver mapa")
            : t("View in 3D", "Ver en 3D")}
        </button>
      </div>
      {interactive ? (
        <Suspense fallback={map}>
          <HeroTerreno motor={motor} onAbrir={openLab} />
        </Suspense>
      ) : (
        map
      )}
      <figcaption>
        <div>
          <strong>Mons Mouton</strong>
          <span>{t("Lunar south pole", "Polo sur lunar")}</span>
        </div>
        <div className="plate-source">
          <span>NASA / LOLA</span>
          <span>{t("60 m source grid", "Grilla fuente de 60 m")}</span>
        </div>
      </figcaption>
    </figure>
  );
}
