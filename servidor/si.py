"""TERRA-X · relay for the SI guide (Gemini), so the API key never reaches the browser.

The web builds the whole request (system instruction with the published data, conversation) and
posts it here; this server adds the key from the environment variable TERRAX_GEMINI_KEY and
forwards it to Gemini. The model is fixed, the request size is capped and each visitor address
gets at most 20 requests per minute. The answers are still checked against the published data in
the browser (web/src/si/verificadorSI.ts) before they are shown.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request

MODELO = "gemini-3.5-flash"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent"
POR_MINUTO = 20

bp = Blueprint("si", __name__)
_PEDIDOS: dict[str, list[float]] = {}
_LOCK = threading.Lock()


def _permitido(ip: str) -> bool:
    with _LOCK:
        t = [x for x in _PEDIDOS.get(ip, []) if time.time() - x < 60]
        if len(t) >= POR_MINUTO:
            _PEDIDOS[ip] = t
            return False
        t.append(time.time())
        _PEDIDOS[ip] = t
        return True


@bp.get("/api/si/estado")
def estado():
    return jsonify({"disponible": bool(os.environ.get("TERRAX_GEMINI_KEY")), "modelo": MODELO})


@bp.post("/api/si/chat")
def chat():
    if request.headers.get("X-TerraX") != "1":
        return jsonify({"error": "missing X-TerraX header"}), 403
    clave = os.environ.get("TERRAX_GEMINI_KEY", "").strip()
    if not clave:
        return jsonify({"error": "the SI guide is not configured on this server"}), 503
    if not _permitido(request.remote_addr or "?"):
        return jsonify({"error": "too many questions; wait a minute"}), 429
    d = request.get_json(silent=True)
    if not isinstance(d, dict) or not isinstance(d.get("contents"), list) or not d["contents"]:
        return jsonify({"error": "'contents' is required"}), 400
    sistema = d.get("systemInstruction")
    cuerpo = {
        "contents": d["contents"][-12:],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096, "thinkingConfig": {"thinkingLevel": "low"}},
    }
    if isinstance(sistema, dict):
        cuerpo["systemInstruction"] = sistema
    req = urllib.request.Request(URL, data=json.dumps(cuerpo).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": clave})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.loads(r.read())
    except urllib.error.HTTPError as e:
        return jsonify({"error": f"Gemini answered HTTP {e.code}"}), 502
    except Exception as e:  # network or timeout
        return jsonify({"error": f"Gemini unreachable ({type(e).__name__})"}), 502
    partes = ((j.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    texto = "".join(p.get("text", "") for p in partes if isinstance(p, dict))
    if not texto.strip():
        return jsonify({"error": "empty answer"}), 502
    return jsonify({"texto": texto, "modelo": j.get("modelVersion", MODELO)})
