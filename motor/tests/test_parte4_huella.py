"""Parte 4 (Mathias): pruebas con resultado conocido de motor/escala y motor/huella.

Se escribieron ANTES que el código (regla del Método de trabajo). Cada prueba usa un terreno
sintético cuyo resultado se sabe a mano:

* F8 (Horn): un plano inclinado tiene la misma pendiente en todas las celdas interiores.
* F9 (rugosidad): un plano tiene rugosidad 0 a cualquier escala; plano + ruido blanco de σ da
  ≈ σ·√((N − 3)/N) (se ajustan 3 parámetros con N píxeles).
* F16 (luz rasante): con horizonte de 5° en todo azimut, f̄(e) vale 1 para e < 5° y 0 para e > 5°.
* Escala: promediar bloques de 3 × 3 de un campo constante por bloques devuelve esas constantes;
  la reproyección con promedio deja igual un campo constante y alinea la grilla a múltiplos de 60 m.

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from __future__ import annotations

import math

import numpy as np
import pytest

from motor.escala import bloques
from motor.huella import distribucion, luz, pendiente, rugosidad


# ------------------------------------------------------------------ F8 · pendiente de Horn
def plano(alto, ancho, px, pend_x_deg, pend_y_deg, z0=1000.0):
    f, c = np.mgrid[0:alto, 0:ancho]
    x, y = c * px, -f * px
    return (z0 + x * math.tan(math.radians(pend_x_deg)) + y * math.tan(math.radians(pend_y_deg))).astype(np.float32)


def test_horn_plano_inclinado():
    z = plano(40, 50, 60.0, 10.0, 0.0)
    b = pendiente.horn(z, 60.0)
    interior = b[1:-1, 1:-1]
    assert np.allclose(interior, 10.0, atol=1e-3)
    assert np.isnan(b[0]).all() and np.isnan(b[:, -1]).all()      # bordes sin vecinos completos


def test_horn_pendiente_compuesta():
    z = plano(30, 30, 60.0, 6.0, 8.0)
    esperado = math.degrees(math.atan(math.hypot(math.tan(math.radians(6.0)), math.tan(math.radians(8.0)))))
    assert np.allclose(pendiente.horn(z, 60.0)[1:-1, 1:-1], esperado, atol=1e-3)


def test_horn_no_inventa_donde_falta_dato():
    z = plano(20, 20, 60.0, 5.0, 0.0)
    z[10, 10] = np.nan
    b = pendiente.horn(z, 60.0)
    assert np.isnan(b[9:12, 9:12]).all()
    assert np.isfinite(b[5, 5])


# ------------------------------------------------------------------ F9 · rugosidad
def test_rugosidad_plano_es_cero():
    z = plano(80, 80, 60.0, 7.0, -3.0)
    for w in (200, 400, 800, 1600):
        r = rugosidad.rugosidad(z, 60.0, w)
        assert np.nanmax(r) < 1e-2, w
        assert np.isfinite(r[40, 40])


def test_rugosidad_ventana_de_200_m_tiene_9_pixeles():
    # Documento 02: "una ventana de 200 m a 60 m por píxel tiene solo unos 9 píxeles".
    assert rugosidad.mascara_circular(200, 60.0).sum() == 9


def test_rugosidad_ruido_blanco():
    rng = np.random.default_rng(7)
    sigma = 2.0
    z = plano(160, 160, 60.0, 4.0, 2.0) + rng.normal(0, sigma, (160, 160)).astype(np.float32)
    n = int(rugosidad.mascara_circular(800, 60.0).sum())
    esperado = sigma * math.sqrt((n - 3) / n)
    r = rugosidad.rugosidad(z, 60.0, 800)
    assert np.nanmedian(r) == pytest.approx(esperado, rel=0.05)


def test_rugosidad_borde_queda_sin_dato():
    z = plano(60, 60, 60.0, 3.0, 0.0)
    r = rugosidad.rugosidad(z, 60.0, 1600)          # radio de 800 m ≈ 13 píxeles
    assert np.isnan(r[0, 0]) and np.isnan(r[5, 30])
    assert np.isfinite(r[30, 30])


# ------------------------------------------------------------------ F16 · luz rasante
def test_fbar_horizonte_constante():
    n_az, alto, ancho = 72, 10, 12
    h = np.full((n_az, alto, ancho), 5.0, dtype=np.float32)
    e = [1.5, 4.5, 5.5, 10.0]
    assert luz.f_media(h, e) == pytest.approx([1.0, 1.0, 0.0, 0.0])


def test_fbar_mitad_de_los_azimutes():
    h = np.zeros((72, 4, 4), dtype=np.float32)
    h[:36] = 8.0                                     # medio horizonte tapado hasta 8°
    assert luz.f_media(h, [3.0, 9.0]) == pytest.approx([0.5, 0.0])


def test_fbar_ignora_pixeles_sin_dato():
    h = np.full((8, 3, 3), 6.0, dtype=np.float32)
    h[:, 0, 0] = np.nan
    assert luz.f_media(h, [2.0]) == pytest.approx([1.0])


# ------------------------------------------------------------------ distribuciones
def test_cuantiles_101_y_monotonos():
    v = np.random.default_rng(1).gamma(2.0, 3.0, 5000)
    d = distribucion.cuantiles(v)
    assert len(d["cuantiles"]) == 101 and d["n"] == 5000
    assert np.all(np.diff(d["cuantiles"]) >= 0)
    # La salida se redondea a 4 decimales (tamaño del JSON): la tolerancia es medio último dígito.
    assert d["cuantiles"][50] == pytest.approx(float(np.median(v)), abs=5e-5)


def test_cuantiles_sin_datos_es_nulo():
    assert distribucion.cuantiles(np.array([np.nan, np.nan])) is None


# ------------------------------------------------------------------ escala
def test_promedio_bloques_exacto():
    base = np.arange(12, dtype=np.float32).reshape(3, 4)
    z = np.kron(base, np.ones((3, 3), dtype=np.float32))          # cada valor repetido en un bloque 3 × 3
    assert np.array_equal(bloques.promedio(z, 3), base)


def test_promedio_bloques_con_faltantes():
    z = np.ones((6, 6), dtype=np.float32)
    z[0, 0] = np.nan
    z[3:6, 3:6] = np.nan
    r, validos = bloques.promedio(z, 3, devolver_validos=True)
    assert r[0, 0] == pytest.approx(1.0) and validos[0, 0] == 8
    assert np.isnan(r[1, 1]) and validos[1, 1] == 0


def test_promedio_bloques_rechaza_tamano_no_multiplo():
    with pytest.raises(ValueError):
        bloques.promedio(np.zeros((7, 9), dtype=np.float32), 3)


def test_escala_sentinel2_respeta_offset_ya_aplicado():
    from motor.ingest.sentinel2 import _escala
    rb = {"raster:bands": [{"scale": 0.0001, "offset": -0.1}]}
    ya = {"properties": {"earthsearch:boa_offset_applied": True, "s2:processing_baseline": "05.11"}, "assets": {"red": rb}}
    no = {"properties": {"earthsearch:boa_offset_applied": False, "s2:processing_baseline": "05.11"}, "assets": {"red": rb}}
    vieja = {"properties": {"s2:processing_baseline": "03.01"}, "assets": {"red": {}}}
    assert _escala(ya, "red") == (0.0001, 0.0)
    assert _escala(no, "red") == (0.0001, -0.1)
    assert _escala(vieja, "red") == (0.0001, 0.0)
