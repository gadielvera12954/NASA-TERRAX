"""Lectura de las grillas que entrega motor/escala (contrato: esquemas/grilla_entrada.md).

Cada grilla son `<nombre>.npy` (float32, alto × ancho, metros) y `<nombre>.json` (metadatos).
Además de la Capa para el horizonte, da la latitud, la longitud y la convergencia de cada píxel,
que motor/destino necesita para poner el Sol de cada píxel en el azimut de la grilla.

Uso de SI: redactado con Claude Code; probado en motor/tests/test_grilla.py.
"""
from __future__ import annotations

import json
import pathlib

import numpy as np

from esquemas.validar import validar

from . import geometria
from .nucleo import Capa


def ruta_base(ruta) -> pathlib.Path:
    p = pathlib.Path(ruta)
    return p.with_suffix("") if p.suffix in (".npy", ".json") else p


def leer_grilla(ruta) -> tuple[Capa, dict]:
    base = ruta_base(ruta)
    meta = json.loads(base.with_suffix(".json").read_text(encoding="utf-8"))
    validar(meta, "grilla")
    z = np.load(base.with_suffix(".npy"), allow_pickle=False)
    if z.ndim != 2:
        raise ValueError(f"{base}.npy debe ser una matriz 2D")
    capa = Capa(z.astype(np.float32), meta["pixel_m"], meta["x0_m"], meta["y0_m"], nombre=meta["nombre"])
    return capa, meta


def escribir_grilla(ruta, z: np.ndarray, meta: dict) -> None:
    """Escribe una grilla con el mismo contrato (lo usan las pruebas y la maqueta)."""
    validar(meta, "grilla")
    base = ruta_base(ruta)
    base.parent.mkdir(parents=True, exist_ok=True)
    np.save(base.with_suffix(".npy"), np.asarray(z, dtype=np.float32), allow_pickle=False)
    base.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def latlon(capa: Capa, meta: dict, filas=None, cols=None):
    """Latitud y longitud (grados) de los centros de los píxeles pedidos (o de todos)."""
    if filas is None:
        filas, cols = np.mgrid[0:capa.alto, 0:capa.ancho]
    x, y = capa.xy(filas, cols)
    proy = meta["proyeccion"]
    if proy["tipo"] == "polar_estereografica_sur":
        return geometria.latlon_desde_xy_polar_sur(x, y, proy["radio_m"], proy["lon0_deg"])
    if proy["tipo"] in ("utm", "plano_local") and "lat_centro_deg" in proy:
        # Para Sol y horario alcanza el centro: una parcela de 3 km cambia la altura del Sol en 0,03°.
        lat = np.full(np.shape(x), float(proy["lat_centro_deg"]))
        lon = np.full(np.shape(x), float(proy["lon_centro_deg"]))
        return lat, lon
    raise ValueError(f"la proyección {proy['tipo']} no tiene latitud y longitud")


def convergencia(capa: Capa, meta: dict, filas=None, cols=None):
    """Grados a sumar a un azimut geográfico para obtener el azimut de la grilla, por píxel."""
    proy = meta["proyeccion"]
    if filas is None:
        filas, cols = np.mgrid[0:capa.alto, 0:capa.ancho]
    if proy["tipo"] == "polar_estereografica_sur":
        _, lon = latlon(capa, meta, filas, cols)
        return geometria.convergencia_polar_sur(lon, proy["lon0_deg"])
    if proy["tipo"] == "utm":
        g = geometria.convergencia_utm(proy["lat_centro_deg"], proy["lon_centro_deg"], proy["zona"])
        return np.full(np.shape(filas), g)
    return np.zeros(np.shape(filas))


def centro(capa: Capa) -> tuple[int, int]:
    return (capa.alto - 1) // 2, (capa.ancho - 1) // 2


def fila_col_de_latlon(capa: Capa, meta: dict, lat_deg: float, lon_deg: float) -> tuple[int, int]:
    """Píxel más cercano a una latitud y longitud (solo proyección polar estereográfica sur)."""
    proy = meta["proyeccion"]
    if proy["tipo"] != "polar_estereografica_sur":
        return centro(capa)
    x, y = geometria.xy_desde_latlon_polar_sur(lat_deg, lon_deg, proy["radio_m"], proy["lon0_deg"])
    col = int(round((float(x) - capa.x0) / capa.pixel_m))
    fila = int(round((capa.y0 - float(y)) / capa.pixel_m))
    if not (0 <= fila < capa.alto and 0 <= col < capa.ancho):
        raise ValueError("el punto pedido queda fuera de la grilla")
    return fila, col
