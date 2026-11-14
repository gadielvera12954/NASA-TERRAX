"""F13: correlación de la iluminación simulada con el mapa de iluminación de NASA (PGDA 69).

    ρ_S = 1 − 6 Σ d_i² / (n(n² − 1))   (con empates: Pearson sobre rangos), más el error cuadrático
    medio en puntos de iluminación.

Plan del documento 02 (§3.7): 10.000 puntos al azar, los 18,6 años completos a pasos de 3 horas
(~54.000 fechas por punto), altura de observador 0 (el mapa de NASA es de superficie). La
iluminación de cada punto es la fracción media del disco solar visible (F3) con su horizonte.
Meta: ρ ≥ 0,8 (hipótesis H3).

Uso de SI: redactado con Claude Code; probado en test_validacion.py con un mapa de control.
"""
from __future__ import annotations

import datetime as dt

import numpy as np
from scipy.stats import spearmanr

from motor.horizonte import calcular_horizontes_puntos
from motor.horizonte.grilla import convergencia, latlon
from motor.sol.posicion import rango_utc, vector_sol_luna_me

from .refugios import mapa_refugios


def puntos_al_azar(alto: int, ancho: int, n: int, semilla: int, valido=None) -> np.ndarray:
    rng = np.random.default_rng(semilla)
    if valido is None:
        idx = rng.choice(alto * ancho, size=min(n, alto * ancho), replace=False)
    else:
        cand = np.flatnonzero(valido.ravel())
        idx = rng.choice(cand, size=min(n, cand.size), replace=False)
    return np.stack(np.unravel_index(idx, (alto, ancho)), axis=1)


def iluminacion_puntos(capas, meta: dict, puntos: np.ndarray, desde: dt.datetime, hasta: dt.datetime, paso_h: float = 3.0,
                       n_az: int = 72, altura_obs_m: float = 0.0, radio_m: float = 1737400.0, d_max_m: float | None = None,
                       paso_rel: float = 0.001) -> np.ndarray:
    """Fracción media del disco solar visible en cada punto, entre `desde` y `hasta`."""
    h = calcular_horizontes_puntos(capas, [tuple(p) for p in puntos], n_az=n_az, altura_obs_m=altura_obs_m, radio_m=radio_m,
                                   k=0.0, d_max_m=d_max_m, paso_rel=paso_rel)            # (n, n_az)
    filas, cols = puntos[:, 0], puntos[:, 1]
    lat, lon = latlon(capas[0], meta, filas, cols)
    conv = convergencia(capas[0], meta, filas, cols)
    t = rango_utc(desde, hasta, paso_h * 3600.0)
    s = vector_sol_luna_me(t)
    # Se reutiliza el núcleo de F20 con una "grilla" de 1 × n puntos y toda la serie como ventana.
    res = mapa_refugios(h.T[:, None, :].astype(np.float64), np.asarray(lat)[None, :], np.asarray(lon)[None, :],
                        np.asarray(conv)[None, :], desde, hasta, vectores=(t, s, 0, len(t)))
    return res["visibilidad"][0]


def correlacion(simulada, nasa) -> dict:
    """F13: ρ de Spearman y error cuadrático medio (en puntos de iluminación, 0 a 100)."""
    a = np.asarray(simulada, dtype=float)
    b = np.asarray(nasa, dtype=float)
    ok = np.isfinite(a) & np.isfinite(b)
    rho = float(spearmanr(a[ok], b[ok]).statistic)
    rmse = float(np.sqrt(np.mean((100 * a[ok] - 100 * b[ok]) ** 2)))
    return {"rho": rho, "rmse_puntos": rmse, "n": int(ok.sum())}
