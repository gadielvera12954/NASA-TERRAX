"""TERRA-X · relieve real de Marte para la comparación 3D (Jezero, sitio de aterrizaje de Perseverance).

    .venv\\Scripts\\python.exe -m modelos.grilla_marte

Fuente: USGS Astrogeology, "Mars MGS MOLA - MEX HRSC Blended DEM Global 200m v2" (HRSC de Mars
Express combinado con MOLA de Mars Global Surveyor), alturas en metros sobre la esfera de referencia
Mars 2000 (radio 3396,19 km). El archivo global pesa 11,4 GB y está guardado por filas sin comprimir:
se leen por HTTP Range solo las filas de la ventana alrededor de Jezero (unos 85 MB) y quedan en
datos/crudos/marte/ con la URL, la versión (Last-Modified y ETag) y el SHA-256 del arreglo.

Arma, en una proyección azimutal equidistante local sobre la esfera de Marte, centrada en el sitio
de aterrizaje de Perseverance (Octavia E. Butler, 18,4447° N, 77,4508° E):

    datos/grillas/marte_jezero_200m.{npy,json}         30 x 30 km (150 x 150): la misma extensión que
                                                       Mons Mouton y Payunia
    datos/grillas/marte_jezero_amplio_200m.{npy,json}  70 x 70 km, solo para el horizonte de los renders

A 200 m, su resolución NATIVA: no se interpola a 60 m (sería inventar detalle). Por eso Marte se ve
más liso que la Luna y la Tierra, y la web lo rotula. Estas grillas son solo para mostrar el relieve:
el motor físico (Luna y Tierra) no las lee.

Uso de SI: redactado con Claude Code para la Parte de Jean.
"""
from __future__ import annotations

import hashlib
import json
import math
import pathlib

import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parents[1]
CRUDOS = RAIZ / "datos" / "crudos" / "marte"
GRILLAS = RAIZ / "datos" / "grillas"
URL = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
URL_PUBLICA = "https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
RADIO_M = 3396190.0
PIXEL_M = 200.0
SITIO = {"id": "jezero_perseverance", "nombre": "Jezero crater, Perseverance landing site (Octavia E. Butler)",
         "lat_deg": 18.4447, "lon_deg": 77.4508,
         "fuente": "NASA/JPL, Mars 2020 landing site coordinates"}
AGENTE = "terra-x-motor (NASA Space Apps 2026)"


def _sha(a: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()


def ventana(medio_km: float = 40.0):
    """Lee (o reutiliza) la ventana geográfica alrededor del sitio. Devuelve (z, transform, crs_wkt, meta)."""
    import rasterio
    from affine import Affine
    from rasterio.env import Env
    from rasterio.windows import from_bounds

    from motor.ingest.remoto import cabecera

    CRUDOS.mkdir(parents=True, exist_ok=True)
    npy, ruta_meta = CRUDOS / "jezero_ventana.npy", CRUDOS / "jezero_ventana.json"
    if npy.exists() and ruta_meta.exists():
        meta = json.loads(ruta_meta.read_text(encoding="utf-8"))
        return np.load(npy), Affine(*meta["transform"]), meta["crs_wkt"], meta
    dlat = math.degrees(medio_km * 1000.0 / RADIO_M)
    dlon = dlat / math.cos(math.radians(SITIO["lat_deg"]))
    version = cabecera(URL)
    with Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
             GDAL_HTTP_USERAGENT=AGENTE, GDAL_HTTP_MAX_RETRY="8", GDAL_HTTP_RETRY_DELAY="3", VSI_CACHE="TRUE"):
        with rasterio.open("/vsicurl/" + URL) as ds:
            w = from_bounds(SITIO["lon_deg"] - dlon, SITIO["lat_deg"] - dlat, SITIO["lon_deg"] + dlon, SITIO["lat_deg"] + dlat,
                            transform=ds.transform).round_offsets().round_lengths()
            z = ds.read(1, window=w).astype(np.float32)
            if ds.nodata is not None:
                z[z == ds.nodata] = np.nan
            t = ds.window_transform(w)
            crs_wkt = ds.crs.to_wkt()
    meta = {"id": "usgs_mars_hrsc_mola_blend_200m_v2", "url": URL_PUBLICA, "url_lectura": URL,
            "version": f"{version.get('Last-Modified')} · ETag {version.get('ETag')}",
            "sha256": _sha(z), "ventana": [int(w.col_off), int(w.row_off), int(w.width), int(w.height)],
            "transform": list(t)[:6], "crs_wkt": crs_wkt, "forma": list(z.shape),
            "sin_dato_frac": float(np.isnan(z).mean())}
    np.save(npy, z, allow_pickle=False)
    ruta_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return z, t, crs_wkt, meta


