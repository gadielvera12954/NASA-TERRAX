"""Teselas de Copernicus GLO-30 (relieve de la Tierra, 1 segundo de arco) desde AWS Open Data.

Cada tesela cubre 1° x 1° y se nombra por su esquina sudoeste: S37_W070 va de 37°S a 36°S y de
70°O a 69°O. Alturas en metros sobre el geoide EGM2008. Licencia: uso gratuito con el aviso de la
licencia de Copernicus WorldDEM-30 (ver THIRD_PARTY_NOTICES.md).

Se guarda en datos/crudos/copernicus/<tesela>.npy|json con la transformación, la versión HTTP y el
SHA-256 del arreglo, para no volver a bajarla.

Uso de SI: redactado con Claude Code para la Parte 4.
"""
from __future__ import annotations

import json
import math

import numpy as np

from .remoto import DATOS, cabecera, descargar, entorno_gdal, sha

BASE = "https://copernicus-dem-30m.s3.amazonaws.com"


def nombre_tesela(lat_sw: int, lon_sw: int) -> str:
    ns = f"{'S' if lat_sw < 0 else 'N'}{abs(lat_sw):02d}_00"
    eo = f"{'W' if lon_sw < 0 else 'E'}{abs(lon_sw):03d}_00"
    return f"Copernicus_DSM_COG_10_{ns}_{eo}_DEM"


def tesela_de(lat: float, lon: float) -> tuple[int, int]:
    return int(math.floor(lat)), int(math.floor(lon))


def url(lat_sw: int, lon_sw: int) -> str:
    n = nombre_tesela(lat_sw, lon_sw)
    return f"{BASE}/{n}/{n}.tif"


def bajar(lat_sw: int, lon_sw: int):
    """Devuelve (alturas float32 con NaN, transformación afín, procedencia)."""
    import rasterio
    from affine import Affine

    carpeta = DATOS / "crudos" / "copernicus"
    carpeta.mkdir(parents=True, exist_ok=True)
    n = nombre_tesela(lat_sw, lon_sw)
    npy, ruta_meta = carpeta / f"{n}.npy", carpeta / f"{n}.json"
    if npy.exists() and ruta_meta.exists():
        meta = json.loads(ruta_meta.read_text(encoding="utf-8"))
        return np.load(npy), Affine(*meta["transform"]), meta
    u = url(lat_sw, lon_sw)
    version = cabecera(u)
    tif = carpeta / f"{n}.tif"
    sha_archivo = descargar(u, tif)
    with entorno_gdal():
        with rasterio.open(tif) as ds:
            z = ds.read(1).astype(np.float32)
            if ds.nodata is not None:
                z[z == ds.nodata] = np.nan
            t = ds.transform
            crs = ds.crs.to_string()
    meta = {"id": f"copernicus_glo30_{n}", "url": u,
            "version": f"{version.get('Last-Modified')} · ETag {version.get('ETag')}",
            "sha256": sha(z), "sha256_archivo": sha_archivo, "crs": crs, "transform": list(t)[:6], "forma": list(z.shape),
            "sin_dato_frac": float(np.isnan(z).mean())}
    np.save(npy, z, allow_pickle=False)
    ruta_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return z, t, meta
