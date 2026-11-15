"""Utilidades comunes de descarga: cabeceras HTTP (versión), POST de JSON, entorno de GDAL y SHA-256.

Uso de SI: redactado con Claude Code para la Parte 4.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import urllib.request

import numpy as np

AGENTE = "terra-x-motor (NASA Space Apps 2026)"
RAIZ = pathlib.Path(__file__).resolve().parents[2]
DATOS = RAIZ / "datos"


def cabecera(url: str) -> dict:
    """Last-Modified y ETag: la versión del archivo remoto (las fuentes no publican SHA-256)."""
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(req, timeout=60) as r:
        return {k: r.headers.get(k) for k in ("Content-Length", "ETag", "Last-Modified")}


def post_json(url: str, cuerpo: dict, timeout: int = 120) -> dict:
    req = urllib.request.Request(url, data=json.dumps(cuerpo).encode("utf-8"), method="POST",
                                 headers={"User-Agent": AGENTE, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def descargar(url: str, destino: pathlib.Path, intentos: int = 8, espera_s: float = 5.0) -> str:
    """Baja un archivo entero, retomando donde se cortó (cabecera Range). Devuelve el SHA-256 del archivo."""
    import time

    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")
    for intento in range(1, intentos + 1):
        try:
            hecho = parcial.stat().st_size if parcial.exists() else 0
            cab = {"User-Agent": AGENTE, **({"Range": f"bytes={hecho}-"} if hecho else {})}
            with urllib.request.urlopen(urllib.request.Request(url, headers=cab), timeout=120) as r:
                modo = "ab" if hecho and r.status == 206 else "wb"
                with open(parcial, modo) as fh:
                    while bloque := r.read(1 << 20):
                        fh.write(bloque)
            parcial.replace(destino)
            break
        except Exception:
            if intento == intentos:
                raise
            time.sleep(espera_s * intento)
    h = hashlib.sha256()
    with open(destino, "rb") as fh:
        while bloque := fh.read(1 << 20):
            h.update(bloque)
    return h.hexdigest()


def sha(a: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()


def entorno_gdal(**extra):
    from rasterio.env import Env
    opciones = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.TIF",
                    GDAL_HTTP_USERAGENT=AGENTE, GDAL_HTTP_MAX_RETRY="8", GDAL_HTTP_RETRY_DELAY="3",
                    GDAL_HTTP_MULTIRANGE="SINGLE_GET", GDAL_HTTP_TIMEOUT="300", VSI_CACHE="TRUE",
                    AWS_NO_SIGN_REQUEST="YES")
    opciones.update(extra)                                    # `extra` puede pisar una opción de arriba
    return Env(**opciones)
