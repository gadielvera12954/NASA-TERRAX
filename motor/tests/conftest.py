"""Configuración de pytest para el motor físico (Parte 3).

Regla de trabajo de Jean: primero se escribe la prueba con resultado conocido, después el código.
Las pruebas lentas (superficie gaussiana completa, control de dos años contra Horizons) llevan la
marca `lento` y se pueden saltear con `-m "not lento"`.
"""
from __future__ import annotations

import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))


def _datos_proj_de_rasterio() -> None:
    """Las pruebas de motor/escala usan la base PROJ/GDAL que trae la rueda de rasterio.

    Otras instalaciones (PostGIS, QGIS) dejan PROJ_LIB y GDAL_DATA apuntando a una proj.db de otra
    versión y rasterio falla con "proj.db ... comes from another PROJ installation".
    """
    import importlib.util
    import os

    spec = importlib.util.find_spec("rasterio")
    if spec is None or not spec.origin:
        return
    base = pathlib.Path(spec.origin).parent
    if (base / "proj_data").is_dir():
        os.environ["PROJ_DATA"] = os.environ["PROJ_LIB"] = str(base / "proj_data")
    if (base / "gdal_data").is_dir():
        os.environ["GDAL_DATA"] = str(base / "gdal_data")


_datos_proj_de_rasterio()


def pytest_configure(config):
    config.addinivalue_line("markers", "lento: prueba que tarda más de unos segundos")
    config.addinivalue_line("markers", "red: necesita internet (JPL Horizons o NAIF)")
