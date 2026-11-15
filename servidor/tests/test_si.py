"""SI relay (servidor/si.py): the key stays on the server and the relay refuses what it should."""
from __future__ import annotations

import pytest

pytest.importorskip("flask", reason="pip install -r servidor/requirements.txt")

from servidor import si  # noqa: E402
from servidor.app import app  # noqa: E402

H = {"X-TerraX": "1"}
PEDIDO = {"contents": [{"role": "user", "parts": [{"text": "hola"}]}]}


def test_clave_vacia_no_anuncia_conexion(monkeypatch):
    monkeypatch.setenv("TERRAX_GEMINI_KEY", "   ")
    c = app.test_client()
    assert c.get("/api/si/estado").get_json()["disponible"] is False
    assert c.post("/api/si/chat", json=PEDIDO, headers=H).status_code == 503


def test_sin_clave_responde_503_y_lo_dice(monkeypatch):
    monkeypatch.delenv("TERRAX_GEMINI_KEY", raising=False)
    c = app.test_client()
    assert c.get("/api/si/estado").get_json()["disponible"] is False
    r = c.post("/api/si/chat", json=PEDIDO, headers=H)
    assert r.status_code == 503 and "not configured" in r.get_json()["error"]


def test_exige_cabecera_y_contenido(monkeypatch):
    monkeypatch.setenv("TERRAX_GEMINI_KEY", "clave-de-prueba")
    c = app.test_client()
    assert c.post("/api/si/chat", json=PEDIDO).status_code == 403
    assert c.post("/api/si/chat", json={"contents": []}, headers=H).status_code == 400


def test_freno_por_minuto(monkeypatch):
    monkeypatch.setenv("TERRAX_GEMINI_KEY", "clave-de-prueba")
    monkeypatch.setattr(si, "_PEDIDOS", {"127.0.0.1": [__import__("time").time()] * si.POR_MINUTO})
    r = app.test_client().post("/api/si/chat", json=PEDIDO, headers=H)
    assert r.status_code == 429


def test_la_clave_nunca_vuelve_al_navegador(monkeypatch):
    monkeypatch.setenv("TERRAX_GEMINI_KEY", "clave-secreta-de-prueba")

    class Respuesta:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return b'{"candidates":[{"content":{"parts":[{"text":"Respuesta de prueba"}]}}],"modelVersion":"gemini-3.5-flash"}'

    vistos = {}

    def falso_urlopen(req, timeout=0):
        vistos["clave"] = req.headers.get("X-goog-api-key")
        return Respuesta()

    monkeypatch.setattr(si.urllib.request, "urlopen", falso_urlopen)
    monkeypatch.setattr(si, "_PEDIDOS", {})
    r = app.test_client().post("/api/si/chat", json=PEDIDO, headers=H)
    assert r.status_code == 200 and r.get_json()["texto"] == "Respuesta de prueba"
    assert vistos["clave"] == "clave-secreta-de-prueba"
    assert "clave-secreta-de-prueba" not in r.get_data(as_text=True)
