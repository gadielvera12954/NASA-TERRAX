"""Los relieves 3D publicados (web/public/modelos) son los que dice modelos.json.

Comprueba huellas SHA-256, que Luna y Tierra tengan la misma extensión y el mismo píxel (para que se
vean a la misma escala en "Dos mundos"), que la candidata marcada caiga dentro de la grilla y, si
las grillas de datos/ están en esta máquina, que la malla salga de esa grilla y no de otra.

Uso de SI: redactado con Claude Code para la Parte de Jean.
"""
from __future__ import annotations

import hashlib
import json
import pathlib

import numpy as np
import pytest

RAIZ = pathlib.Path(__file__).resolve().parents[2]
MODELOS = RAIZ / "web" / "public" / "modelos"
GRILLAS = RAIZ / "datos" / "grillas"
INDICE = RAIZ / "web" / "public" / "data" / "fichas" / "indice.json"


@pytest.fixture(scope="module")
def terrenos() -> dict:
    return json.loads((MODELOS / "modelos.json").read_text(encoding="utf-8"))["terrenos"]


def _sha(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def test_hay_luna_y_tierra(terrenos):
    assert terrenos["mons_mouton"]["grilla"] == "mons_mouton_60m"
    assert terrenos["payunia"]["cuerpo"] == "tierra" and terrenos["payunia"]["grilla"] == "payunia_p27_60m"


@pytest.mark.parametrize("nombre", ["mons_mouton", "payunia", "marte_jezero"])
def test_huellas_de_los_archivos(terrenos, nombre):
    t = terrenos[nombre]
    assert _sha(MODELOS / t["archivo"]) == t["sha256"]
    assert _sha(MODELOS / t["normales"]) == t["normales_sha256"]
    assert t["exageracion_vertical"] == 1.0 and t["unidad_malla"] == "km"
    assert all(f.get("sha256") for f in t["fuentes"])


def test_misma_escala_horizontal(terrenos):
    luna, tierra = terrenos["mons_mouton"], terrenos["payunia"]
    for clave in ("pixel_m", "pixel_malla_m", "filas", "columnas"):
        assert luna[clave] == tierra[clave]
    assert tierra["pixel_m"] == 60.0


def test_la_candidata_esta_en_la_grilla_y_en_el_ranking(terrenos):
    t = terrenos["payunia"]
    c = t["candidata"]
    assert 0 <= c["fila"] < t["filas"] and 0 <= c["col"] < t["columnas"]
    medio = c["parcela_km"] * 1000 / t["pixel_m"] / 2
    assert medio <= c["fila"] <= t["filas"] - medio and medio <= c["col"] <= t["columnas"] - medio
    indice = json.loads(INDICE.read_text(encoding="utf-8"))
    entrada = next(x for x in indice["candidatas"] if x["id"] == c["id"])
    assert entrada["lugar"]["lat"] == pytest.approx(c["lat_deg"]) and entrada["lugar"]["lon"] == pytest.approx(c["lon_deg"])
    parcelas = t["parcelas"]
    assert c["id"] in {p["id"] for p in parcelas}
    ids_ranking = {x["id"] for x in indice["candidatas"] if not x.get("control")}
    for p in parcelas:
        assert p["id"] in ids_ranking
        assert medio <= p["fila"] <= t["filas"] - 1 - medio and medio <= p["col"] <= t["columnas"] - 1 - medio
    assert t["proyeccion"]["lat_centro_deg"] == pytest.approx(entrada["lugar"]["lat"])
    assert t["proyeccion"]["lon_centro_deg"] == pytest.approx(entrada["lugar"]["lon"])


@pytest.mark.parametrize("nombre", ["mons_mouton", "payunia", "marte_jezero"])
def test_la_malla_sale_de_su_grilla(terrenos, nombre):
    t = terrenos[nombre]
    base = GRILLAS / t["grilla"]
    if not base.with_suffix(".npy").exists():
        pytest.skip(f"falta datos/grillas/{t['grilla']} en esta máquina")
    z = np.load(base.with_suffix(".npy"))
    meta = json.loads(base.with_suffix(".json").read_text(encoding="utf-8"))
    assert z.shape == (t["filas"], t["columnas"]) and np.isfinite(z).all()
    assert float(np.min(z)) == pytest.approx(t["z_min_m"]) and float(np.max(z)) == pytest.approx(t["z_max_m"])
    assert [f["sha256"] for f in meta["fuentes"]] == [f["sha256"] for f in t["fuentes"]]


def test_marte_a_su_resolucion_nativa_y_misma_extension(terrenos):
    """Marte va a 200 m nativos (sin interpolar) pero cubre los mismos 30 km que la Luna y la Tierra."""
    marte, luna = terrenos["marte_jezero"], terrenos["mons_mouton"]
    assert marte["cuerpo"] == "marte" and marte["pixel_m"] == 200.0 and marte["pixel_malla_m"] == 200.0
    lado = lambda t: t["columnas"] * t["pixel_m"]
    assert lado(marte) == lado(luna) == 30000.0
    assert marte["sitio"]["id"] == "jezero_perseverance"
    assert -3000.0 < marte["z_min_m"] < marte["z_max_m"] < -1000.0          # Jezero: piso cerca de −2600 m
