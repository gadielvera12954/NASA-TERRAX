"""Puerta Horizonte, prueba 2: esfera perfecta (F2). Meta: 0 píxeles en sombra por relieve."""
import math

import numpy as np
import pytest

from motor.horizonte import Capa, calcular_horizontes, calcular_horizontes_puntos, sombra_mapa
from motor.horizonte.geometria import caida_curvatura
from motor.tests import sinteticos as sint

R_LUNA = 1737400.0


@pytest.fixture(scope="module")
def esfera():
    obj = sint.esfera(n=101, pixel_m=60.0, x0=-3000.0, y0=3000.0)
    lejos = sint.capa_lejana_esfera(radio_km=300.0, pixel_m=600.0)
    capas = [Capa(obj["z"], obj["pixel_m"], obj["x0"], obj["y0"]), Capa(lejos["z"], lejos["pixel_m"], lejos["x0"], lejos["y0"])]
    h = calcular_horizontes(capas, n_az=72, altura_obs_m=1.0, radio_m=R_LUNA, k=0.0)
    return capas, h


@pytest.mark.parametrize("e_deg", [0.1, 1.5, 3.0, 7.0])
def test_esfera_sin_sombras_con_sol_sobre_el_horizonte(esfera, e_deg):
    _, h = esfera
    total = sum(int(sombra_mapa(h, float(az), e_deg).sum()) for az in range(0, 360, 5))
    assert total == 0


def test_esfera_todo_en_sombra_con_sol_bajo_el_horizonte(esfera):
    _, h = esfera
    for az in range(0, 360, 30):
        assert sombra_mapa(h, float(az), -0.5).all()


def test_horizonte_de_la_esfera_es_la_depresion_geometrica(esfera):
    # Observador a 1 m sobre la esfera: horizonte = −sqrt(2h/R) = −0,0615°
    _, h = esfera
    esperado = sint.depresion_horizonte_teorica_deg(1.0, R_LUNA)
    assert np.all(np.abs(h - esperado) < 0.01)


def test_torre_de_5_km_ve_el_horizonte_4_3_grados_mas_abajo():
    # doc02 §5.1: "con h = 5 km, unos 4,3° más bajo (esfera de 1.737,4 km)".
    obj = sint.esfera(n=101, pixel_m=60.0, x0=-3000.0, y0=3000.0)
    obj["z"][50, 50] = 5000.0
    lejos = sint.capa_lejana_esfera(radio_km=300.0, pixel_m=600.0)
    capas = [Capa(obj["z"], 60.0, obj["x0"], obj["y0"]), Capa(lejos["z"], 600.0, lejos["x0"], lejos["y0"])]
    hp = calcular_horizontes_puntos(capas, [(50, 50)], n_az=360, altura_obs_m=0.0, radio_m=R_LUNA)
    esperado = sint.depresion_horizonte_teorica_deg(5000.0, R_LUNA)
    # atan(sqrt(2h/R)) = atan(0,07587) = 4,3385°. La depresión esférica exacta, arccos(R/(R+h)),
    # da 4,3415°: la diferencia de 0,003° es la aproximación parabólica de F2.
    assert math.isclose(esperado, -4.3385, abs_tol=0.0005)
    assert math.isclose(math.degrees(math.acos(R_LUNA / (R_LUNA + 5000.0))), 4.3415, abs_tol=0.0005)
    assert np.all(np.abs(hp - esperado) < 0.01)


def test_sin_curvatura_la_torre_no_baja_el_horizonte_lo_suficiente():
    # Control de la prueba: si se olvidara la curvatura, el horizonte quedaría mucho más alto.
    obj = sint.esfera(n=101, pixel_m=60.0, x0=-3000.0, y0=3000.0)
    obj["z"][50, 50] = 5000.0
    lejos = sint.capa_lejana_esfera(radio_km=300.0, pixel_m=600.0)
    capas = [Capa(obj["z"], 60.0, obj["x0"], obj["y0"]), Capa(lejos["z"], 600.0, lejos["x0"], lejos["y0"])]
    hp = calcular_horizontes_puntos(capas, [(50, 50)], n_az=36, altura_obs_m=0.0, radio_m=None)
    assert np.all(hp > -1.5)


def test_caida_por_curvatura_documento():
    assert math.isclose(caida_curvatura(50000.0, R_LUNA, 0.0), 719.5, abs_tol=0.1)   # doc02: 720 m
    assert math.isclose(caida_curvatura(50000.0, 6371000.0, 0.13), 0.87 * 50000.0 ** 2 / (2 * 6371000.0))
