"""Control del Sol contra JPL Horizons (meta del documento 02: menos de 0,1°).

Compara Skyfield + DE421 con cada archivo de Horizons de una carpeta de referencia, punto por punto,
y devuelve el peor caso en elevación y en azimut (el azimut se pondera por cos(e), que es la
distancia angular real en el cielo).

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import pathlib

import numpy as np

from . import horizons, posicion


def comparar_archivo(ruta: pathlib.Path, lat: float, lon: float, alt_m: float, cada: int = 1) -> dict:
    ref = horizons.leer_csv(ruta)
    filas = ref.filas[::cada]
    t = [f[0] for f in filas]
    az_h = np.array([f[1] for f in filas])
    el_h = np.array([f[2] for f in filas])
    luna = "coord@301" in ref.meta
    refractado = "refraccion=True" in ref.meta
    if luna:
        az, el = posicion.sol_luna(lat, lon, t, alt_m)
        mascara = np.ones_like(el_h, dtype=bool)
    else:
        az, e_geo, e_ap = posicion.sol_tierra(lat, lon, alt_m, t, refraccion=refractado, presion_mbar=1010.0)
        el = e_ap if refractado else e_geo
        # Bajo el horizonte la refracción de Horizons usa otro modelo: se compara con el Sol visible.
        mascara = el_h > 0.5 if refractado else np.ones_like(el_h, dtype=bool)
    d_el = np.abs(el - el_h)[mascara]
    d_az = (np.abs((az - az_h + 180) % 360 - 180) * np.cos(np.radians(el_h)))[mascara]
    return {
        "archivo": ruta.name,
        "consulta": ref.meta,
        "cuerpo": "luna" if luna else "tierra",
        "refraccion": refractado,
        "n": int(mascara.sum()),
        "max_dif_elevacion_deg": float(d_el.max()),
        "max_dif_azimut_deg": float(d_az.max()),
        "media_dif_elevacion_deg": float(d_el.mean()),
    }


def controlar(carpeta: pathlib.Path, meta_deg: float = 0.1, cada: int = 1) -> dict:
    resultados = []
    for nombre, _c, _s, _a, _b, _p, _r, (lat, lon, alt) in horizons.TRABAJOS:
        ruta = carpeta / f"{nombre}.csv"
        if ruta.exists():
            resultados.append(comparar_archivo(ruta, lat, lon, alt, cada))
    if not resultados:
        raise FileNotFoundError(f"no hay archivos de Horizons en {carpeta}")
    peor_luna = max((r["max_dif_elevacion_deg"] for r in resultados if r["cuerpo"] == "luna"), default=None)
    peor = max(max(r["max_dif_elevacion_deg"], r["max_dif_azimut_deg"]) for r in resultados)
    return {
        "carpeta": carpeta.name,
        "meta_deg": meta_deg,
        "peor_dif_deg": peor,
        "peor_dif_luna_deg": peor_luna,
        "pasa": peor < meta_deg,
        "archivos": resultados,
    }
