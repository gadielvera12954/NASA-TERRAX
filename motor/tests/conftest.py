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


def pytest_configure(config):
    config.addinivalue_line("markers", "lento: prueba que tarda más de unos segundos")
    config.addinivalue_line("markers", "red: necesita internet (JPL Horizons o NAIF)")
