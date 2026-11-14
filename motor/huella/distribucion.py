"""Distribuciones con la forma de esquemas/distribuciones.schema.json: 101 cuantiles (q = 0, 0,01, …, 1).

`None` significa "sin datos utilizables": motor/puntaje lo trata como propiedad faltante y baja la
evidencia E en lugar de inventar un valor.

Uso de SI: redactado con Claude Code para la Parte 4; lo prueba motor/tests/test_parte4_huella.py.
"""
from __future__ import annotations

import numpy as np

Q = np.linspace(0.0, 1.0, 101)


def cuantiles(valores, decimales: int = 4) -> dict | None:
    v = np.asarray(valores, dtype=np.float64).ravel()
    v = v[np.isfinite(v)]
    if v.size == 0:
        return None
    return {"cuantiles": [round(float(x), decimales) for x in np.quantile(v, Q)], "n": int(v.size)}
