"""F10 (distancia de Wasserstein) y F18 (de distancia a utilidad).

    W1(P, Q) = ∫₀¹ |F_P⁻¹(q) − F_Q⁻¹(q)| dq = ∫ |F_P(x) − F_Q(x)| dx
    u = exp(−W1 / τ)

Si las dos distribuciones vienen como valores sueltos, W1 se calcula exacto (SciPy). Si alguna
viene como 101 cuantiles, se integra la primera forma con la regla del trapecio.

La respuesta a la luz rasante f̄(e) es la fracción de (píxel, azimut) con horizonte más alto que e,
es decir 1 − F(e) de la distribución de alturas de horizonte. Por eso la media de |f̄P − f̄Q| sobre
la grilla de e de 1,5° a 10° es la W1 de F10 restringida a ese rango y normalizada por su ancho.

Uso de SI: redactado con Claude Code; probado contra SciPy en test_puntaje.py.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.stats import wasserstein_distance

Q = np.linspace(0.0, 1.0, 101)


def cuantiles(dist: dict) -> np.ndarray:
    if dist is None:
        raise ValueError("distribución faltante")
    if "cuantiles" in dist:
        q = np.asarray(dist["cuantiles"], dtype=float)
        if q.size != Q.size:
            raise ValueError("se esperan 101 cuantiles")
        return q
    return np.quantile(np.asarray(dist["valores"], dtype=float), Q)


def w1(p: dict, q: dict) -> float:
    if "valores" in p and "valores" in q:
        return float(wasserstein_distance(np.asarray(p["valores"], dtype=float), np.asarray(q["valores"], dtype=float)))
    return float(np.trapezoid(np.abs(cuantiles(p) - cuantiles(q)), Q))


def mediana(dist: dict) -> float:
    return float(np.median(dist["valores"])) if "valores" in dist else float(cuantiles(dist)[50])


def distancia_luz(fp: dict, fq: dict) -> float:
    ep, eq = np.asarray(fp["e_deg"], dtype=float), np.asarray(fq["e_deg"], dtype=float)
    if ep.shape != eq.shape or not np.allclose(ep, eq, atol=1e-9):
        raise ValueError("las curvas f̄(e) deben usar la misma grilla de alturas de Sol")
    return float(np.mean(np.abs(np.asarray(fp["f_media"], dtype=float) - np.asarray(fq["f_media"], dtype=float))))


def utilidad(distancia: float, tolerancia: float) -> float:
    """F18: u = exp(−W1/τ)."""
    return float(math.exp(-distancia / tolerancia))
