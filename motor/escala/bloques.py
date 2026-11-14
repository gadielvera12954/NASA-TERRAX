"""Promedio exacto de bloques enteros (20 m -> 60 m en la Luna). Nunca interpola.

Uso de SI: redactado con Claude Code para la Parte 4; lo prueba motor/tests/test_parte4_huella.py.
"""
from __future__ import annotations

import warnings

import numpy as np


def promedio(z: np.ndarray, factor: int, devolver_validos: bool = False):
    """Promedia bloques de `factor` x `factor` celdas.

    Un bloque con algunas celdas sin dato queda con el promedio de las válidas (no se inventa nada)
    y se informa cuántas había; un bloque sin ninguna queda NaN.
    """
    z = np.asarray(z, dtype=np.float64)
    alto, ancho = z.shape
    if factor < 1 or alto % factor or ancho % factor:
        raise ValueError(f"la grilla de {alto} x {ancho} no se divide en bloques de {factor} x {factor}")
    b = z.reshape(alto // factor, factor, ancho // factor, factor)
    validos = np.isfinite(b).sum(axis=(1, 3))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        r = np.nanmean(b, axis=(1, 3)).astype(np.float32)
    return (r, validos) if devolver_validos else r
