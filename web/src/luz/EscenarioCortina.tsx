/**
 * The Earth/Moon stage with a curtain you can grab.
 *
 * - Pointer Events on the `.curtain` line (mouse, pen and touch share one path; pointer capture + window fallback).
 * - With Dos Mundos focused: ← / → move 1 % (Shift: 10 %), Home / End go to the ends,
 *   L shows the Moon and T shows Earth. Nothing happens while typing in a field, nor with Ctrl / Alt / ⌘,
 *   so Ctrl K and the SI assistant keep working.
 * - Values are whole percents in the same range as the native slider, which stays as the accessible
 *   alternative: dragging, keys and the slider always land on the same number.
 */
import { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, TouchEvent, useEffect, useRef } from "react";

export function escribiendoEnCampo(objetivo: EventTarget | null): boolean {
  const el = objetivo as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  const campo = el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
  if (!campo) return false;
  if (campo instanceof HTMLInputElement && campo.type === "range") return false;
  return true;
}

export default function EscenarioCortina({
  corte,
  onCorte,
  min = 5,
  max = 95,
  etiqueta,
  children,
}: {
  corte: number;
  onCorte: (v: number) => void;
  min?: number;
  max?: number;
  /** Accessible name of the stage, including the keys. */
  etiqueta: string;
  children: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const arrastrando = useRef<boolean>(false);
  const puntero = useRef<number | null>(null);

  const fijar = (v: number) => onCorte(Math.round(Math.min(max, Math.max(min, v))));
  const desde = (x: number) => {
    const r = caja.current?.getBoundingClientRect();
    if (r && r.width > 0) fijar(((x - r.left) / r.width) * 100);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!arrastrando.current) return;
      if (puntero.current !== null && e.pointerId !== puntero.current) return;
      desde(e.clientX);
    };
    const onUp = (e: PointerEvent) => {
      if (!arrastrando.current) return;
      if (puntero.current !== null && e.pointerId !== puntero.current) return;
      arrastrando.current = false;
      puntero.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  });

  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
    if (escribiendoEnCampo(e.target)) return;
    const paso = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case "ArrowLeft":
        fijar(corte - paso);
        break;
      case "ArrowRight":
        fijar(corte + paso);
        break;
      case "Home":
        fijar(min);
        break;
      case "End":
        fijar(max);
        break;
      case "l":
      case "L":
        fijar(max);
        break;
      case "t":
      case "T":
        fijar(min);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const iniciarPuntero = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.stopPropagation();
    caja.current?.focus({ preventScroll: true });
    arrastrando.current = true;
    puntero.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events in automated tests may not have an active pointerId.
    }
    desde(e.clientX);
  };

  const moverPuntero = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrastrando.current) return;
    if (puntero.current !== null && e.pointerId !== puntero.current) return;
    desde(e.clientX);
  };

  const soltarPuntero = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrastrando.current) return;
    arrastrando.current = false;
    puntero.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic events.
    }
  };

  const iniciarTouch = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    caja.current?.focus({ preventScroll: true });
    arrastrando.current = true;
    desde(e.touches[0].clientX);
  };

  const moverTouch = (e: TouchEvent<HTMLDivElement>) => {
    if (!arrastrando.current || e.touches.length === 0) return;
    desde(e.touches[0].clientX);
  };

  const soltarTouch = () => {
    arrastrando.current = false;
  };

  return (
    <div
      ref={caja}
      className="comparison mundos"
      role="group"
      tabIndex={0}
      aria-label={etiqueta}
      aria-keyshortcuts="ArrowLeft ArrowRight Home End L T"
      onKeyDown={tecla}
      onPointerDownCapture={(e) => {
        const el = e.target as HTMLElement | null;
        if (el && !el.closest("button, input, select, textarea, a")) {
          caja.current?.focus({ preventScroll: true });
        }
      }}
    >
      {children}
      <div
        className="curtain asa-cortina"
        aria-hidden="true"
        data-corte={corte}
        onPointerDown={iniciarPuntero}
        onPointerMove={moverPuntero}
        onPointerUp={soltarPuntero}
        onPointerCancel={soltarPuntero}
        onTouchStart={iniciarTouch}
        onTouchMove={moverTouch}
        onTouchEnd={soltarTouch}
        style={{
          left: `${corte}%`,
          pointerEvents: "auto",
          cursor: "ew-resize",
          touchAction: "none",
          zIndex: 2,
        }}
      >
        <span
          style={{
            position: "absolute",
            insetBlock: 0,
            left: -21,
            width: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              display: "block",
              width: 12,
              height: 48,
              background: "var(--surface)",
              border: "1px solid var(--input-line)",
              borderRadius: "var(--small-radius)",
              boxShadow: "var(--plate-shadow)",
            }}
          />
        </span>
      </div>
    </div>
  );
}
