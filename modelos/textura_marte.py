"""Global colour texture of Mars for the home page globe (web/public/img/inicio/marte_color.webp).

Source: USGS Astrogeology, Viking Orbiter colour mosaic, 925 m/pixel, public domain
(Mars_Viking_ClrMosaic_global_925m.tif, equirectangular, 23059 x 11530, 3 bands).
The file has no overviews, so 512 evenly spaced rows are read by HTTP Range (about 35 MB), and each
row is averaged down to 1024 columns. Nothing else is changed: no recolouring, no sharpening.
The URL, version (Last-Modified, ETag) and the SHA-256 of the output go next to it in marte_color.json.

    .venv/Scripts/python -m modelos.textura_marte
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import shutil
import struct
import subprocess
import urllib.request
import zlib

import numpy as np
import rasterio
from rasterio.env import Env
from rasterio.windows import Window

URL = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_Viking_ClrMosaic_global_925m.tif"
URL_PUBLICA = "https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif"
ANCHO, ALTO = 1024, 512
RAIZ = pathlib.Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "web" / "public" / "img" / "inicio"


def cabecera(url: str) -> dict:
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=30) as r:
        return {"last_modified": r.headers.get("Last-Modified"), "etag": r.headers.get("ETag"), "bytes": int(r.headers.get("Content-Length", 0))}


def png(ruta: pathlib.Path, rgb: np.ndarray) -> None:
    """Minimal PNG writer (8-bit RGB), so the script needs no imaging library."""
    alto, ancho, _ = rgb.shape
    crudo = b"".join(b"\x00" + rgb[y].tobytes() for y in range(alto))

    def trozo(tipo: bytes, datos: bytes) -> bytes:
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)

    ruta.write_bytes(b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
                     + trozo(b"IDAT", zlib.compress(crudo, 9)) + trozo(b"IEND", b""))


def principal() -> None:
    version = cabecera(URL)
    with Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif", GDAL_HTTP_MAX_RETRY="6", GDAL_HTTP_RETRY_DELAY="2"):
        with rasterio.open("/vsicurl/" + URL) as ds:
            w, h = ds.width, ds.height
            filas = ((np.arange(ALTO) + 0.5) * h / ALTO).astype(int)
            bordes = np.linspace(0, w, ANCHO + 1).astype(int)
            out = np.zeros((ALTO, ANCHO, 3), np.float64)
            for i, f in enumerate(filas):
                fila = ds.read(window=Window(0, int(f), w, 1))[:, 0, :].astype(np.float64)  # (3, w)
                suma = np.add.reduceat(fila, bordes[:-1], axis=1)
                out[i] = (suma / np.diff(bordes)).T
                if i % 64 == 0:
                    print(f"  row {i}/{ALTO}", flush=True)
    rgb = np.clip(np.rint(out), 0, 255).astype(np.uint8)
    SALIDA.mkdir(parents=True, exist_ok=True)
    tmp = SALIDA / "marte_color.png"
    png(tmp, rgb)
    webp = SALIDA / "marte_color.webp"
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(tmp), "-c:v", "libwebp", "-quality", "88", str(webp)], check=True)
        tmp.unlink()
        final = webp
    else:
        final = tmp
    meta = {
        "id": "usgs_mars_viking_clrmosaic_global_925m",
        "fuente": "USGS Astrogeology · Viking Orbiter global colour mosaic, 925 m/px (public domain)",
        "url": URL_PUBLICA,
        "url_lectura": URL,
        "version": version,
        "proceso": f"{ALTO} evenly spaced rows, each averaged to {ANCHO} columns; no recolouring",
        "archivo": final.name,
        "sha256": hashlib.sha256(final.read_bytes()).hexdigest(),
    }
    (SALIDA / "marte_color.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    principal()
