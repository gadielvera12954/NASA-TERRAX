"""Herramientas de validación: F13 (iluminación contra NASA), medición de campo (F14) y pruebas.json."""
import datetime as dt
import json
import math

import numpy as np
import pytest

import parametros
from motor.destino import iluminacion
from motor.horizonte import Capa
from motor.horizonte import geometria as g
from motor.tests import campo

UTC = dt.timezone.utc


def _grilla_lisa(n=5):
    R = 1737400.0
    x, y = g.xy_desde_latlon_polar_sur(-84.60, 31.00, R)
    meta = {"nombre": "lisa", "cuerpo": "luna", "pixel_m": 60.0, "x0_m": float(x), "y0_m": float(y),
            "proyeccion": {"tipo": "polar_estereografica_sur", "radio_m": R, "lon0_deg": 0.0}, "fuentes": [], "maqueta": True}
    return Capa(np.zeros((n, n), dtype=np.float32), 60.0, meta["x0_m"], meta["y0_m"]), meta


def test_f13_iluminacion_de_terreno_liso_es_la_fraccion_de_dia():
    capa, meta = _grilla_lisa()
    # Capa de margen (exigida por el contrato): sin ella los rayos de los bordes no tienen datos.
    margen = Capa(np.zeros((41, 41), dtype=np.float32), 600.0, capa.x0 + 120.0 - 12000.0, capa.y0 - 120.0 + 12000.0)
    pts = np.array([[2, 2], [0, 0]])
    vis = iluminacion.iluminacion_puntos([capa, margen], meta, pts, dt.datetime(2027, 10, 27, tzinfo=UTC), dt.datetime(2027, 11, 26, tzinfo=UTC),
                                         paso_h=3.0, n_az=72, altura_obs_m=0.0, d_max_m=3000.0)
    assert np.all((vis > 0.55) & (vis < 0.62))          # en verano el Sol está sobre el horizonte liso el 59 % del tiempo


def test_f13_correlacion():
    rng = np.random.default_rng(1)
    a = rng.uniform(0, 1, 500)
    r = iluminacion.correlacion(a, a)
    assert r["rho"] == pytest.approx(1.0) and r["rmse_puntos"] == 0.0 and r["n"] == 500
    r2 = iluminacion.correlacion(a, a + rng.normal(0, 0.05, 500))
    assert 0.9 < r2["rho"] < 1.0 and r2["rmse_puntos"] > 0
    r3 = iluminacion.correlacion(a, rng.uniform(0, 1, 500))
    assert abs(r3["rho"]) < 0.2


def test_comparacion_de_campo_con_mediciones_exactas_y_corridas():
    prm = parametros.cargar()
    lugar = prm["campo"]["lugar"]
    pred = json.loads((parametros.CARPETA.parent / "informe" / "datos" / "prediccion_campo_2026-11-14.json").read_text(encoding="utf-8"))
    exactas = []
    for f in pred["filas"]:
        if f["hora_local"] in ("17:55", "18:00", "18:10", "18:20", "18:30") and "sombra_m" in f:   # 17:50 está a 15,04°
            exactas.append({"hora_local": f["hora_local"] + ":00", "largo_sombra_m": str(f["sombra_m"]), "inclinacion_suelo_deg": "0",
                            "alto_m": "0.5", "ancho_m": "0.10"})
    r = campo.comparar(exactas, lugar, "2026-11-14", prm)
    assert r["n_en_rango"] == 5 and r["error_max_en_rango"] < 0.002 and r["pasa"]
    corridas = [{**x, "largo_sombra_m": str(float(x["largo_sombra_m"]) * 1.10)} for x in exactas]
    r2 = campo.comparar(corridas, lugar, "2026-11-14", prm)
    assert not r2["pasa"] and math.isclose(r2["error_max_en_rango"], 0.10, abs_tol=0.003)
    # A 14° el ancho mínimo de F19 es 1,94 cm: una tablita de 1 cm no llega a dar sombra plena.
    inclinadas = [{**exactas[0], "inclinacion_suelo_deg": "1.5", "ancho_m": "0.01"}]
    r3 = campo.comparar(inclinadas, lugar, "2026-11-14", prm)
    assert len(r3["mediciones"][0]["avisos"]) == 2
