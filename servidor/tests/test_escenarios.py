"""Pruebas de /api/destino/comparar y de la reutilización de cálculos:  python -m pytest servidor/tests

Lo que importa: comparar no es otro cálculo. Cada escenario de /comparar da EXACTAMENTE lo mismo que
/punto con el mismo pedido, el scenario_id se repite si el pedido se repite, y lo reutilizado da los
mismos números que lo recién calculado.

Uso de SI: redactado con Claude Code para la Parte de Jean.
"""
from __future__ import annotations

import json
import pathlib
import threading

import pytest

pytest.importorskip("flask", reason="pip install -r servidor/requirements.txt")

from servidor import app as servidor  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parents[2]
FICHA = RAIZ / "web" / "public" / "data" / "destino" / "ficha_verano.json"
A = {"id": "A", "fila": 100, "col": 380, "lunacion": "invierno"}
B = {"id": "B", "fila": 250, "col": 250, "lunacion": "invierno", "consumo_w": 95}


@pytest.fixture(scope="module")
def cliente():
    return servidor.app.test_client()


def _sin_id(p: dict) -> dict:
    return {k: v for k, v in p.items() if k != "id"}


def test_cada_escenario_es_igual_a_punto(cliente):
    r = cliente.post("/api/destino/comparar", json={"escenarios": [A, B]})
    assert r.status_code == 200
    j = r.get_json()
    assert [e["id"] for e in j["escenarios"]] == ["A", "B"] and all(e["ok"] for e in j["escenarios"])
    for pedido, e in zip((A, B), j["escenarios"]):
        solo = cliente.post("/api/destino/punto", json=_sin_id(pedido)).get_json()
        assert e["escenario"]["resultado"] == solo["resultado"]
        assert e["escenario"]["serie"]["bateria_wh"] == solo["serie"]["bateria_wh"]
        assert e["scenario_id"] == solo["scenario_id"]
    assert {x["id"] for x in j["resumen"]} == {"A", "B"}
    assert set(j["mejor"]) == {"tramo_oscuro_mas_largo_h", "bateria_minima_frac", "sobre_p_surv_frac"}
    assert j["meta"]["producto"] == "comparacion_en_vivo"


def test_el_id_es_reproducible_y_distingue_pedidos(cliente):
    a1 = cliente.post("/api/destino/punto", json=_sin_id(A)).get_json()
    a2 = cliente.post("/api/destino/punto", json=_sin_id(A)).get_json()
    b = cliente.post("/api/destino/punto", json=_sin_id(B)).get_json()
    assert a1["scenario_id"] == a2["scenario_id"] and len(a1["scenario_id"]) == 64
    assert a1["scenario_id"] != b["scenario_id"]
    otro_consumo = cliente.post("/api/destino/punto", json={**_sin_id(A), "consumo_w": 90}).get_json()
    assert otro_consumo["scenario_id"] != a1["scenario_id"]


def test_lo_reutilizado_da_los_mismos_numeros(cliente):
    servidor.vaciar_cache()
    nuevo = cliente.post("/api/destino/punto", json=_sin_id(A)).get_json()
    repetido = cliente.post("/api/destino/punto", json=_sin_id(A)).get_json()
    assert nuevo["reutilizado"]["serie_sol"] is False and repetido["reutilizado"]["serie_sol"] is True
    if servidor.terreno() is not None:                       # sin grillas el horizonte sale de horizontes.bin
        assert nuevo["reutilizado"]["horizonte"] is False and repetido["reutilizado"]["horizonte"] is True
    for clave in ("resultado", "serie", "horizonte_grilla_deg", "scenario_id"):
        assert nuevo[clave] == repetido[clave]


def test_pedidos_simultaneos_no_se_pisan(cliente):
    servidor.vaciar_cache()
    pedidos = [_sin_id(A), _sin_id(B), _sin_id(A), {**_sin_id(B), "consumo_w": 120}]
    salida: list = [None] * len(pedidos)

    def correr(i):
        with servidor.app.test_client() as c:
            salida[i] = c.post("/api/destino/punto", json=pedidos[i]).get_json()

    hilos = [threading.Thread(target=correr, args=(i,)) for i in range(len(pedidos))]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()
    assert salida[0]["resultado"] == salida[2]["resultado"]
    assert salida[1]["resultado"]["consumo_w"] == 95.0 and salida[3]["resultado"]["consumo_w"] == 120.0
    for i, p in enumerate(pedidos):
        assert salida[i]["resultado"] == cliente.post("/api/destino/punto", json=p).get_json()["resultado"]


def test_un_escenario_invalido_no_tumba_a_los_demas(cliente):
    r = cliente.post("/api/destino/comparar", json={"escenarios": [A, {"id": "malo", "fila": 900, "col": 10, "lunacion": "verano"}]})
    assert r.status_code == 200
    a, malo = r.get_json()["escenarios"]
    assert a["ok"] is True and malo["ok"] is False and "outside" in malo["error"]
    assert [x["id"] for x in r.get_json()["resumen"]] == ["A"]


def test_sin_series_es_mas_liviano(cliente):
    j = cliente.post("/api/destino/comparar", json={"escenarios": [A, B], "series": False}).get_json()
    for e in j["escenarios"]:
        assert "serie" not in e["escenario"] and "horizonte_grilla_deg" not in e["escenario"]
        assert "resultado" in e["escenario"]


@pytest.mark.parametrize("cuerpo", [
    {},
    {"escenarios": "A"},
    {"escenarios": [A]},
    {"escenarios": [A, B, A | {"id": "C"}, B | {"id": "D"}]},
    {"escenarios": [A, A]},
])
def test_limites_del_lote(cliente, cuerpo):
    r = cliente.post("/api/destino/comparar", json=cuerpo)
    assert r.status_code == 400 and "error" in r.get_json()


@pytest.mark.skipif(servidor.terreno() is None or not FICHA.exists(), reason="faltan las grillas reales de datos/ o la ficha exportada")
def test_el_centro_en_un_lote_coincide_con_la_ficha(cliente):
    ficha = json.loads(FICHA.read_text(encoding="utf-8"))
    p = ficha["punto"]
    centro = {"id": "centro", "fila": p["fila"], "col": p["col"], "lunacion": "verano"}
    j = cliente.post("/api/destino/comparar", json={"escenarios": [centro, A], "series": False}).get_json()
    assert j["escenarios"][0]["escenario"]["resultado"] == ficha["resultado"]
