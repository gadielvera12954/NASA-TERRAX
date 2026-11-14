"""Geometría básica del horizonte y de las proyecciones (F1, F2).

Uso de SI: redactado con Claude Code a partir del documento 02; cada fórmula tiene su prueba en
motor/tests (test_horizonte_poste.py, test_horizonte_esfera.py, test_geometria.py).
"""
from __future__ import annotations

import math

import numpy as np


def largo_sombra(alto_m: float, e_deg: float) -> float:
    """F1: sombra de un objeto vertical de altura h sobre un plano, con el Sol a elevación e."""
    return alto_m / math.tan(math.radians(e_deg))


def caida_curvatura(d_m, radio_m: float | None, k: float = 0.0):
    """F2: caída por curvatura Δz(d) = (1 − k)·d²/(2R). Sin radio (plano sintético) vale 0."""
    d = np.asarray(d_m, dtype=float)
    if radio_m is None or not math.isfinite(radio_m):
        out = np.zeros_like(d)
    else:
        out = (1.0 - k) * d * d / (2.0 * radio_m)
    return out if np.ndim(d_m) else float(out)


# ------------------------------------------------------------------------------------------------
# Proyección polar estereográfica sur sobre una esfera (la de los productos LOLA del polo sur):
#   ρ = 2R·tan(π/4 + φ/2),  x = ρ·sin(λ − λ0),  y = ρ·cos(λ − λ0)
# El norte geográfico de un punto apunta en la dirección radial hacia afuera, así que el ángulo
# (horario) desde el norte de la grilla hasta el norte geográfico es λ − λ0.
# ------------------------------------------------------------------------------------------------

def xy_desde_latlon_polar_sur(lat_deg, lon_deg, radio_m: float, lon0_deg: float = 0.0):
    lat = np.radians(np.asarray(lat_deg, dtype=float))
    dlon = np.radians(np.asarray(lon_deg, dtype=float) - lon0_deg)
    rho = 2.0 * radio_m * np.tan(np.pi / 4.0 + lat / 2.0)
    return rho * np.sin(dlon), rho * np.cos(dlon)


def latlon_desde_xy_polar_sur(x, y, radio_m: float, lon0_deg: float = 0.0):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    rho = np.hypot(x, y)
    lat = 2.0 * np.arctan(rho / (2.0 * radio_m)) - np.pi / 2.0
    lon = np.degrees(np.arctan2(x, y)) + lon0_deg
    lon = (lon + 180.0) % 360.0 - 180.0
    return np.degrees(lat), lon


def convergencia_polar_sur(lon_deg, lon0_deg: float = 0.0):
    """Ángulo a sumar a un azimut geográfico para obtener el azimut de la grilla (grados)."""
    return (np.asarray(lon_deg, dtype=float) - lon0_deg + 180.0) % 360.0 - 180.0


def convergencia_utm(lat_deg: float, lon_deg: float, zona: int) -> float:
    """Convergencia de meridianos en UTM (aproximación esférica, error < 0,01° en una parcela).

    Con γ = atan(tan(λ − λ0)·sin φ), el norte geográfico queda a −γ del norte de la grilla, así que
    A_grilla = A_geografico − γ.
    """
    lon0 = -183.0 + 6.0 * zona
    g = math.degrees(math.atan(math.tan(math.radians(lon_deg - lon0)) * math.sin(math.radians(lat_deg))))
    return -g


def base_enu(lat_deg, lon_deg):
    """Vectores unitarios este, norte y arriba en el marco fijo al cuerpo (esfera).

    Devuelve tres arreglos (..., 3). Sirve para pasar la dirección del Sol en el marco del cuerpo
    (MOON_ME en la Luna) a altura y azimut locales de cada píxel.
    """
    lat = np.radians(np.asarray(lat_deg, dtype=float))
    lon = np.radians(np.asarray(lon_deg, dtype=float))
    sl, cl = np.sin(lat), np.cos(lat)
    so, co = np.sin(lon), np.cos(lon)
    este = np.stack([-so, co, np.zeros_like(lat)], axis=-1)
    norte = np.stack([-sl * co, -sl * so, cl], axis=-1)
    arriba = np.stack([cl * co, cl * so, sl], axis=-1)
    return este, norte, arriba
