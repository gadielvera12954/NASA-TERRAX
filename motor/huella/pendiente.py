"""F8: pendiente de Horn (1981) con la vecindad de 3 x 3.

    β = atan( √(zx² + zy²) )
    zx = ((z3 + 2 z6 + z9) − (z1 + 2 z4 + z7)) / (8Δ)
    zy = ((z7 + 2 z8 + z9) − (z1 + 2 z2 + z3)) / (8Δ)

Numeración de la vecindad (fila 0 arriba = norte de la grilla):  z1 z2 z3 / z4 z5 z6 / z7 z8 z9.
Las celdas del borde y las que tienen algún vecino sin dato quedan NaN: no se inventa pendiente.

Uso de SI: redactado con Claude Code para la Parte 4; lo prueba motor/tests/test_parte4_huella.py.
"""
from __future__ import annotations

import numpy as np


def horn(z: np.ndarray, pixel_m: float) -> np.ndarray:
    z = np.asarray(z, dtype=np.float64)
    b = np.full(z.shape, np.nan, dtype=np.float32)
    if min(z.shape) < 3:
        return b
    z1, z2, z3 = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    z4, z6 = z[1:-1, :-2], z[1:-1, 2:]
    z7, z8, z9 = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    zx = ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8.0 * pixel_m)
    # La fila crece hacia el sur: (abajo − arriba) mide la caída hacia −y; el signo no cambia la pendiente.
    zy = ((z7 + 2 * z8 + z9) - (z1 + 2 * z2 + z3)) / (8.0 * pixel_m)
    b[1:-1, 1:-1] = np.degrees(np.arctan(np.hypot(zx, zy)))
    # Horn no usa la celda central (z5), pero una celda sin altura no puede tener pendiente.
    b[~np.isfinite(z)] = np.nan
    return b
