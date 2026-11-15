/**
 * The three worlds of the comparison and their published constants.
 *
 * Every number below is copied from the NASA NSSDCA planetary fact sheets (links in `FUENTES`) or
 * computed from them with the formula written next to it. Nothing here comes from the 3D meshes.
 */
export type Mundo = "luna" | "tierra" | "marte";
export type Par = "luna-tierra" | "marte-tierra" | "luna-marte";

/** Left of the curtain, right of the curtain. */
export const PARES: Record<Par, [Mundo, Mundo]> = {
  "luna-tierra": ["luna", "tierra"],
  "marte-tierra": ["marte", "tierra"],
  "luna-marte": ["luna", "marte"],
};

/** Relief mesh of each world in /modelos/modelos.json → `terrenos`. */
export const MODELO: Record<Mundo, "mons_mouton" | "payunia" | "marte_jezero"> = {
  luna: "mons_mouton",
  tierra: "payunia",
  marte: "marte_jezero",
};

export const FUENTES = {
  luna: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
  tierra: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
  marte: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
} as const;

export interface Constantes {
  /** Surface gravity, m/s². */
  gravedad: number;
  /** Mean solar day (sunrise to sunrise), hours. Moon: synodic month 29.53 d. */
  diaSolarH: number;
  /** Tilt of the equator that sets how high the polar Sun can climb, degrees. */
  inclinacionDeg: number;
  /** Volumetric mean radius, km. */
  radioKm: number;
  /** Mean surface pressure, hPa (the Moon has only a tenuous exosphere). */
  presionHpa: number;
  /** Solar irradiance at the body's mean distance, W/m². */
  irradianciaWm2: number;
  /** Mean distance to the Sun, AU (sets the Sun's apparent size). */
  distanciaUA: number;
}

export const CONSTANTES: Record<Mundo, Constantes> = {
  // Moon fact sheet: g 1.62; synodic period 29.53 d; equator tilt to the ecliptic = obliquity to
  // orbit 6.68° − orbit inclination 5.145° = 1.54°; radius 1737.4 km; it orbits at Earth's distance.
  luna: { gravedad: 1.62, diaSolarH: 29.53 * 24, inclinacionDeg: 6.68 - 5.145, radioKm: 1737.4, presionHpa: 0, irradianciaWm2: 1361.0, distanciaUA: 1.0 },
  // Earth fact sheet: g 9.80; solar day 24.0 h; obliquity 23.44°; radius 6371.0 km; 1014 mb; 1361.0 W/m².
  tierra: { gravedad: 9.8, diaSolarH: 24.0, inclinacionDeg: 23.44, radioKm: 6371.0, presionHpa: 1014, irradianciaWm2: 1361.0, distanciaUA: 1.0 },
  // Mars fact sheet: g 3.71; solar day 24.6597 h; obliquity 25.19°; radius 3389.5 km; 6.36 mb; 586.2 W/m²; 1.524 AU.
  marte: { gravedad: 3.71, diaSolarH: 24.6597, inclinacionDeg: 25.19, radioKm: 3389.5, presionHpa: 6.36, irradianciaWm2: 586.2, distanciaUA: 1.524 },
};

/** Apparent diameter of the Sun, degrees: 0.533° at 1 AU, scaled by 1/distance. */
export function diametroSolDeg(m: Mundo): number {
  return 0.533 / CONSTANTES[m].distanciaUA;
}

/** Distance to the horizon for an eye `h` metres above a smooth sphere: √(2Rh), km. */
export function horizonteKm(m: Mundo, h = 1.8): number {
  return Math.sqrt(2 * CONSTANTES[m].radioKm * 1000 * h) / 1000;
}

/** Shadow length of an object of height h with the Sun at elevation e (degrees): h / tan(e). */
export function sombraM(h: number, e: number): number | null {
  return e > 0.05 ? h / Math.tan((e * Math.PI) / 180) : null;
}

/** Fuzzy tip of that shadow from the Sun's apparent size (geometric penumbra), metres. */
export function penumbraM(h: number, e: number, m: Mundo): number | null {
  const r = ((diametroSolDeg(m) / 2) * Math.PI) / 180;
  const a = (e * Math.PI) / 180;
  if (a - r <= 0) return null;
  return h / Math.tan(a - r) - h / Math.tan(a + r);
}

export const NOMBRES: Record<Mundo, { en: string; es: string; sitioEn: string; sitioEs: string; dem: string }> = {
  luna: { en: "Moon", es: "Luna", sitioEn: "Mons Mouton, south pole", sitioEs: "Mons Mouton, polo sur", dem: "NASA LOLA · 60 m" },
  tierra: { en: "Earth", es: "Tierra", sitioEn: "Payunia, around P-27", sitioEs: "Payunia, alrededor de P-27", dem: "Copernicus GLO-30 · 60 m" },
  marte: { en: "Mars", es: "Marte", sitioEn: "Jezero crater, Perseverance site", sitioEs: "Cráter Jezero, sitio de Perseverance", dem: "USGS HRSC + MOLA · 200 m" },
};