def local(z, t, crs_wkt, lado_m: float):
    """Reproyecta a una grilla azimutal equidistante local de `lado_m`, por PROMEDIO, a 200 m."""
    from rasterio.transform import from_origin
    from rasterio.warp import Resampling, reproject

    n = int(round(lado_m / PIXEL_M))
    dst = np.full((n, n), np.nan, dtype=np.float32)
    crs_local = (f"+proj=aeqd +lat_0={SITIO['lat_deg']} +lon_0={SITIO['lon_deg']} +x_0=0 +y_0=0 "
                 f"+R={RADIO_M} +units=m +no_defs")
    medio = n * PIXEL_M / 2.0
    t_dst = from_origin(-medio, medio, PIXEL_M, PIXEL_M)
    reproject(source=z, destination=dst, src_transform=t, src_crs=crs_wkt, src_nodata=np.nan,
              dst_transform=t_dst, dst_crs=crs_local, dst_nodata=np.nan, resampling=Resampling.average)
    return dst, {"x0_m": -medio + PIXEL_M / 2.0, "y0_m": medio - PIXEL_M / 2.0, "crs": crs_local}


def escribir(nombre: str, z: np.ndarray, extra: dict, fuente: dict) -> dict:
    meta = {"nombre": nombre, "cuerpo": "marte", "pixel_m": PIXEL_M, "x0_m": extra["x0_m"], "y0_m": extra["y0_m"],
            "proyeccion": {"tipo": "azimutal_equidistante_local", "lat_centro_deg": SITIO["lat_deg"],
                           "lon_centro_deg": SITIO["lon_deg"], "radio_m": RADIO_M, "proj": extra["crs"]},
            "promediado": "USGS HRSC+MOLA blend (200 m, geográfica) -> azimutal equidistante local a 200 m, remuestreo por promedio",
            "resolucion_nativa": True, "sitio": SITIO,
            "fuentes": [{"id": fuente["id"], "sha256": fuente["sha256"], "url": fuente["url"], "version": fuente["version"]}],
            "uso": "Solo relieve 3D y renders; el motor físico no la lee.", "maqueta": False,
            "sin_dato_frac": round(float(np.isnan(z).mean()), 6)}
    GRILLAS.mkdir(parents=True, exist_ok=True)
    np.save(GRILLAS / f"{nombre}.npy", z.astype(np.float32), allow_pickle=False)
    (GRILLAS / f"{nombre}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return meta


def principal() -> None:
    from modelos.grilla_tierra import datos_proj_propios

    datos_proj_propios()
    z, t, crs_wkt, fuente = ventana()
    for nombre, lado in (("marte_jezero_200m", 30000.0), ("marte_jezero_amplio_200m", 70000.0)):
        g, extra = local(z, t, crs_wkt, lado)
        m = escribir(nombre, g, extra, fuente)
        print("GRILLA", nombre, g.shape, "min", float(np.nanmin(g)), "max", float(np.nanmax(g)), "sin dato", m["sin_dato_frac"])


if __name__ == "__main__":
    principal()
