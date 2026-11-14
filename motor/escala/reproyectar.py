"""Reproyección de un modelo de la Tierra en grilla geográfica a UTM a 60 m (promedio, sin interpolar).

Copernicus GLO-30 y NASADEM vienen en grilla de 1 segundo de arco: a 36°S eso es ~31 m norte-sur y
~25 m este-oeste. Para comparar con la Luna se lleva a una grilla métrica de 60 m con remuestreo por
PROMEDIO (cada celda de 60 m promedia las 4 a 6 celdas de origen que caen dentro): nunca se crea
una malla más fina. La grilla de salida se alinea a múltiplos de 60 m para que las parcelas y su
región compartan exactamente los mismos píxeles.

Uso de SI: redactado con Claude Code para la Parte 4; lo prueba motor/tests/test_parte4_escala.py.
"""
from __future__ import annotations

import math

import numpy as np

PIXEL_M = 60.0


def zona_utm(lon_deg: float) -> int:
    return int(math.floor((lon_deg + 180.0) / 6.0)) + 1


def epsg_utm(lat_deg: float, lon_deg: float) -> int:
    return (32700 if lat_deg < 0 else 32600) + zona_utm(lon_deg)


def a_utm(z: np.ndarray, transform, crs_origen, lat_centro: float, lon_centro: float, lado_m: float,
          alto_m: float | None = None, pixel_m: float = PIXEL_M, nodata_origen=None, otras=()) -> dict:
    """Reproyecta `z` (con su transformación afín y CRS) a una grilla UTM centrada en (lat, lon).

    `otras`: más teselas (z, transform) en el mismo CRS; llenan lo que la primera no cubre (mosaico).
    Devuelve un dict con `z` (float32, NaN = sin dato), `pixel_m`, `x0_m`, `y0_m` (centro de la celda
    [0, 0]), `proyeccion` (contrato de esquemas/grilla.schema.json) y `epsg`.
    """
    import rasterio
    from pyproj import Transformer
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject

    alto_m = lado_m if alto_m is None else alto_m
    epsg = epsg_utm(lat_centro, lon_centro)
    xc, yc = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True).transform(lon_centro, lat_centro)
    ancho = int(round(lado_m / pixel_m))
    alto = int(round(alto_m / pixel_m))
    # Esquina superior izquierda alineada a múltiplos de 60 m: los centros quedan en 30 + 60·n.
    x_izq = math.floor((xc - ancho * pixel_m / 2.0) / pixel_m) * pixel_m
    y_sup = math.floor((yc + alto * pixel_m / 2.0) / pixel_m) * pixel_m
    destino = np.full((alto, ancho), np.nan, dtype=np.float32)
    origen = np.asarray(z, dtype=np.float32)
    if nodata_origen is not None:
        origen = np.where(origen == nodata_origen, np.nan, origen).astype(np.float32)
    t_dst = from_origin(x_izq, y_sup, pixel_m, pixel_m)
    for k, (zo, to) in enumerate([(origen, transform), *otras]):
        parcial = np.full_like(destino, np.nan)
        reproject(
            source=np.asarray(zo, dtype=np.float32), destination=parcial,
            src_transform=to, src_crs=crs_origen, src_nodata=np.nan,
            dst_transform=t_dst, dst_crs=f"EPSG:{epsg}", dst_nodata=np.nan,
            resampling=Resampling.average,
        )
        hueco = np.isnan(destino) & np.isfinite(parcial)
        destino[hueco] = parcial[hueco]
    del rasterio
    return {
        "z": destino,
        "pixel_m": float(pixel_m),
        "x0_m": float(x_izq + pixel_m / 2.0),
        "y0_m": float(y_sup - pixel_m / 2.0),
        "epsg": epsg,
        "proyeccion": {"tipo": "utm", "zona": zona_utm(lon_centro), "hemisferio": "S" if lat_centro < 0 else "N",
                       "lat_centro_deg": float(lat_centro), "lon_centro_deg": float(lon_centro)},
    }
