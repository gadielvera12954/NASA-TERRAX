"""F15: refracción atmosférica en la Tierra (fórmula de Sæmundsson). En la Luna R = 0.

    R(e) = 1,02 / tan(e + 10,3/(e + 5,11))  [minutos de arco],   e_ap = e + R(e)·(P/1010)·(283/(273 + T))

e es la altura geométrica (verdadera) en grados, P la presión en mbar y T la temperatura en °C.
Con P = 1010 y T = 10 (la condición estándar de Horizons) el factor vale 1.

Uso de SI: redactado con Claude Code; probado con los números del documento 02 en test_sol.py.
"""
from __future__ import annotations

import math

import numpy as np

PRESION_REF = 1010.0
TEMPERATURA_REF = 10.0


def saemundsson_deg(e_deg, presion_mbar: float = PRESION_REF, temperatura_c: float = TEMPERATURA_REF):
    """Refracción en grados. Se aplica con el Sol sobre −1°; más abajo la fórmula no vale y se toma 0."""
    e = np.asarray(e_deg, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        r_arcmin = 1.02 / np.tan(np.radians(e + 10.3 / (e + 5.11)))
    r = np.where(e > -1.0, r_arcmin / 60.0, 0.0) * (presion_mbar / PRESION_REF) * (283.0 / (273.0 + temperatura_c))
    return float(r) if np.ndim(e_deg) == 0 else r


def presion_estandar_mbar(altura_m: float) -> float:
    """Presión de la atmósfera estándar ISA a una altura (válida hasta 11 km)."""
    return 1013.25 * (1.0 - 2.25577e-5 * altura_m) ** 5.25588


def aparente(e_geo_deg, presion_mbar: float = PRESION_REF, temperatura_c: float = TEMPERATURA_REF):
    return np.asarray(e_geo_deg, dtype=float) + saemundsson_deg(e_geo_deg, presion_mbar, temperatura_c)


def efecto_en_sombra(e_deg: float) -> float:
    """Error relativo de la sombra calculada si se ignora la refracción (doc02: 3,2 % a 5°)."""
    ap = e_deg + saemundsson_deg(e_deg)
    return math.tan(math.radians(ap)) / math.tan(math.radians(e_deg)) - 1.0
