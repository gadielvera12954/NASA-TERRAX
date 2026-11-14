"""Vista previa del mapa de refugios para el informe (no es la pantalla de la app; esa es de Erwan).

    python -m motor.destino.vista --objetivo datos/grillas/mons_mouton_60m

Relieve sombreado en gris, refugios (≤ 50 h sin Sol) en amarillo "Sol rasante" (#E7F434), de 50 a
100 h en un amarillo apagado, el punto del rover con una cruz. PNG RGB escrito con zlib.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import argparse
import pathlib
import struct
import zlib

import numpy as np

from motor.horizonte.grilla import leer_grilla

from . import png16

RAIZ = pathlib.Path(__file__).resolve().parents[2]


def png_rgb(ruta: pathlib.Path, rgb: np.ndarray) -> None:
    alto, ancho, _ = rgb.shape
    crudo = b"".join(b"\x00" + np.ascontiguousarray(rgb[f], dtype=np.uint8).tobytes() for f in range(alto))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(crudo, 9)) + chunk(b"IEND", b""))


def sombreado(z: np.ndarray, pixel_m: float, az_deg: float = 315.0, alt_deg: float = 35.0) -> np.ndarray:
    zz = np.where(np.isfinite(z), z, np.nanmean(z))
    gy, gx = np.gradient(zz, pixel_m)
    pend = np.arctan(np.hypot(gx, gy))
    aspecto = np.arctan2(-gx, gy)
    az, alt = np.radians(az_deg), np.radians(alt_deg)
    h = np.sin(alt) * np.cos(pend) + np.cos(alt) * np.sin(pend) * np.cos(az - aspecto)
    return np.clip(h, 0, 1)


def figura(z: np.ndarray, pixel_m: float, horas: np.ndarray, limite: float, fila: int, col: int, escala: int = 2) -> np.ndarray:
    base = 40 + 150 * sombreado(z, pixel_m)
    rgb = np.stack([base, base, base * 1.02], axis=-1)
    # Misma leyenda que la pantalla Destination: ≤ 50 h verde, 50-100 h ámbar, > 100 h rojo tenue.
    verde, ambar, rojo = (np.array(c, dtype=float) for c in ([52, 211, 153], [251, 191, 36], [248, 113, 113]))
    refugio = (horas <= limite)
    cerca = (horas > limite) & (horas <= 2 * limite)
    lejos = horas > 2 * limite
    rgb[refugio] = 0.1 * rgb[refugio] + 0.9 * verde
    rgb[cerca] = 0.3 * rgb[cerca] + 0.7 * ambar
    # Dentro de "> 100 h" el rojo se intensifica con las horas: se ve dónde la noche es más corta.
    a = np.clip(0.15 + 0.6 * (horas - 2 * limite) / 500.0, 0.15, 0.75)[..., None]
    rgb = np.where(lejos[..., None], (1 - a) * rgb + a * rojo, rgb)
    rgb[np.isnan(z)] = [7, 23, 63]                                    # --noche
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    for d in range(-6, 7):                                            # cruz del rover
        for f, c in ((fila + d, col), (fila, col + d)):
            if 0 <= f < rgb.shape[0] and 0 <= c < rgb.shape[1]:
                rgb[f, c] = [255, 255, 255]
    return np.kron(rgb, np.ones((escala, escala, 1), dtype=np.uint8))


def principal(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--objetivo", required=True)
    p.add_argument("--salida", default=str(RAIZ / "salida"))
    p.add_argument("--figuras", default=str(RAIZ / "informe" / "figuras"))
    a = p.parse_args(argv)
    capa, meta = leer_grilla(a.objetivo)
    import json
    for nombre in ("verano", "invierno"):
        ruta = pathlib.Path(a.salida) / "destino" / f"refugios_{nombre}.png"
        ficha = json.loads((pathlib.Path(a.salida) / "destino" / f"ficha_{nombre}.json").read_text(encoding="utf-8"))
        h = png16.leer(ruta).astype(float)
        h[h == png16.SIN_DATO] = np.nan
        fila, col = ficha["punto"]["fila"], ficha["punto"]["col"]
        img = figura(capa.z, capa.pixel_m, h, ficha["refugios"]["limite_h"], fila, col)
        destino = pathlib.Path(a.figuras) / f"refugios_{nombre}{'_maqueta' if ficha['maqueta'] else ''}.png"
        png_rgb(destino, img)
        print(f"{destino}: refugios en {100 * ficha['refugios']['fraccion_terreno']:.2f} % del recorte")


if __name__ == "__main__":
    principal()
