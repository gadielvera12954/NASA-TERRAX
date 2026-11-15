"""Grillas de la Luna para el motor (LOLA y el mapa de iluminación de NASA, PGDA 90 y 69).

    python -m motor.ingest.lola          # escribe datos/grillas/mons_mouton_*.npy|json y datos/fuentes_pgda.json

Entrega las mismas cuatro grillas que `puente_lola/` (mismos nombres, misma grilla global de 60 m,
mismo contrato de esquemas/grilla_entrada.md), con una diferencia declarada en los metadatos:

* objetivo `mons_mouton_60m`: 500 x 500 celdas del producto LDEM_60S_60MPP_ADJ (60 m NATIVOS de
  LOLA), en vez del promedio de bloques 3 x 3 de LDEM_80S_20MPP_ADJ. Motivo: en esta máquina la
  lectura remota del archivo de 20 m (3,6 GB, TIFF por tiras) falla siempre en el mismo punto
  ("Cannot read offset/size for strile"), con y sin red estable. Ninguna de las dos opciones
  interpola: el producto de 60 m es la grilla de LOLA a esa resolución.
* margen cercano `mons_mouton_margen_60m`: el mismo producto, ±60 km.
* relieve lejano `mons_mouton_lejano_240m`: LDEM_60S_240MPP_ADJ, ±312 km (el documento 02 pide 300 km).
* iluminación `nasa_avgvisib_85s_60m`: AVGVISIB_85S_060M_201608 en la misma grilla del objetivo,
  visibilidad media = DN x 0,00004 (etiqueta PDS); -32768 = sin dato.

Si el producto de 20 m vuelve a leerse, `python -m puente_lola.bajar` sigue sirviendo.

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from __future__ import annotations

import datetime as dt
import json
import math

import numpy as np

from motor.horizonte.geometria import xy_desde_latlon_polar_sur
from motor.horizonte.grilla import escribir_grilla

from .remoto import DATOS, cabecera, entorno_gdal, sha

BASE = "https://pgda.gsfc.nasa.gov/data/"
R = 1737400.0
ESQUINA_GLOBAL = 931200.0            # esquina de LDEM_60S_*: múltiplo de 60 y de 240 m desde el polo
ESQUINA_AVGVISIB = 151740.0
FUENTES = {
    "ldem_60s_60m": "LOLA_20mpp/LDEM_60S_60MPP_ADJ.TIF",
    "ldem_60s_240m": "LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF",
    "avgvisib_85s_60m": "MoonIllumination/AVGVISIB_85S_060M_201608.TIF",
}
PROYECCION = {"tipo": "polar_estereografica_sur", "radio_m": R, "lon0_deg": 0.0}


def leer_ventana(url: str, fila0: int, col0: int, alto: int, ancho: int, bloque: int = 250,
                 intentos: int = 8) -> tuple[np.ndarray, dict]:
    """Lee la ventana por bloques de filas; si la conexión corta un bloque, se repite solo ese bloque."""
    import time

    import rasterio
    from rasterio.windows import Window

    partes, info = [], None
    for f in range(0, alto, bloque):
        h = min(bloque, alto - f)
        for intento in range(1, intentos + 1):
            try:
                with entorno_gdal():
                    with rasterio.open("/vsicurl/" + url) as ds:
                        relleno = np.nan if np.dtype(ds.dtypes[0]).kind == "f" else -32768
                        partes.append(ds.read(1, window=Window(col0, fila0 + f, ancho, h), boundless=True, fill_value=relleno))
                        info = {"pixel_m": float(ds.res[0]), "esquina": [float(ds.transform.c), float(ds.transform.f)]}
                break
            except Exception as err:
                if intento == intentos:
                    raise
                print(f"    bloque {f}-{f + h}: {err.__class__.__name__}, reintento {intento}", flush=True)
                time.sleep(5 * intento)
        print(f"    filas {f + h}/{alto}", flush=True)
    return np.concatenate(partes, axis=0), info


def principal(lat: float = -84.60, lon: float = 31.00, lado: int = 500, margen_km: float = 60.0,
              lejano_km: float = 312.0) -> dict:
    x, y = (float(v) for v in xy_desde_latlon_polar_sur(lat, lon, R, 0.0))
    J = int(math.floor((x + ESQUINA_GLOBAL) / 60.0))
    I = int(math.floor((ESQUINA_GLOBAL - y) / 60.0))
    c = (lado - 1) // 2
    I0, J0 = I - c, J - c                                     # celda [0, 0] del objetivo en la grilla global
    x0 = -ESQUINA_GLOBAL + 60.0 * J0 + 30.0
    y0 = ESQUINA_GLOBAL - 60.0 * I0 - 30.0
    prov = {"centro": {"lat": lat, "lon": lon, "x_m": x, "y_m": y},
            "bajado_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "fuentes": {k: {"url": BASE + v, **cabecera(BASE + v)} for k, v in FUENTES.items()}, "grillas": {},
            "nota": "objetivo desde LDEM_60S_60MPP (60 m nativos): el producto de 20 m no se pudo leer en remoto"}
    (DATOS / "grillas").mkdir(parents=True, exist_ok=True)

    def guardar(nombre, z, pixel, gx0, gy0, fuente, promediado):
        f = prov["fuentes"][fuente]
        meta = {"nombre": nombre, "cuerpo": "luna", "pixel_m": pixel, "x0_m": gx0, "y0_m": gy0, "proyeccion": PROYECCION,
                "promediado": promediado,
                "fuentes": [{"id": f"pgda_{FUENTES[fuente].rsplit('/', 1)[1].rsplit('.', 1)[0]}", "sha256": sha(z),
                             "url": f["url"], "version": f"{f.get('Last-Modified')} · ETag {f.get('ETag')}"}],
                "maqueta": False}
        escribir_grilla(DATOS / "grillas" / nombre, z, meta)
        prov["grillas"][nombre] = {"forma": list(z.shape), "pixel_m": pixel, "x0_m": gx0, "y0_m": gy0, "sha256": sha(z),
                                   "sin_dato_frac": float(np.isnan(z).mean())}
        print(f"  {nombre}: {z.shape[0]} x {z.shape[1]} a {pixel:.0f} m · {100 * np.isnan(z).mean():.2f} % sin dato · "
              f"altura de {np.nanmin(z):.0f} a {np.nanmax(z):.0f}", flush=True)

    m = int(round(margen_km * 1000 / 60.0))
    print("margen y objetivo: LDEM_60S_60MPP", flush=True)
    zm, info = leer_ventana(BASE + FUENTES["ldem_60s_60m"], I - m, J - m, 2 * m, 2 * m)
    assert info["pixel_m"] == 60.0 and info["esquina"] == [-ESQUINA_GLOBAL, ESQUINA_GLOBAL], info
    zm = zm.astype(np.float32)
    guardar("mons_mouton_margen_60m", zm, 60.0, -ESQUINA_GLOBAL + 60.0 * (J - m) + 30.0,
            ESQUINA_GLOBAL - 60.0 * (I - m) - 30.0, "ldem_60s_60m", "60 m nativos")
    df, dc = I0 - (I - m), J0 - (J - m)
    previo = DATOS / "grillas" / "mons_mouton_60m.json"
    meta_previa = json.loads(previo.read_text(encoding="utf-8")) if previo.exists() else None
    if meta_previa and "20MPP" in meta_previa["fuentes"][0]["id"] and meta_previa["x0_m"] == x0 and meta_previa["y0_m"] == y0:
        # Ya hay un objetivo promediado desde 20 m (lo que pide el documento 02) en la misma grilla: se conserva.
        prov["grillas"]["mons_mouton_60m"] = {"conservado": "promedio de bloques 3 x 3 de LDEM_80S_20MPP_ADJ",
                                              "sha256": meta_previa["fuentes"][0]["sha256"]}
        prov["nota"] = "objetivo promediado desde LDEM_80S_20MPP (bajado por puente_lola); margen, lejano e iluminación por motor/ingest/lola.py"
        print("  mons_mouton_60m: se conserva el objetivo promediado desde 20 m", flush=True)
    else:
        guardar("mons_mouton_60m", zm[df:df + lado, dc:dc + lado].copy(), 60.0, x0, y0, "ldem_60s_60m",
                "60 m nativos de LDEM_60S_60MPP (sin promediar ni interpolar); ver motor/ingest/lola.py")

    print("lejano: LDEM_60S_240MPP", flush=True)
    I4, J4 = int(math.floor((ESQUINA_GLOBAL - y) / 240.0)), int(math.floor((x + ESQUINA_GLOBAL) / 240.0))
    n = int(round(lejano_km * 1000 / 240.0))
    zl, info = leer_ventana(BASE + FUENTES["ldem_60s_240m"], I4 - n, J4 - n, 2 * n, 2 * n)
    assert info["pixel_m"] == 240.0, info
    guardar("mons_mouton_lejano_240m", zl.astype(np.float32), 240.0, -ESQUINA_GLOBAL + 240.0 * (J4 - n) + 120.0,
            ESQUINA_GLOBAL - 240.0 * (I4 - n) - 120.0, "ldem_60s_240m", "240 m nativos")

    print("iluminación: AVGVISIB_85S_060M", flush=True)
    off = int(round((ESQUINA_GLOBAL - ESQUINA_AVGVISIB) / 60.0))
    dn, info = leer_ventana(BASE + FUENTES["avgvisib_85s_60m"], I0 - off, J0 - off, lado, lado)
    assert info["pixel_m"] == 60.0 and info["esquina"] == [-ESQUINA_AVGVISIB, ESQUINA_AVGVISIB], info
    vis = np.where(dn == -32768, np.nan, dn.astype(np.float64) * 0.00004).astype(np.float32)
    guardar("nasa_avgvisib_85s_60m", vis, 60.0, x0, y0, "avgvisib_85s_60m", "valores de NASA sin cambiar (DN x 0,00004)")

    (DATOS / "fuentes_pgda.json").write_text(json.dumps(prov, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"escrito {DATOS / 'fuentes_pgda.json'}", flush=True)
    return prov


if __name__ == "__main__":
    principal()
