"""Puerta Horizonte, prueba 1: poste vertical sobre un plano (F1). Meta: error de 1 píxel o menos.

Cómo se mide el error (definido antes de correr la versión final del núcleo):
    sobre la línea de celdas que quedan detrás del poste (opuesta al Sol), cada celda debería
    estar en sombra si su distancia al poste es menor que s = h / tan(e). El error es la distancia
    al borde teórico de la peor celda mal clasificada (0 si ninguna lo está). Así no se cuenta como
    error la separación entre celdas, que en diagonal es de 1,41 píxeles.

Por qué en los 8 azimutes principales (0°, 45°, …, 315°): el núcleo evalúa el perfil sobre el
rayo con la superficie lineal entre centros de celda (como HORAYZON). Un poste de una sola celda
se vuelve así una "carpa": en esos 8 azimutes el rayo pasa justo por el centro del poste y F1 es
exacta; en azimutes oblicuos el rayo pasa al costado del vértice y la sombra sale más corta, que
es la sombra correcta de esa superficie. Para los oblicuos se comprueba la dirección y que nunca
supere a F1.
"""
import math

import numpy as np
import pytest

from motor.horizonte import Capa, calcular_horizontes, sombra_mapa
from motor.tests import sinteticos as sint


@pytest.fixture(scope="module")
def poste():
    t = sint.plano_con_poste(n=201, pixel_m=1.0, alto_poste_m=5.0)
    capa = Capa(t["z"], t["pixel_m"], t["x0"], t["y0"])
    h = calcular_horizontes([capa], n_az=72, altura_obs_m=0.0, radio_m=None)
    return t, h


def _celdas_relativas(t, sombra):
    fp, cp = t["poste"]
    filas, cols = np.mgrid[0:sombra.shape[0], 0:sombra.shape[1]]
    dx = (cols - cp) * t["pixel_m"]
    dy = (fp - filas) * t["pixel_m"]
    return dx, dy


def error_poste(t, h, az_deg, e_deg):
    fp, cp = t["poste"]
    sombra = sombra_mapa(h, az_deg, e_deg)
    sombra[fp, cp] = False
    dx, dy = _celdas_relativas(t, sombra)
    ux, uy = -math.sin(math.radians(az_deg)), -math.cos(math.radians(az_deg))   # hacia donde cae la sombra
    a_lo_largo = dx * ux + dy * uy
    lateral = np.abs(dx * uy - dy * ux)
    dist = np.hypot(dx, dy)
    s_teo = sint.largo_sombra_teorico(t["alto_m"], e_deg)
    linea = (a_lo_largo > 0) & (lateral < 1e-6)
    esperado = dist < s_teo
    mal = linea & (sombra != esperado)
    err = float(np.max(np.abs(dist[mal] - s_teo))) if mal.any() else 0.0
    s_calc = float(dist[linea & sombra].max()) if (linea & sombra).any() else 0.0
    return err, s_calc, s_teo, sombra, dist, a_lo_largo, lateral


@pytest.mark.parametrize("e_deg", [5.0, 7.0, 10.0, 15.0])
@pytest.mark.parametrize("az_deg", [0.0, 45.0, 90.0, 135.0, 180.0, 225.0, 270.0, 315.0])
def test_poste_f1_en_los_8_azimutes_principales(poste, e_deg, az_deg):
    t, h = poste
    err, s_calc, s_teo, sombra, dist, a, lat = error_poste(t, h, az_deg, e_deg)
    assert err <= 1.0 * t["pixel_m"], f"peor celda mal clasificada a {err:.2f} px del borde teórico"
    paso = math.sqrt(2.0) if az_deg % 90 else 1.0
    assert s_teo - paso * t["pixel_m"] <= s_calc <= s_teo, f"última celda en sombra {s_calc:.2f} m, F1 {s_teo:.2f} m"
    # Fuera de la línea no hay sombra a más de una celda de costado.
    assert not (sombra & (lat > 1.5)).any()


@pytest.mark.parametrize("e_deg", [5.0, 10.0])
@pytest.mark.parametrize("az_deg", [30.0, 200.0, 290.0])
def test_poste_azimut_oblicuo_direccion_y_cota(poste, e_deg, az_deg):
    t, h = poste
    _, _, s_teo, sombra, dist, a, lat = error_poste(t, h, az_deg, e_deg)
    assert sombra.any()
    assert dist[sombra].max() <= s_teo + 1.0                 # nunca más larga que F1
    assert (a[sombra] > 0).all()                             # siempre del lado opuesto al Sol
    assert lat[sombra].max() <= 1.0                          # a menos de una celda de la línea


def test_plano_sin_poste_no_tiene_sombra():
    z = np.zeros((41, 41), dtype=np.float32)
    h = calcular_horizontes([Capa(z, 1.0)], n_az=72, altura_obs_m=0.0, radio_m=None)
    for az in range(0, 360, 15):
        assert not sombra_mapa(h, float(az), 0.5).any()


def test_plano_inclinado_da_su_pendiente():
    # Plano que sube hacia el norte con pendiente 10°: mirando al norte, el horizonte es 10°.
    n = 81
    filas = np.arange(n)[:, None] * np.ones((1, n))
    z = ((n - 1 - filas) * math.tan(math.radians(10.0))).astype(np.float32)
    h = calcular_horizontes([Capa(z, 1.0)], n_az=72, altura_obs_m=0.0, radio_m=None)
    centro = h[:, 40, 40]
    assert abs(centro[0] - 10.0) < 1e-3                     # norte
    assert abs(centro[18] - math.degrees(math.atan(0.0))) < 1e-3  # este: plano horizontal en esa dirección
    assert abs(centro[9] - math.degrees(math.atan(math.tan(math.radians(10)) * math.cos(math.radians(45))))) < 1e-3


def test_f1_numeros_del_documento():
    from motor.horizonte.geometria import largo_sombra
    assert math.isclose(largo_sombra(1000.0, 1.5) / 1000.0, 38.19, abs_tol=0.01)   # doc02: 38,2 km
    assert math.isclose(largo_sombra(0.5, 5.0), 5.715, abs_tol=0.001)             # tablita de 50 cm
    assert math.isclose(largo_sombra(300.0, 1.5) / 1000.0, 11.46, abs_tol=0.01)    # doc02: 11,5 km
