"""NDVI percentil 90 anual (requisito de vegetación baja, documento 02) con Sentinel-2 L2A.

Fuente: colección `sentinel-2-l2a` de Earth Search (Element 84) sobre AWS Open Data, sin cuenta.
El documento 02 prefería HLS V002 (NASA), que pide Earthdata Login; HLS armoniza justamente
Landsat y Sentinel-2, así que este es el mismo sensor sin la armonización. Se declara en la salida.

Cómo se calcula, sin inventar datos:
1. Se buscan las escenas de un año con menos de `nubes_max` % de nubes.
2. Por mes y por tesela MGRS se elige la escena con menos nubes (una muestra mensual, ver
   documento de análisis: cientos de escenas no entran en 39 horas).
3. Cada banda (roja B04, infrarroja B08) se lee desde la vista reducida del COG más fina que 60 m
   (40 m) y se lleva a la grilla UTM de 60 m con PROMEDIO.
   Reflectancia = DN · escala + desplazamiento (metadatos `raster:bands` de cada escena; desde la
   versión de procesamiento 04.00, ESA suma 1.000 al DN y el desplazamiento es −0,1, salvo que
   Element 84 ya lo haya quitado: `earthsearch:boa_offset_applied`, ver `_escala`).
4. NDVI = (NIR − R) / (NIR + R) por mes; percentil 90 a lo largo de los meses.
   Un píxel con menos de `meses_min` meses válidos queda sin dato.
Las nubes bajan el NDVI, así que el percentil 90 es poco sensible a las que queden.

Uso de SI: redactado con Claude Code para la Parte 4.
"""
from __future__ import annotations

import collections

import numpy as np

from .remoto import entorno_gdal, post_json, sha

STAC = "https://earth-search.aws.element84.com/v1/search"
# En estos COG los bloques de la vista de 40 m no están contiguos en el archivo: con SINGLE_GET, GDAL
# pedía de una sola vez desde el primer bloque hasta el último (casi el archivo entero). PARALLEL pide
# solo los rangos de los bloques necesarios.
GDAL_S2 = {"GDAL_HTTP_MULTIRANGE": "PARALLEL"}


def buscar(bbox_lonlat, desde: str, hasta: str, nubes_max: float = 10.0, limite: int = 500) -> list[dict]:
    cuerpo = {"collections": ["sentinel-2-l2a"], "bbox": list(bbox_lonlat),
              "datetime": f"{desde}T00:00:00Z/{hasta}T23:59:59Z",
              "query": {"eo:cloud_cover": {"lt": nubes_max}}, "limit": 100}
    items: list[dict] = []
    while cuerpo and len(items) < limite:
        r = post_json(STAC, cuerpo)
        items += r.get("features", [])
        sig = next((l for l in r.get("links", []) if l.get("rel") == "next"), None)
        cuerpo = {**cuerpo, **sig["body"]} if sig and sig.get("body") else None
    return items


def _tesela(item: dict) -> str:
    p = item["properties"]
    return str(p.get("grid:code") or p.get("s2:mgrs_tile") or item["id"].split("_")[1])


def elegir_por_mes(items: list[dict]) -> dict[str, list[dict]]:
    """Mes 'AAAA-MM' -> lista con la escena de menos nubes de cada tesela MGRS."""
    mejor: dict[tuple[str, str], dict] = {}
    for it in items:
        clave = (it["properties"]["datetime"][:7], _tesela(it))
        if clave not in mejor or it["properties"]["eo:cloud_cover"] < mejor[clave]["properties"]["eo:cloud_cover"]:
            mejor[clave] = it
    meses: dict[str, list[dict]] = collections.defaultdict(list)
    for (mes, _), it in sorted(mejor.items()):
        meses[mes].append(it)
    return dict(meses)


def _escala(item: dict, banda: str) -> tuple[float, float]:
    """(escala, desplazamiento) para pasar DN a reflectancia.

    `earthsearch:boa_offset_applied = True` quiere decir que Element 84 ya quitó los +1.000 DN de ESA
    en los píxeles, aunque `raster:bands` siga diciendo −0,1. Comprobado en S2C_20KPC_20260126 (Chaco,
    enero): el rojo medio es 433 DN y casi todo está por debajo de 1.000, imposible si los +1.000
    siguieran ahí; restar 0,1 daría reflectancias negativas. En ese caso el desplazamiento es 0.
    """
    asset = item["assets"][banda]
    rb = (asset.get("raster:bands") or [{}])[0]
    p = item["properties"]
    escala = float(rb.get("scale", 1e-4))
    if p.get("earthsearch:boa_offset_applied", False):
        return escala, 0.0
    if "offset" in rb:
        return escala, float(rb["offset"])
    base = p.get("s2:processing_baseline")
    return escala, (-0.1 if base is not None and float(base) >= 4.0 else 0.0)


def _nivel_vista(href: str, px_objetivo: float) -> int | None:
    """Vista reducida (overview) más gruesa que siga siendo más FINA que la grilla de destino.

    Leer la vista de 40 m en vez de la banda de 10 m baja ~16 veces menos datos; como 40 m < 60 m,
    el paso final sigue siendo un promedio hacia una malla más gruesa (nunca se interpola hacia abajo).
    """
    import rasterio

    with rasterio.open("/vsicurl/" + href) as ds:
        res = float(ds.res[0])
        factores = ds.overviews(1)
    nivel = None
    for i, f in enumerate(factores):
        if res * f < px_objetivo:
            nivel = i
    return nivel


