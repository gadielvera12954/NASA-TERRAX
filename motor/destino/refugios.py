"""F20: mapa de refugios — horas seguidas sin Sol en cada píxel.

    T_osc(p) = max_{[t1,t2]} (t2 − t1)  tal que  e(t) < e_h,p(A(t))  ∀t ∈ [t1, t2]

Para cada píxel se calcula su propio Sol (en el recorte de Mons Mouton la altura del Sol cambia
±0,5° de un borde al otro y el norte gira ±5°) a partir de la dirección del Sol en el marco
MOON_ME y de la base local del píxel. Ese azimut geográfico se pasa al azimut de la grilla con la
convergencia del píxel y se busca el horizonte con la misma regla de horizontes.bin (azimut más
cercano). Las noches se miden enteras: se calcula con margen antes y después de la lunación y se
toma el tramo oscuro más largo que se superpone con ella. Refugio: T_osc ≤ 50 h.

Uso de SI: redactado con Claude Code; probado en test_destino.py.
"""
from __future__ import annotations

import datetime as dt
import math

import numba
import numpy as np

from motor.horizonte.geometria import base_enu
from motor.sol.posicion import rango_utc, vector_sol_luna_me

from .energia import RHO_SOL_DEG


@numba.njit(parallel=True, cache=True)
def _kernel(h, este, norte, arriba, conv, s, i0, i1, rho, horas, completa, ilum, visib):
    n_az, alto, ancho = h.shape
    T = s.shape[0]
    paso = 360.0 / n_az
    for p in numba.prange(alto * ancho):
        f = p // ancho
        c = p % ancho
        ex, ey, ez = este[f, c, 0], este[f, c, 1], este[f, c, 2]
        nx, ny, nz = norte[f, c, 0], norte[f, c, 1], norte[f, c, 2]
        ux, uy, uz = arriba[f, c, 0], arriba[f, c, 1], arriba[f, c, 2]
        mejor = 0
        mejor_completa = True
        ini = -1
        lit = 0
        vis = 0.0
        for t in range(T):
            sx, sy, sz = s[t, 0], s[t, 1], s[t, 2]
            su = ux * sx + uy * sy + uz * sz
            if su > 1.0:
                su = 1.0
            if su < -1.0:
                su = -1.0
            el = math.degrees(math.asin(su))
            az = math.degrees(math.atan2(ex * sx + ey * sy + ez * sz, nx * sx + ny * sy + nz * sz)) + conv[f, c]
            az = az % 360.0
            k = int(math.floor(az / paso + 0.5)) % n_az
            eh = h[k, f, c]
            oscuro = el < eh
            if t >= i0 and t < i1:
                if not oscuro:
                    lit += 1
                x = (el - eh) / rho
                if x >= 1.0:
                    vis += 1.0
                elif x > -1.0:
                    vis += 1.0 - (math.acos(x) - x * math.sqrt(1.0 - x * x)) / math.pi
            if oscuro:
                if ini < 0:
                    ini = t
            if (not oscuro or t == T - 1) and ini >= 0:
                fin = t - 1 if not oscuro else t
                if ini <= i1 - 1 and fin >= i0:
                    largo = fin - ini + 1
                    if largo > mejor:
                        mejor = largo
                        mejor_completa = ini > 0 and fin < T - 1
                ini = -1
        horas[f, c] = mejor
        completa[f, c] = mejor_completa
        ilum[f, c] = lit / (i1 - i0)
        visib[f, c] = vis / (i1 - i0)


def serie_vectores(desde: dt.datetime, hasta: dt.datetime, margen_dias: float, paso_h: float):
    m = dt.timedelta(days=margen_dias)
    t = rango_utc(desde - m, hasta + m, paso_h * 3600.0)
    i0 = int(round((desde - t[0]).total_seconds() / (paso_h * 3600.0)))
    i1 = int(round((hasta - t[0]).total_seconds() / (paso_h * 3600.0)))
    return t, vector_sol_luna_me(t), i0, i1


def mapa_refugios(h_deg: np.ndarray, lat, lon, conv, desde: dt.datetime, hasta: dt.datetime, margen_dias: float = 16.0,
                  paso_h: float = 1.0, limite_h: float = 50.0, rho_deg: float = RHO_SOL_DEG, vectores=None) -> dict:
    """Devuelve horas (T_osc), refugio (≤ límite), iluminación (fracción con el centro del Sol visible)
    y visibilidad media del disco (F3) de cada píxel, en la ventana [desde, hasta)."""
    h = np.ascontiguousarray(h_deg, dtype=np.float64)
    este, norte, arriba = (np.ascontiguousarray(v) for v in base_enu(lat, lon))
    if este.ndim == 1:
        este, norte, arriba = este[None, None], norte[None, None], arriba[None, None]
    conv = np.ascontiguousarray(np.broadcast_to(np.asarray(conv, dtype=np.float64), h.shape[1:]))
    t, s, i0, i1 = vectores if vectores is not None else serie_vectores(desde, hasta, margen_dias, paso_h)
    alto, ancho = h.shape[1:]
    horas = np.zeros((alto, ancho), dtype=np.int64)
    completa = np.zeros((alto, ancho), dtype=np.bool_)
    ilum = np.zeros((alto, ancho), dtype=np.float64)
    visib = np.zeros((alto, ancho), dtype=np.float64)
    _kernel(h, este, norte, arriba, conv, np.ascontiguousarray(s), i0, i1, rho_deg, horas, completa, ilum, visib)
    horas_h = horas.astype(np.float64) * paso_h
    return {"horas": horas_h, "refugio": horas_h <= limite_h, "completa": completa, "iluminacion": ilum,
            "visibilidad": visib, "t": t, "i0": i0, "i1": i1}


def a_png16(horas: np.ndarray, sin_dato=None) -> np.ndarray:
    a = np.clip(np.rint(horas), 0, 65534).astype(np.uint16)
    if sin_dato is not None:
        a[sin_dato] = 65535
    return a
