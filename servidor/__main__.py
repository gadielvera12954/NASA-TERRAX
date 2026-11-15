"""Arranque del servidor del motor en vivo:  python -m servidor  (o  python servidor/__main__.py).

Por defecto escucha solo en esta máquina (127.0.0.1:8787). Para publicarlo (ver PUBLICAR.md):
    python -m servidor --host 0.0.0.0 --puerto 8080
o con un servidor WSGI de producción:
    waitress-serve --host 0.0.0.0 --port 8080 servidor.app:app
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

from servidor.app import app, calentar  # noqa: E402


def principal() -> None:
    p = argparse.ArgumentParser(description="TERRA-X · motor en vivo y relevo del chat SI")
    p.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    p.add_argument("--puerto", type=int, default=int(os.environ.get("PORT", "8787")))
    a = p.parse_args()
    calentar()
    print(f"TERRA-X motor en vivo: http://{a.host}:{a.puerto}/api/estado", flush=True)
    app.run(host=a.host, port=a.puerto, debug=False, threaded=True)


if __name__ == "__main__":
    principal()
