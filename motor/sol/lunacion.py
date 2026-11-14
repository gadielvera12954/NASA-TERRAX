"""Series del Sol por lunación en Mons Mouton y noches completas sobre el horizonte liso.

Una noche polar dura casi la mitad de la lunación: en Mons Mouton el Sol pasa ~290 h seguidas bajo
el horizonte liso en verano y ~418 h en invierno. Si la ventana de la lunación se corta en el
mínimo del Sol (medianoche), cada ventana queda con dos medias noches y el tramo más largo dentro
de ella es la mitad de la noche real: así salía el "148 a 210 h" de los documentos. Por eso acá
las noches se miden enteras, aunque crucen el borde de la ventana (parametros: destino.noches_completas).

Uso de SI: redactado con Claude Code; probado en test_sol.py.
"""
from __future__ import annotations

import datetime as dt

import numpy as np

from .posicion import rango_utc, sol_luna


def serie_luna(lat_deg: float, lon_deg: float, desde: dt.datetime, hasta: dt.datetime, paso_h: float = 1.0,
               alt_m: float = 0.0) -> dict:
    t = rango_utc(desde, hasta, paso_h * 3600.0)
    az, el = sol_luna(lat_deg, lon_deg, t, alt_m)
    return {"t": t, "az": az, "el": el, "paso_h": paso_h}


def tramos(mascara: np.ndarray) -> list[tuple[int, int]]:
    """Tramos [i0, i1] (inclusive) donde la máscara es verdadera."""
    m = np.asarray(mascara, dtype=bool)
    if not m.any():
        return []
    d = np.diff(np.concatenate([[0], m.astype(np.int8), [0]]))
    ini = np.nonzero(d == 1)[0]
    fin = np.nonzero(d == -1)[0] - 1
    return list(zip(ini.tolist(), fin.tolist()))


def tramo_mas_largo(mascara: np.ndarray, paso_h: float) -> float:
    """Largo (h) del tramo continuo más largo, contando muestras × paso (como analizar_horizons.py)."""
    t = tramos(mascara)
    return max(((b - a + 1) * paso_h for a, b in t), default=0.0)


def noches(t: list[dt.datetime], el: np.ndarray, paso_h: float, umbral_deg=0.0) -> list[dict]:
    """Noches (Sol bajo el umbral) de una serie. `completa` = la noche no toca el borde de la serie."""
    salida = []
    n = len(t)
    for a, b in tramos(np.asarray(el) < umbral_deg):
        salida.append({
            "desde_utc": t[a].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "hasta_utc": t[b].strftime("%Y-%m-%dT%H:%M:%SZ"),
            "i0": a, "i1": b,
            "horas": (b - a + 1) * paso_h,
            "completa": a > 0 and b < n - 1,
        })
    return salida


def noches_que_tocan(lat_deg: float, lon_deg: float, desde: dt.datetime, hasta: dt.datetime, paso_h: float = 1.0,
                     margen_dias: float = 16.0) -> list[dict]:
    """Noches completas que se superponen con [desde, hasta], medidas con margen para no cortarlas."""
    m = dt.timedelta(days=margen_dias)
    ser = serie_luna(lat_deg, lon_deg, desde - m, hasta + m, paso_h)
    t = ser["t"]
    salida = []
    for n in noches(t, ser["el"], paso_h):
        if t[n["i1"]] >= desde and t[n["i0"]] <= hasta:
            salida.append(n)
    return salida


def resumen_serie(ser: dict) -> dict:
    el = np.asarray(ser["el"])
    i = int(np.argmax(el))
    return {
        "sol_max_deg": round(float(el.max()), 3),
        "sol_min_deg": round(float(el.min()), 3),
        "fecha_sol_max_utc": ser["t"][i].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fraccion_sobre_horizonte_liso": round(float((el > 0).mean()), 4),
    }
