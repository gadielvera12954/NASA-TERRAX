"""Parte 4 (Mathias): el verificador de integridad de web/public/data.

Resultados conocidos: un manifiesto coherente pasa; un byte cambiado, un archivo de más o uno que
falta se detectan con el motivo correcto; y los datos realmente publicados en el repositorio
coinciden con su manifiesto (esta última es la prueba que corre el CI antes de cada entrega).

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from __future__ import annotations

import hashlib
import json

import pytest

import parametros
from motor.exportar import verificar as v


def _publicar(web, archivos: dict[str, bytes], **extra):
    lista = []
    for rel, contenido in archivos.items():
        p = web / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(contenido)
        lista.append({"archivo": rel, "bytes": len(contenido), "sha256": hashlib.sha256(contenido).hexdigest(), "maqueta": False})
    m = {"proyecto": "TERRA-X", "version": "t", "maqueta": False, "fecha": "2026-11-15",
         "parametros_sha256": parametros.huella(), "fuentes": [], "archivos": lista, "partes": {"parte3": None}, **extra}
    (web / "manifest.json").write_text(json.dumps(m), encoding="utf-8")
    return m


def test_manifiesto_coherente_pasa(tmp_path):
    _publicar(tmp_path, {"fichas/P-01.json": b'{"id": "P-01"}', "destino/h.bin": bytes(range(256))})
    r = v.verificar(tmp_path)
    assert r["ok"] and r["archivos"] == 2 and r["bytes"] == 14 + 256 and r["fallas"] == []


def test_detecta_byte_cambiado_archivo_de_mas_y_faltante(tmp_path):
    _publicar(tmp_path, {"a.json": b"{}", "b.json": b"[]", "c.json": b"1"})
    (tmp_path / "a.json").write_bytes(b"[]")            # mismo tamaño, otro contenido
    (tmp_path / "extra.json").write_bytes(b"0")         # no está en el manifiesto
    (tmp_path / "c.json").unlink()                      # listado pero ausente
    r = v.verificar(tmp_path)
    tipos = {(f["tipo"], f["archivo"]) for f in r["fallas"]}
    assert not r["ok"]
    assert tipos == {("sha256", "a.json"), ("sin_listar", "extra.json"), ("falta", "c.json")}


def test_detecta_maqueta_encubierta_y_parametros_distintos(tmp_path):
    m = _publicar(tmp_path, {"a.json": b"{}"})
    m["archivos"][0]["maqueta"] = True
    m["parametros_sha256"] = "0" * 64
    (tmp_path / "manifest.json").write_text(json.dumps(m), encoding="utf-8")
    tipos = {f["tipo"] for f in v.verificar(tmp_path)["fallas"]}
    assert tipos == {"maqueta", "parametros"}


def test_cli_devuelve_1_cuando_falla(tmp_path, capsys):
    _publicar(tmp_path, {"a.json": b"{}"})
    assert v.principal(["--web", str(tmp_path)]) == 0
    assert capsys.readouterr().out.startswith("OK:")
    (tmp_path / "a.json").write_bytes(b"x ")
    assert v.principal(["--web", str(tmp_path), "--json"]) == 1
    informe = json.loads(capsys.readouterr().out)
    assert informe["ok"] is False and informe["fallas"][0]["tipo"] == "sha256"


@pytest.mark.skipif(not (v.WEB / "manifest.json").exists(), reason="no hay datos publicados en web/public/data")
def test_los_datos_publicados_coinciden_con_su_manifiesto():
    r = v.verificar()
    assert r["ok"], r["fallas"]
    assert r["archivos"] >= 60 and r["fuentes"] >= 14
