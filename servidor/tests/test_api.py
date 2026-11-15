"""Pruebas del servidor en vivo:  python -m pytest servidor/tests

La más importante: lo que responde el servidor para el centro de Mons Mouton es EXACTAMENTE lo que
el motor exportó en la ficha del destino. Si alguna vez difieren, el servidor dejó de ser el motor.
"""
from __future__ import annotations

import json
import pathlib

import pytest

from servidor.app import app, terreno

RAIZ = pathlib.Path(__file__).resolve().parents[2]
FICHA = RAIZ / "web" / "public" / "data" / "destino" / "ficha_verano.json"


@pytest.fixture(scope="module")
def cliente():
    return app.test_client()


def test_estado(cliente):
    r = cliente.get("/api/estado")
    assert r.status_code == 200
    j = r.get_json()
    assert j["motor"] == "terra-x" and j["parametros_congelados"] is True
    assert j["grilla"] == {"filas": 500, "columnas": 500, "pixel_m": 60.0}


@pytest.mark.skipif(terreno() is None or not FICHA.exists(), reason="faltan las grillas reales de datos/ o la ficha exportada")
def test_el_centro_coincide_con_la_ficha_exportada(cliente):
    ficha = json.loads(FICHA.read_text(encoding="utf-8"))
    p = ficha["punto"]
    r = cliente.post("/api/destino/punto", json={"fila": p["fila"], "col": p["col"], "lunacion": "verano"})
    assert r.status_code == 200
    j = r.get_json()
    assert j["resultado"] == ficha["resultado"]
    assert j["punto"]["horizonte"]["n_az"] == ficha["horizonte"]["n_az"]
    s = j["serie"]
    assert len(s["elevacion_deg"]) == len(s["bateria_wh"]) == s["n"] and 0 < s["i0"] < s["i1"] < s["n"]
    assert j["maqueta"] is False and j["meta"]["parametros_sha256"] == ficha["meta"]["parametros_sha256"]


def test_los_cambios_del_usuario_quedan_marcados(cliente):
    r = cliente.post("/api/destino/punto", json={"fila": 100, "col": 380, "lunacion": "invierno", "consumo_w": 95, "bateria_wh": 10840})
    j = r.get_json()
    assert r.status_code == 200
    assert {c["clave"] for c in j["vehiculo"]["cambios"]} == {"consumo_w", "bateria_wh"}
    assert j["vehiculo"]["p_surv_w"] == pytest.approx(10840 / 50)          # F6 con la batería pedida
    assert j["resultado"]["consumo_w"] == 95.0


@pytest.mark.parametrize("cuerpo", [
    {"fila": 900, "col": 10, "lunacion": "verano"},
    {"fila": 10, "col": 10, "lunacion": "primavera"},
    {"fila": 10, "col": 10, "desde": "2027-01-01", "hasta": "2027-09-01"},
    {"fila": 10, "col": 10, "desde": "1850-01-01", "hasta": "1850-01-20"},
    {"fila": "x", "col": 10, "lunacion": "verano"},
    {"fila": 10, "col": 10, "lunacion": "verano", "consumo_w": 1e9},
])
def test_pedidos_invalidos_dan_400(cliente, cuerpo):
    r = cliente.post("/api/destino/punto", json=cuerpo)
    assert r.status_code == 400 and "error" in r.get_json()


def test_sombra_de_campo(cliente):
    r = cliente.post("/api/campo/sombra", json={"fecha": "2026-11-14", "hora_local": "18:10", "largo_sombra_m": 2.65})
    j = r.get_json()
    assert r.status_code == 200
    pred, comp = j["prediccion"], j["comparacion"]
    assert 5.0 < pred["elevacion_aparente_deg"] < 15.0 and pred["en_rango_h2"]
    assert pred["elevacion_aparente_deg"] > pred["elevacion_geometrica_deg"]      # F15: la refracción sube el Sol
    assert comp["sombra_calculada_m"] == pytest.approx(pred["sombra_m"], abs=1e-3)
    assert comp["pasa"] is (comp["error_corregido_frac"] <= j["meta_error_frac"])
    de_noche = cliente.post("/api/campo/sombra", json={"fecha": "2026-11-14", "hora_local": "23:10"}).get_json()
    assert de_noche["prediccion"]["sombra_m"] is None


def test_sol_ahora(cliente):
    j = cliente.get("/api/sol/ahora").get_json()
    assert -10.0 < j["luna"]["elevacion_deg"] < 10.0           # en Mons Mouton el Sol nunca pasa de ±7°
    assert 0.0 <= j["luna"]["azimut_deg"] < 360.0
