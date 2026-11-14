"""PUENTE TEMPORAL: baja de PGDA los recortes de LOLA y el mapa de iluminación de NASA para Mons Mouton.

No reemplaza a motor/ingest ni a motor/escala (dueño: Mathias). Existe para que el motor físico pueda
correr con datos reales mientras esos módulos no estén; entrega exactamente el contrato de
esquemas/grilla_entrada.md, así que se puede tirar en cuanto Mathias entregue sus grillas.

    python -m puente_lola.bajar            # escribe datos/grillas/*.npy|json y datos/fuentes_pgda.json

Qué baja (solo las ventanas necesarias, por rangos HTTP sobre los GeoTIFF de PGDA):
  * objetivo: LDEM_80S_20MPP_ADJ (20 m), 1.500 × 1.500 píxeles promediados en bloques de 3 × 3 →
    500 × 500 a 60 m (30 × 30 km) centrados en Mons Mouton. Los bloques se alinean con la grilla
    global de 60 m (múltiplos de 60 m desde el polo), la misma de LDEM_60S_60MPP y de AVGVISIB_85S_060M.
  * margen cercano: LDEM_60S_60MPP_ADJ (60 m nativos), ±60 km.
  * relieve lejano: LDEM_60S_240MPP_ADJ (240 m nativos), ±312 km (el documento 02 pide hasta 300 km).
  * resolución efectiva: LDEM_80S_20MPP_ADJ_EFFRES en la ventana del objetivo (doc02 §2.3: ≤ 60 m).
  * iluminación de NASA: AVGVISIB_85S_060M_201608 (PGDA 69), misma grilla que el objetivo.
    Visibilidad media del disco = DN × 0,00004 (etiqueta PDS); fuera de su cobertura queda NaN.

Nunca se interpola: el objetivo es un promedio de bloques enteros y el resto se usa en su
resolución nativa.

Uso de SI: redactado con Claude Code a pedido de quien lidera el equipo, el sábado 14/11/2026.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import pathlib
import urllib.request
import warnings

import numpy as np
import rasterio
from rasterio.env import Env
from rasterio.windows import Window

from motor.horizonte.geometria import xy_desde_latlon_polar_sur
from motor.horizonte.grilla import escribir_grilla

RAIZ = pathlib.Path(__file__).resolve().parents[1]
DATOS = RAIZ / "datos"
BASE = "https://pgda.gsfc.nasa.gov/data/"
AGENTE = "terra-x-motor (NASA Space Apps 2026)"
R = 1737400.0
ESQUINA_GLOBAL = 931200.0           # esquina de LDEM_60S_*: múltiplo de 60 y de 240 m desde el polo
FUENTES = {
    "ldem_80s_20m": "LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
    "ldem_80s_20m_effres": "LOLA_20mpp/LDEM_80S_20MPP_ADJ_EFFRES.TIF",
    "ldem_60s_60m": "LOLA_20mpp/LDEM_60S_60MPP_ADJ.TIF",
    "ldem_60s_240m": "LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF",
    "avgvisib_85s_60m": "MoonIllumination/AVGVISIB_85S_060M_201608.TIF",
}
PROYECCION = {"tipo": "polar_estereografica_sur", "radio_m": R, "lon0_deg": 0.0}


def cabecera_http(url: str) -> dict:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(req, timeout=60) as r:
        return {k: r.headers.get(k) for k in ("Content-Length", "ETag", "Last-Modified")}


def leer_ventana(url: str, fila0: int, col0: int, alto: int, ancho: int) -> tuple[np.ndarray, dict]:
    with Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF", GDAL_HTTP_USERAGENT=AGENTE,
             GDAL_HTTP_MAX_RETRY="8", GDAL_HTTP_RETRY_DELAY="2", VSI_CACHE="TRUE", GDAL_HTTP_MULTIRANGE="SINGLE_GET", GDAL_HTTP_TIMEOUT="600"):
        with rasterio.open("/vsicurl/" + url) as ds:
            relleno = np.nan if np.dtype(ds.dtypes[0]).kind == "f" else -32768
            a = ds.read(1, window=Window(col0, fila0, ancho, alto), boundless=True, fill_value=relleno)
            info = {"ancho_total": ds.width, "alto_total": ds.height, "pixel_m": float(ds.res[0]),
                    "esquina": [float(ds.transform.c), float(ds.transform.f)], "crs": ds.crs.to_wkt()[:200] if ds.crs else None,
                    "dtype": ds.dtypes[0], "nodata": ds.nodata}
    return a, info


def sha(a: np.ndarray) -> str:
    return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()


def principal(lat: float = -84.60, lon: float = 31.00, lado: int = 500, margen_km: float = 60.0, lejano_km: float = 312.0,
              con_effres: bool = False) -> dict:
    x, y = (float(v) for v in xy_desde_latlon_polar_sur(lat, lon, R, 0.0))
    J = int(math.floor((x + ESQUINA_GLOBAL) / 60.0))
    I = int(math.floor((ESQUINA_GLOBAL - y) / 60.0))
    c = (lado - 1) // 2
    I0, J0 = I - c, J - c                                   # celda [0, 0] del objetivo en la grilla global de 60 m
    x0 = -ESQUINA_GLOBAL + 60.0 * J0 + 30.0                 # centro de la celda [0, 0]
    y0 = ESQUINA_GLOBAL - 60.0 * I0 - 30.0
    prov = {"centro": {"lat": lat, "lon": lon, "x_m": x, "y_m": y}, "bajado_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "fuentes": {}, "grillas": {}}
    for k, rel in FUENTES.items():
        prov["fuentes"][k] = {"url": BASE + rel, **cabecera_http(BASE + rel)}
    (DATOS / "grillas").mkdir(parents=True, exist_ok=True)

    def guardar(nombre, z, pixel, gx0, gy0, fuente, promediado):
        meta = {"nombre": nombre, "cuerpo": "luna", "pixel_m": pixel, "x0_m": gx0, "y0_m": gy0, "proyeccion": PROYECCION,
                "promediado": promediado,
                "fuentes": [{"id": f"pgda_{pathlib.Path(FUENTES[fuente]).stem}", "sha256": sha(z), "url": BASE + FUENTES[fuente],
                             "version": f"{prov['fuentes'][fuente].get('Last-Modified')} · ETag {prov['fuentes'][fuente].get('ETag')}"}],
                "maqueta": False}
        escribir_grilla(DATOS / "grillas" / nombre, z, meta)
        prov["grillas"][nombre] = {"forma": list(z.shape), "pixel_m": pixel, "x0_m": gx0, "y0_m": gy0, "sha256": sha(z),
                                   "sin_dato_frac": float(np.isnan(z).mean()), "min": float(np.nanmin(z)), "max": float(np.nanmax(z))}
        print(f"  {nombre}: {z.shape[0]}×{z.shape[1]} a {pixel:.0f} m · {100 * np.isnan(z).mean():.2f} % sin dato · "
              f"altura de {np.nanmin(z):.0f} a {np.nanmax(z):.0f}")

    def ya_bajada(nombre):
        """Si la grilla ya se bajó en una corrida anterior, se reutiliza (el servidor puede ser lento)."""
        ruta = DATOS / "grillas" / f"{nombre}.npy"
        if not ruta.exists():
            return False
        z = np.load(ruta)
        m = json.loads(ruta.with_suffix(".json").read_text(encoding="utf-8"))
        prov["grillas"][nombre] = {"forma": list(z.shape), "pixel_m": m["pixel_m"], "x0_m": m["x0_m"], "y0_m": m["y0_m"], "sha256": sha(z),
                                   "sin_dato_frac": float(np.isnan(z).mean()), "min": float(np.nanmin(z)), "max": float(np.nanmax(z)),
                                   "reutilizada": True}
        print(f"  {nombre}: ya estaba bajada, se reutiliza")
        return True

    # 1. Objetivo: 20 m → bloques de 3 × 3 → 60 m. Fila/col del producto de 20 m (esquina −304.000 m).
    r0, c0 = 3 * I0 - 31360, 3 * J0 - 31360
    print(f"objetivo: LDEM_80S_20MPP, ventana de {3 * lado} × {3 * lado} desde ({r0}, {c0})")
    if not ya_bajada("mons_mouton_60m"):
        _objetivo(r0, c0, lado, x0, y0, prov, guardar)

    # 3. Margen cercano a 60 m nativos.
    m = int(round(margen_km * 1000 / 60.0))
    if not ya_bajada("mons_mouton_margen_60m"):
        print("margen: LDEM_60S_60MPP")
        zm, info = leer_ventana(BASE + FUENTES["ldem_60s_60m"], I - m, J - m, 2 * m, 2 * m)
        assert info["pixel_m"] == 60.0 and info["esquina"] == [-ESQUINA_GLOBAL, ESQUINA_GLOBAL], info
        guardar("mons_mouton_margen_60m", zm.astype(np.float32), 60.0, -ESQUINA_GLOBAL + 60.0 * (J - m) + 30.0,
                ESQUINA_GLOBAL - 60.0 * (I - m) - 30.0, "ldem_60s_60m", "60 m nativos")

    # 4. Relieve lejano a 240 m nativos.
    I4, J4 = int(math.floor((ESQUINA_GLOBAL - y) / 240.0)), int(math.floor((x + ESQUINA_GLOBAL) / 240.0))
    n = int(round(lejano_km * 1000 / 240.0))
    if not ya_bajada("mons_mouton_lejano_240m"):
        print("lejano: LDEM_60S_240MPP")
        zl, info = leer_ventana(BASE + FUENTES["ldem_60s_240m"], I4 - n, J4 - n, 2 * n, 2 * n)
        assert info["pixel_m"] == 240.0, info
        guardar("mons_mouton_lejano_240m", zl.astype(np.float32), 240.0, -ESQUINA_GLOBAL + 240.0 * (J4 - n) + 120.0,
                ESQUINA_GLOBAL - 240.0 * (I4 - n) - 120.0, "ldem_60s_240m", "240 m nativos")

    # 5. Iluminación de NASA (PGDA 69, 60 m, esquina −151.740 m) en la misma grilla que el objetivo.
    off = int(round((ESQUINA_GLOBAL - 151740.0) / 60.0))
    if not ya_bajada("nasa_avgvisib_85s_60m"):
        print("iluminación: AVGVISIB_85S_060M")
        dn, info = leer_ventana(BASE + FUENTES["avgvisib_85s_60m"], I0 - off, J0 - off, lado, lado)
        assert info["pixel_m"] == 60.0 and info["esquina"] == [-151740.0, 151740.0], info
        vis = np.where(dn == -32768, np.nan, dn.astype(np.float64) * 0.00004).astype(np.float32)
        guardar("nasa_avgvisib_85s_60m", vis, 60.0, x0, y0, "avgvisib_85s_60m", "valores de NASA sin cambiar (DN × 0,00004)")

    if con_effres:
        _effres(r0, c0, lado, prov)
    else:
        prov["resolucion_efectiva_m"] = "sin comprobar: correr python -m puente_lola.bajar --effres (archivo de 4 GB)"

    (DATOS / "fuentes_pgda.json").write_text(json.dumps(prov, ensure_ascii=False, indent=1) + chr(10), encoding="utf-8")
    print(f"escrito {DATOS / 'fuentes_pgda.json'}")
    return prov


def _objetivo(r0, c0, lado, x0, y0, prov, guardar):
    z20, info = leer_ventana(BASE + FUENTES["ldem_80s_20m"], r0, c0, 3 * lado, 3 * lado)
    assert info["pixel_m"] == 20.0 and info["esquina"] == [-304000.0, 304000.0], info
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        bloques = z20.astype(np.float64).reshape(lado, 3, lado, 3)
        z60 = np.nanmean(bloques, axis=(1, 3))
        validos = np.isfinite(bloques).sum(axis=(1, 3))
    # Un bloque con algún píxel sin dato queda con el promedio de los válidos (sin inventar nada) y se cuenta.
    prov["objetivo_bloques_incompletos"] = int(((validos > 0) & (validos < 9)).sum())
    guardar("mons_mouton_60m", z60.astype(np.float32), 60.0, x0, y0, "ldem_80s_20m", "promedio de bloques de 3 × 3 píxeles de 20 m (sin interpolar)")



def _effres(r0, c0, lado, prov):
    # 2. Resolución efectiva en la ventana del objetivo (doc02 §2.3: tiene que ser ≤ 60 m).
    try:
        ef, info = leer_ventana(BASE + FUENTES["ldem_80s_20m_effres"], r0, c0, 3 * lado, 3 * lado)
    except Exception as err:
        ef, info = np.array([]), {"pixel_m": 20.0, "esquina": [-304000.0, 304000.0], "error": str(err)}
    if info["pixel_m"] != 20.0 or info["esquina"] != [-304000.0, 304000.0]:
        raise SystemExit(f"EFFRES no está en la grilla del objetivo: {info}")
    ef = ef[np.isfinite(ef) & (ef > 0)]
    prov["resolucion_efectiva_m"] = {"mediana": float(np.median(ef)), "p95": float(np.percentile(ef, 95)), "max": float(ef.max()),
                                     "frac_hasta_60m": float((ef <= 60.0).mean())} if ef.size else None
    print(f"  resolución efectiva en el recorte: {prov['resolucion_efectiva_m']}")



if __name__ == "__main__":
    import sys
    principal(con_effres="--effres" in sys.argv)
