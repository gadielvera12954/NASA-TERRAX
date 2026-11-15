/**
 * Layout of the home hero: Earth, Mars and the Moon side by side, drawn to the same scale
 * (radii from the NSSDCA fact sheets in `CONSTANTES`). This module has no three.js in it, so the
 * page can place the labels and the flat stand-in before the 3D view loads.
 */
import { CONSTANTES, Mundo } from "../escena3d/mundos";

export interface Cuerpo {
  id: Mundo;
  /** Centre in Earth radii (x right, y up). */
  x: number;
  y: number;
  /** Radius in Earth radii: the true size ratio. */
  r: number;
}

const R = (m: Mundo) => CONSTANTES[m].radioKm / CONSTANTES.tierra.radioKm;

export const CUERPOS: Cuerpo[] = [
  { id: "tierra", x: -1.02, y: 0.06, r: R("tierra") },
  { id: "marte", x: 1.02, y: 0.36, r: R("marte") },
  { id: "luna", x: 1.98, y: -0.5, r: R("luna") },
];

/** Box that must stay in view (Earth's atmosphere halo and room for the labels underneath). */
const BORDES = { x0: -2.18, x1: 2.4, y0: -1.32, y1: 1.16 };

export interface Encuadre {
  /** Pixels per Earth radius. */
  s: number;
  ancho: number;
  alto: number;
  /** World point at the centre of the box. */
  mx: number;
  my: number;
}

export function encuadre(ancho: number, alto: number): Encuadre {
  const w = BORDES.x1 - BORDES.x0;
  const h = BORDES.y1 - BORDES.y0;
  const s = Math.max(1, Math.min(ancho / w, alto / h));
  return { s, ancho, alto, mx: (BORDES.x0 + BORDES.x1) / 2, my: (BORDES.y0 + BORDES.y1) / 2 };
}

export function aPixeles(c: Cuerpo, e: Encuadre) {
  return {
    x: e.ancho / 2 + (c.x - e.mx) * e.s,
    y: e.alto / 2 - (c.y - e.my) * e.s,
    r: c.r * e.s,
  };
}

/** Sidereal rotation periods, hours (NSSDCA). The display turns the Earth once every 60 s. */
export const ROTACION_H: Record<Mundo, number> = { tierra: 23.9345, marte: 24.6229, luna: 655.72 };
export const VUELTA_TIERRA_S = 60;
