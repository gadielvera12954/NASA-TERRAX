"""Arranque del servidor del motor en vivo:  python -m servidor  (o  python servidor/__main__.py)."""
from __future__ import annotations

import argparse
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

from servidor.app import app, calentar  # noqa: E402


def principal() -> None:
    p = argparse.ArgumentParser(description="TERRA-X · motor en vivo (solo en esta máquina)")
    p.add_argument("--puerto", type=int, default=8787)
    a = p.parse_args()
    calentar()
    print(f"TERRA-X motor en vivo: http://127.0.0.1:{a.puerto}/api/estado", flush=True)
    app.run(host="127.0.0.1", port=a.puerto, debug=False, threaded=True)


if __name__ == "__main__":
    principal()
