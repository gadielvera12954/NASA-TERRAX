"""Parte 4 (Mathias): reproyección de un modelo de la Tierra (grilla geográfica) a UTM a 60 m.

Resultados conocidos: un campo constante sigue constante (el promedio no inventa valores), un
plano sigue siendo un plano con la misma pendiente, y la grilla de salida queda alineada a
múltiplos de 60 m (para que parcelas y región compartan píxeles).

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from __future__ import annotations

import math

import numpy as np
import pytest

rasterio = pytest.importorskip("rasterio")

from motor.escala import reproyectar  # noqa: E402
from motor.huella import pendiente  # noqa: E402

LAT0, LON0 = -36.0, -70.0                      # esquina NO de la tesela S37_W070 de Copernicus
PASO = 1.0 / 3600.0                            # 1 segundo de arco


def _geo(campo):
    from rasterio.transform import from_origin
    return from_origin(LON0, LAT0, PASO, PASO), campo.astype(np.float32)


def test_zona_utm():
    assert reproyectar.zona_utm(-69.25) == 19
    assert reproyectar.zona_utm(-61.6) == 20
    assert reproyectar.epsg_utm(-36.4, -69.25) == 32719


def test_constante_sigue_constante():
    t, z = _geo(np.full((1200, 1200), 1834.5))
    g = reproyectar.a_utm(z, t, "EPSG:4326", lat_centro=-36.17, lon_centro=-69.83, lado_m=12000.0)
    v = g["z"][np.isfinite(g["z"])]
    assert v.size > 0.9 * g["z"].size
    assert np.allclose(v, 1834.5, atol=1e-3)


def test_grilla_alineada_a_60_m():
    t, z = _geo(np.zeros((900, 900)))
    g = reproyectar.a_utm(z, t, "EPSG:4326", lat_centro=-36.12, lon_centro=-69.88, lado_m=9000.0)
    assert g["pixel_m"] == 60.0
    assert (g["x0_m"] - 30.0) % 60.0 == pytest.approx(0.0, abs=1e-6)
    assert (g["y0_m"] - 30.0) % 60.0 == pytest.approx(0.0, abs=1e-6)
    assert g["proyeccion"]["tipo"] == "utm" and g["proyeccion"]["zona"] == 19 and g["proyeccion"]["hemisferio"] == "S"


def test_plano_conserva_la_pendiente():
    # Plano que sube 0,1 m por cada metro hacia el este (5,71°), construido en metros reales.
    filas, cols = np.mgrid[0:1500, 0:1500]
    lat = LAT0 - (filas + 0.5) * PASO
    m_por_grado_lon = 111320.0 * np.cos(np.radians(lat))
    x_m = (cols + 0.5) * PASO * m_por_grado_lon
    t, z = _geo(500.0 + 0.1 * x_m)
    g = reproyectar.a_utm(z, t, "EPSG:4326", lat_centro=-36.2, lon_centro=-69.78, lado_m=15000.0)
    b = pendiente.horn(g["z"], 60.0)
    interior = b[5:-5, 5:-5]
    # La convergencia de meridianos rota el plano en UTM pero no cambia su pendiente.
    assert np.nanmedian(interior) == pytest.approx(math.degrees(math.atan(0.1)), abs=0.05)
