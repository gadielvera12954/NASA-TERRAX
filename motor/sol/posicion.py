"""Posición del Sol vista desde la Luna (marco MOON_ME_DE421) y desde la Tierra (WGS84), con F15.

Convenciones: azimut desde el norte geográfico, en sentido horario (igual que JPL Horizons);
elevación en grados sobre el horizonte liso. Los tiempos entran como `datetime` con zona UTC.

Para muchos píxeles a la vez (mapa de refugios, F13) se calcula una sola vez la dirección del Sol
en el marco fijo a la Luna y se proyecta sobre la base local de cada píxel (`altaz_desde_vector`).
La diferencia con el cálculo topocéntrico completo es menor a 0,002° (paralaje y aberración
despreciables a 1 UA); la prueba test_vector_del_sol_en_marco_lunar_da_lo_mismo_que_skyfield lo
comprueba.

Uso de SI: redactado con Claude Code; probado contra JPL Horizons en test_sol.py.
"""
from __future__ import annotations

import datetime as dt
from typing import Sequence

import numpy as np
from skyfield.api import wgs84

from motor.horizonte.geometria import base_enu

from . import refraccion as refr
from .efemerides import cargar


def tiempos(t):
    """Lista de datetimes UTC (o un Time de Skyfield) → Time de Skyfield."""
    ef = cargar()
    if hasattr(t, "tt"):
        return t
    lista = list(t) if isinstance(t, (list, tuple, np.ndarray)) else [t]
    for x in lista:
        if x.tzinfo is None:
            raise ValueError("los tiempos deben tener zona horaria (UTC)")
    return ef.ts.from_datetimes(lista)


def rango_utc(desde: dt.datetime, hasta: dt.datetime, paso_s: float) -> list[dt.datetime]:
    n = int(np.floor((hasta - desde).total_seconds() / paso_s)) + 1
    return [desde + dt.timedelta(seconds=i * paso_s) for i in range(n)]


def sol_luna(lat_deg: float, lon_deg: float, t, alt_m: float = 0.0):
    """Azimut y elevación del Sol (aparente, sin atmósfera) desde un punto de la superficie lunar."""
    ef = cargar()
    lugar = ef.luna + ef.pc.build_latlon_degrees(ef.marco_luna, lat_deg, lon_deg, alt_m)
    ap = lugar.at(tiempos(t)).observe(ef.sol).apparent()
    alt, az, _ = ap.altaz()
    return np.atleast_1d(az.degrees).astype(float), np.atleast_1d(alt.degrees).astype(float)


def sol_tierra(lat_deg: float, lon_deg: float, alt_m: float, t, refraccion: bool = True,
               temperatura_c: float = refr.TEMPERATURA_REF, presion_mbar: float | None = None):
    """Azimut, elevación geométrica y elevación aparente (F15) del Sol desde la Tierra.

    Si `presion_mbar` es None se usa la atmósfera estándar a la altura del sitio.
    """
    ef = cargar()
    lugar = ef.tierra + wgs84.latlon(lat_deg, lon_deg, elevation_m=alt_m)
    ap = lugar.at(tiempos(t)).observe(ef.sol).apparent()
    alt, az, _ = ap.altaz()
    e_geo = np.atleast_1d(alt.degrees).astype(float)
    if refraccion:
        p = refr.presion_estandar_mbar(alt_m) if presion_mbar is None else presion_mbar
        e_ap = e_geo + refr.saemundsson_deg(e_geo, p, temperatura_c)
    else:
        e_ap = e_geo.copy()
    return np.atleast_1d(az.degrees).astype(float), e_geo, e_ap


def vector_sol_luna_me(t) -> np.ndarray:
    """Dirección unitaria del Sol (aparente, desde el centro de la Luna) en MOON_ME_DE421: (n, 3)."""
    ef = cargar()
    ap = ef.luna.at(tiempos(t)).observe(ef.sol).apparent()
    xyz = np.asarray(ap.frame_xyz(ef.marco_luna).au, dtype=float).reshape(3, -1).T
    return xyz / np.linalg.norm(xyz, axis=1, keepdims=True)


def altaz_desde_vector(s: np.ndarray, lat_deg, lon_deg):
    """Azimut y elevación locales a partir de direcciones del Sol en el marco del cuerpo.

    s: (n, 3). lat/lon escalares → (n,); arreglos de forma (m,) → (m, n).
    """
    este, norte, arriba = base_enu(lat_deg, lon_deg)
    se = este @ s.T
    sn = norte @ s.T
    su = arriba @ s.T
    el = np.degrees(np.arcsin(np.clip(su, -1.0, 1.0)))
    az = np.degrees(np.arctan2(se, sn)) % 360.0
    return az, el


def a_utc_naive(t: Sequence[dt.datetime]) -> list[str]:
    return [x.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") for x in t]
