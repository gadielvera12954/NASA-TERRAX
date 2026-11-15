"""Parte 4 (Mathias): motor/exportar y la unión del NDVI en motor/huella, sobre carpetas temporales.

Resultados conocidos: el manifiesto lista cada archivo con su SHA-256 real, integra el manifiesto de
la Parte 3 tal cual y marca maqueta si algún archivo lo es; el NDVI de una parcela es la mediana de
sus píxeles y la marca interna `_ventana` no llega a la salida.

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from __future__ import annotations

import hashlib
import json

import numpy as np
import pytest

from motor.exportar import __main__ as exportar
from motor.huella import __main__ as huella


@pytest.fixture()
def carpetas(tmp_path, monkeypatch):
    salida, datos, web = tmp_path / "salida", tmp_path / "datos", tmp_path / "web"
    for d in (salida / "fichas", datos, web):
        d.mkdir(parents=True)
    monkeypatch.setattr(exportar, "SALIDA", salida)
    monkeypatch.setattr(exportar, "DATOS", datos)
    monkeypatch.setattr(exportar, "WEB", web)
    monkeypatch.setattr(exportar, "RAIZ", tmp_path)
    return salida, datos, web


def test_manifiesto_con_sha256_y_parte3(carpetas):
    salida, datos, web = carpetas
    ficha = salida / "fichas" / "P-01.json"
    ficha.write_text(json.dumps({"id": "P-01", "maqueta": False}), encoding="utf-8")
    m3 = {"archivos": [{"archivo": "fichas/P-01.json", "sha256": "x"}]}
    (salida / "manifest_parte3.json").write_text(json.dumps(m3), encoding="utf-8")
    m = exportar.principal([])
    copia = web / "fichas" / "P-01.json"
    assert copia.exists()
    fila = next(a for a in m["archivos"] if a["archivo"] == "fichas/P-01.json")
    assert fila["sha256"] == hashlib.sha256(copia.read_bytes()).hexdigest()
    assert m["partes"]["parte3"]["archivos"] == m3["archivos"]
    assert m["maqueta"] is False
    assert json.loads((web / "manifest.json").read_text(encoding="utf-8"))["proyecto"] == "TERRA-X"


def test_maqueta_se_propaga(carpetas):
    salida, _, _ = carpetas
    (salida / "fichas" / "P-02.json").write_text(json.dumps({"maqueta": True}), encoding="utf-8")
    assert exportar.principal([])["maqueta"] is True


def test_no_copia_maquetas_ni_internos(carpetas):
    salida, _, web = carpetas
    (salida / "maqueta").mkdir()
    (salida / "maqueta" / "x.json").write_text("{}", encoding="utf-8")
    (salida / "_tmp.json").write_text("{}", encoding="utf-8")
    exportar.principal([])
    assert not (web / "maqueta").exists() and not (web / "_tmp.json").exists()


def test_completar_ndvi_mediana_de_la_parcela(tmp_path, monkeypatch):
    monkeypatch.setattr(huella, "DATOS", tmp_path)
    (tmp_path / "grillas").mkdir()
    p90 = np.full((10, 10), 0.5, dtype=np.float32)
    p90[2:5, 2:5] = np.array([[0.1, 0.1, 0.1], [0.1, 0.2, 0.3], [0.3, 0.3, 0.3]], dtype=np.float32)
    np.save(tmp_path / "grillas" / "g_ndvi_p90.npy", p90)
    t = {"ndvi_p90": None, "fuentes": [], "_ventana": {"grilla": "g", "f0": 2, "c0": 2, "n": 3}}
    info = {"g": {"fuente": {"id": "sentinel2_l2a_ndvi_p90", "sha256": None}}}
    r = huella.completar_ndvi(t, info)
    assert r["ndvi_p90"] == pytest.approx(0.2)
    assert "_ventana" not in r and r["fuentes"][0]["id"] == "sentinel2_l2a_ndvi_p90"


def test_completar_ndvi_sin_dato_queda_nulo(tmp_path, monkeypatch):
    monkeypatch.setattr(huella, "DATOS", tmp_path)
    t = {"ndvi_p90": None, "fuentes": [], "_ventana": {"grilla": "g", "f0": 0, "c0": 0, "n": 3}}
    r = huella.completar_ndvi(t, None)
    assert r["ndvi_p90"] is None and "_ventana" not in r
