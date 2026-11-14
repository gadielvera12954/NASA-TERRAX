"""Proyecciones y lectura de grillas (esquemas/grilla_entrada.md)."""
import math

import numpy as np
import pytest

from motor.horizonte import geometria as g
from motor.horizonte.grilla import convergencia, escribir_grilla, fila_col_de_latlon, latlon, leer_grilla

R = 1737400.0


def test_polar_sur_ida_y_vuelta():
    for lat, lon in [(-84.60, 31.00), (-84.7906, 29.1957), (-86.22, 31.0), (-83.3, -120.0), (-89.9, 170.0)]:
        x, y = g.xy_desde_latlon_polar_sur(lat, lon, R, 0.0)
        la, lo = g.latlon_desde_xy_polar_sur(x, y, R, 0.0)
        assert math.isclose(float(la), lat, abs_tol=1e-9) and math.isclose(float(lo), lon, abs_tol=1e-9)


def test_mons_mouton_esta_a_164_km_del_polo():
    x, y = g.xy_desde_latlon_polar_sur(-84.60, 31.00, R, 0.0)
    assert math.isclose(math.hypot(float(x), float(y)) / 1000.0, 163.9, abs_tol=0.1)


def test_convergencia_polar_apunta_al_norte_geografico():
    lat, lon = -84.60, 31.00
    x1, y1 = g.xy_desde_latlon_polar_sur(lat, lon, R)
    x2, y2 = g.xy_desde_latlon_polar_sur(lat + 0.001, lon, R)       # un paso hacia el norte
    az_grilla_del_norte = math.degrees(math.atan2(float(x2 - x1), float(y2 - y1))) % 360
    assert math.isclose(az_grilla_del_norte, float(g.convergencia_polar_sur(lon)), abs_tol=1e-6)
    assert math.isclose(float(g.convergencia_polar_sur(lon)), 31.0)


def test_convergencia_utm_signo_en_el_hemisferio_sur():
    # Payunia (−36,42; −69,25), zona 19 (meridiano central −69°): al oeste del meridiano central,
    # el norte geográfico gira hacia el oeste de la grilla: convergencia negativa.
    c = g.convergencia_utm(-36.42, -69.25, 19)
    assert c < 0 and math.isclose(c, -0.148, abs_tol=0.002)
    assert g.convergencia_utm(-36.42, -68.75, 19) > 0


def test_base_enu_es_ortonormal():
    e, n, u = g.base_enu(-84.6, 31.0)
    m = np.stack([e, n, u])
    assert np.allclose(m @ m.T, np.eye(3), atol=1e-12)
    assert np.allclose(np.cross(e, n), u, atol=1e-12)


def test_escribir_y_leer_grilla(tmp_path):
    z = np.arange(12, dtype=np.float32).reshape(3, 4)
    x, y = g.xy_desde_latlon_polar_sur(-84.6, 31.0, R)
    meta = {"nombre": "prueba", "cuerpo": "luna", "pixel_m": 60.0, "x0_m": float(x), "y0_m": float(y),
            "proyeccion": {"tipo": "polar_estereografica_sur", "radio_m": R, "lon0_deg": 0.0},
            "fuentes": [{"id": "sintetico", "sha256": None}], "maqueta": True}
    escribir_grilla(tmp_path / "prueba", z, meta)
    capa, m = leer_grilla(tmp_path / "prueba.npy")
    assert np.array_equal(capa.z, z) and m["nombre"] == "prueba"
    la, lo = latlon(capa, m)
    assert math.isclose(float(la[0, 0]), -84.6, abs_tol=1e-9) and math.isclose(float(lo[0, 0]), 31.0, abs_tol=1e-9)
    conv = convergencia(capa, m)
    assert conv.shape == (3, 4) and math.isclose(float(conv[0, 0]), 31.0, abs_tol=1e-9)
    assert fila_col_de_latlon(capa, m, -84.6, 31.0) == (0, 0)


def test_grilla_invalida_se_rechaza(tmp_path):
    meta = {"nombre": "mala", "cuerpo": "marte", "pixel_m": 60.0, "x0_m": 0, "y0_m": 0,
            "proyeccion": {"tipo": "plano_local"}, "fuentes": [], "maqueta": True}
    with pytest.raises(ValueError):
        escribir_grilla(tmp_path / "mala", np.zeros((2, 2)), meta)
