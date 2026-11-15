import {
  CornerUpLeft,
  CornerUpRight,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Spherical, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useLanguage } from "../i18n/Language";

export interface CameraActions {
  acercar(factor: number): void;
  girar(direction: number): void;
  restablecer(): void;
}
export function turnCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  direction: number,
) {
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new Spherical().setFromVector3(offset);
  spherical.theta += (direction * Math.PI) / 8;
  camera.position
    .copy(controls.target)
    .add(new Vector3().setFromSpherical(spherical));
  controls.update();
}
export function CameraControls({
  camera,
  zoomIn,
  zoomOut,
}: {
  camera: React.RefObject<CameraActions>;
  zoomIn: string;
  zoomOut: string;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="zoom"
      role="group"
      aria-label={t("Camera controls", "Controles de cámara")}
    >
      <button
        type="button"
        title={t("Rotate left", "Girar a la izquierda")}
        onClick={() => camera.current?.girar(-1)}
      >
        <CornerUpLeft />
      </button>
      <button
        type="button"
        title={t("Rotate right", "Girar a la derecha")}
        onClick={() => camera.current?.girar(1)}
      >
        <CornerUpRight />
      </button>
      <button
        type="button"
        title={zoomIn}
        onClick={() => camera.current?.acercar(0.8)}
      >
        <Plus />
      </button>
      <button
        type="button"
        title={zoomOut}
        onClick={() => camera.current?.acercar(1.25)}
      >
        <Minus />
      </button>
      <button
        type="button"
        title={t("Reset camera", "Restablecer cámara")}
        onClick={() => camera.current?.restablecer()}
      >
        <RotateCcw />
      </button>
    </div>
  );
}