def _leer_en_grilla(href: str, grilla: dict) -> np.ndarray:
    """Lee SOLO la ventana de la vista reducida que cubre la grilla y la promedia a 60 m.

    Se lee la ventana a mano (una sola lectura de los bloques necesarios) y después se reproyecta en
    memoria: el reproyector de GDAL sobre /vsicurl/ terminaba pidiendo la banda de 10 m entera.
    """
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import from_origin
    from rasterio.warp import reproject, transform_bounds
    from rasterio.windows import from_bounds

    px = grilla["pixel_m"]
    t = from_origin(grilla["x0_m"] - px / 2.0, grilla["y0_m"] + px / 2.0, px, px)
    destino_crs = f"EPSG:{grilla['epsg']}"
    izq, arr = grilla["x0_m"] - px / 2.0, grilla["y0_m"] + px / 2.0
    der, aba = izq + grilla["ancho"] * px, arr - grilla["alto"] * px
    out = np.full((grilla["alto"], grilla["ancho"]), np.nan, dtype=np.float32)
    nivel = _nivel_vista(href, px)
    abrir = {} if nivel is None else {"overview_level": nivel}
    with rasterio.open("/vsicurl/" + href, **abrir) as src:
        b = transform_bounds(destino_crs, src.crs, izq, aba, der, arr, densify_pts=21)
        w = from_bounds(*b, transform=src.transform)
        f0, c0 = max(0, int(np.floor(w.row_off)) - 2), max(0, int(np.floor(w.col_off)) - 2)
        f1 = min(src.height, int(np.ceil(w.row_off + w.height)) + 2)
        c1 = min(src.width, int(np.ceil(w.col_off + w.width)) + 2)
        if f1 <= f0 or c1 <= c0:                                  # la escena no toca la grilla
            return out
        ventana = rasterio.windows.Window(c0, f0, c1 - c0, f1 - f0)
        a = src.read(1, window=ventana).astype(np.float32)
        a[a == 0] = np.nan                                        # 0 = sin dato en Sentinel-2 L2A
        reproject(a, out, src_transform=src.window_transform(ventana), src_crs=src.crs, src_nodata=np.nan,
                  dst_transform=t, dst_crs=destino_crs, dst_nodata=np.nan, resampling=Resampling.average)
    return out


def ndvi_p90(grilla: dict, bbox_lonlat, desde: str, hasta: str, nubes_max: float = 10.0, meses_min: int = 4,
             informar=print, hilos: int = 6) -> tuple[np.ndarray, dict]:
    """NDVI percentil 90 en la grilla pedida (dict con epsg, x0_m, y0_m, pixel_m, alto, ancho)."""
    items = buscar(bbox_lonlat, desde, hasta, nubes_max)
    meses = elegir_por_mes(items)
    if informar:
        informar(f"  Sentinel-2: {len(items)} escenas con < {nubes_max:.0f} % de nubes; {len(meses)} meses")
    import concurrent.futures as cf

    def leer_escena(it):
        """Las dos bandas de una escena en la grilla (o None si no se pudo leer: no se inventa)."""
        try:
            with entorno_gdal(**GDAL_S2):
                s, o = _escala(it, "red")
                r = _leer_en_grilla(it["assets"]["red"]["href"], grilla) * s + o
                s, o = _escala(it, "nir")
                n = _leer_en_grilla(it["assets"]["nir"]["href"], grilla) * s + o
            if informar:
                informar(f"    {it['id']}: leída")
            return r, n
        except Exception as err:
            if informar:
                informar(f"    {it['id']}: no se pudo leer ({err.__class__.__name__}); se omite")
            return None

    # Lecturas en paralelo: con una red de mucha demora por pedido, leer de a una es lo que más tarda.
    todas = [it for lista in meses.values() for it in lista]
    with cf.ThreadPoolExecutor(max_workers=hilos) as pool:
        leidas = dict(zip((it["id"] for it in todas), pool.map(leer_escena, todas)))

    capas, usadas = [], []
    for mes, lista in meses.items():
        rojo = np.full((grilla["alto"], grilla["ancho"]), np.nan, dtype=np.float32)
        nir = rojo.copy()
        for it in lista:
            par = leidas.get(it["id"])
            if par is None:
                continue
            r, n = par
            hueco = np.isnan(rojo) & np.isfinite(r) & np.isfinite(n)
            rojo[hueco], nir[hueco] = r[hueco], n[hueco]
            usadas.append({"id": it["id"], "fecha": it["properties"]["datetime"][:10],
                           "nubes_pct": round(float(it["properties"]["eo:cloud_cover"]), 2)})
        with np.errstate(invalid="ignore", divide="ignore"):
            suma = nir + rojo
            ndvi = np.where(suma > 0, (nir - rojo) / suma, np.nan).astype(np.float32)
        capas.append(ndvi)
        if informar:
            informar(f"    {mes}: {len(lista)} escena(s), {100 * np.isfinite(ndvi).mean():.0f} % de la grilla con dato")
    if not capas:
        return np.full((grilla["alto"], grilla["ancho"]), np.nan, dtype=np.float32), {"escenas": [], "meses": 0}
    pila = np.stack(capas)
    validos = np.isfinite(pila).sum(axis=0)
    with np.errstate(invalid="ignore"):
        p90 = np.nanpercentile(pila, 90, axis=0).astype(np.float32)
    p90[validos < meses_min] = np.nan
    prov = {"id": "sentinel2_l2a_ndvi_p90", "coleccion": "earth-search sentinel-2-l2a", "desde": desde, "hasta": hasta,
            "nubes_max_pct": nubes_max, "meses": len(capas), "meses_min": meses_min, "escenas": usadas, "sha256": sha(p90)}
    return p90, prov
