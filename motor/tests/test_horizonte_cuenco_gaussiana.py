"""Validación del horizonte: cuenco sintético y superficie gaussiana contra Smith (F17)."""
import math

import numpy as np
import pytest

from motor.horizonte import Capa, calcular_horizontes, calcular_horizontes_puntos, sombra_mapa
from motor.tests import sinteticos as sint


@pytest.mark.parametrize("e_deg", [5.0, 10.0, 20.0])
def test_cuenco_sombra_interna_dentro_de_un_pixel(e_deg):
    t = sint.cuenco(n=121, pixel_m=1.0, radio_borde_m=40.0, profundidad_m=10.0)
    h = calcular_horizontes([Capa(t["z"], 1.0, t["x0"], t["y0"])], n_az=72, altura_obs_m=0.0, radio_m=None)
    fc, cc = t["centro"]
    # Sol desde el este (90°): la sombra empieza en el borde este y avanza hacia el oeste.
    fila = sombra_mapa(h, 90.0, e_deg)[fc]
    xs = (np.arange(fila.size) - cc) * t["pixel_m"]
    dentro = np.abs(xs) < t["radio_borde_m"]
    sombreadas = xs[dentro & fila]
    teo = sint.sombra_cuenco_teorica_m(t["radio_borde_m"], t["profundidad_m"], e_deg)
    calc = (t["radio_borde_m"] - sombreadas.min()) if sombreadas.size else 0.0
    assert abs(calc - teo) <= 1.0 * t["pixel_m"], f"sombra interna {calc:.2f} m vs {teo:.2f} m"


def test_cuenco_sin_sombra_con_sol_mas_alto_que_la_pared():
    t = sint.cuenco(n=121, pixel_m=1.0, radio_borde_m=40.0, profundidad_m=10.0)
    assert sint.sombra_cuenco_teorica_m(40.0, 10.0, 30.0) == 0.0
    h = calcular_horizontes([Capa(t["z"], 1.0, t["x0"], t["y0"])], n_az=72, altura_obs_m=0.0, radio_m=None)
    assert not sombra_mapa(h, 90.0, 30.0).any()


def test_smith_numeros_del_documento():
    # doc02, figura 3: con el Sol a 6°, RMS 5° → 15 %; RMS 20° → 68 %; RMS 10° → 44 %.
    assert round(100 * sint.smith_fraccion_sombra(6.0, math.tan(math.radians(5)))) == 15
    assert round(100 * sint.smith_fraccion_sombra(6.0, math.tan(math.radians(10)))) == 44
    assert round(100 * sint.smith_fraccion_sombra(6.0, math.tan(math.radians(20)))) == 68


def fraccion_en_sombra_gaussiana(pendiente_rms_deg, alturas_sol, n_puntos=3000, semilla=7):
    t = sint.gaussiana(n=512, pixel_m=1.0, pendiente_rms_deg=pendiente_rms_deg, largo_correlacion_px=10.0)
    rng = np.random.default_rng(semilla)
    pts = [tuple(p) for p in rng.integers(0, 512, size=(n_puntos, 2))]
    hp = calcular_horizontes_puntos([Capa(t["z"], 1.0)], pts, n_az=72, altura_obs_m=0.0, radio_m=None,
                                    periodico=True, d_max_m=256.0)
    f_sim = np.array([(e < hp).mean() for e in alturas_sol])
    f_teo = np.array([sint.smith_fraccion_sombra(e, t["w"]) for e in alturas_sol])
    return f_sim, f_teo


@pytest.mark.lento
@pytest.mark.parametrize("rms", [5.0, 10.0, 20.0])
def test_gaussiana_contra_smith_dentro_de_3_puntos(rms):
    alturas = np.arange(2.0, 15.01, 1.0)
    f_sim, f_teo = fraccion_en_sombra_gaussiana(rms, alturas)
    peor = float(np.max(np.abs(f_sim - f_teo)) * 100)
    assert peor <= 3.0, f"RMS {rms}°: diferencia máxima {peor:.2f} puntos"
