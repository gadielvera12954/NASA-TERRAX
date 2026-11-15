"""TERRA-X · grilla terrestre para el relieve 3D de "Dos mundos" (Payunia, alrededor de P-27).

    .venv\\Scripts\\python.exe -m modelos.grilla_tierra

Arma `datos/grillas/payunia_p27_60m.{npy,json}`: 30 x 30 km a 60 m (500 x 500 píxeles), la misma
extensión y el mismo píxel que `mons_mouton_60m`, para que las dos superficies se vean a la misma
escala horizontal en el 3D.

No agrega ciencia nueva: reutiliza la cadena de la Parte 4 tal cual
(`motor.huella.__main__.grilla_tierra` -> `motor.ingest.copernicus` -> `motor.escala.reproyectar`):
Copernicus GLO-30 (1 segundo de arco) llevado a UTM 19S a 60 m con remuestreo por PROMEDIO (nunca
interpola hacia una malla más fina). El centro es la primera candidata real del ranking publicado
(`web/public/data/fichas/indice.json`, hoy P-27); el script lo lee de ahí, no lo escribe a mano.

Necesita rasterio y pyproj (ver THIRD_PARTY_NOTICES.md) y conexión la primera vez (la tesela
S37_W070 pesa ~39 MB y queda en datos/crudos/copernicus/).

Uso de SI: redactado con Claude Code para la Parte de Jean (terreno terrestre 3D).
"""
from __future__ import annotations

import json
import pathlib

import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parents[1]
INDICE = RAIZ / "web" / "public" / "data" / "fichas" / "indice.json"
NOMBRE = "payunia_p27_60m"
LADO_M = 30000.0                 # igual que el recorte de Mons Mouton (500 x 500 a 60 m)
# Grilla amplia, solo para el horizonte de los renders de modelos/renders.py (no entra al motor):
# 70 km entran en la tesela S37_W070 alrededor de P-27 (el borde este queda a ~37 km).
NOMBRE_AMPLIO = "payunia_p27_amplio_60m"
LADO_AMPLIO_M = 69960.0          # 1166 x 1166 a 60 m


def candidata_principal() -> dict:
    """La primera candidata real (no control) del ranking publicado."""
    d = json.loads(INDICE.read_text(encoding="utf-8"))
    reales = [c for c in d["candidatas"] if not c.get("control") and isinstance(c.get("orden"), int)]
    return min(reales, key=lambda c: c["orden"])


def datos_proj_propios() -> None:
    """Usa la base PROJ/GDAL que trae la rueda de rasterio.

    Otras instalaciones (por ejemplo PostGIS) dejan PROJ_LIB y GDAL_DATA apuntando a una proj.db de
    otra versión y la reproyección falla con "EPSG code is unknown".
    """
    import importlib.util
    import os

    spec = importlib.util.find_spec("rasterio")
    if spec is None or not spec.origin:
        return
    base = pathlib.Path(spec.origin).parent
    if (base / "proj_data").is_dir():
        os.environ["PROJ_DATA"] = os.environ["PROJ_LIB"] = str(base / "proj_data")
    if (base / "gdal_data").is_dir():
        os.environ["GDAL_DATA"] = str(base / "gdal_data")


def principal() -> dict:
    datos_proj_propios()
    from pyproj import Transformer

    from motor.horizonte.grilla import escribir_grilla
    from motor.huella.__main__ import grilla_tierra
    from motor.ingest import copernicus

    c = candidata_principal()
    lat, lon = float(c["lugar"]["lat"]), float(c["lugar"]["lon"])
    tesela = copernicus.tesela_de(lat, lon)
    capa, meta, _ = grilla_tierra(NOMBRE, [tesela], lat, lon, LADO_M)
    a_grilla = Transformer.from_crs("EPSG:4326", f"EPSG:{capa.epsg}", always_xy=True)

    def celda(la: float, lo: float) -> tuple[float, float]:
        x, y = a_grilla.transform(lo, la)
        return (meta["y0_m"] - y) / meta["pixel_m"], (x - meta["x0_m"]) / meta["pixel_m"]

    # Dónde cae el centro de la candidata dentro de la grilla (para marcarla en el 3D).
    fila, col = celda(lat, lon)
    meta["epsg"] = int(capa.epsg)
    meta["candidata"] = {"id": c["id"], "nombre": c["nombre"], "lat_deg": lat, "lon_deg": lon,
                         "fila": round(float(fila), 2), "col": round(float(col), 2),
                         "parcela_km": 3.0, "fuente": "web/public/data/fichas/indice.json"}
    # Todas las parcelas del ranking cuyo cuadrado de 3 x 3 km entra entero en el recorte.
    medio = 1500.0 / meta["pixel_m"]
    parcelas = []
    indice = json.loads(INDICE.read_text(encoding="utf-8"))
    for p in indice["candidatas"]:
        if p.get("control") or "lugar" not in p:
            continue
        f, k = celda(float(p["lugar"]["lat"]), float(p["lugar"]["lon"]))
        if medio <= f <= capa.alto - 1 - medio and medio <= k <= capa.ancho - 1 - medio:
            parcelas.append({"id": p["id"], "fila": round(float(f), 2), "col": round(float(k), 2),
                             "etiqueta": p.get("etiqueta"), "orden": p.get("orden")})
    meta["parcelas"] = sorted(parcelas, key=lambda p: (p["orden"] is None, p["orden"] or 0, p["id"]))
    meta["sin_dato_frac"] = round(float(np.isnan(capa.z).mean()), 6)
    escribir_grilla(RAIZ / "datos" / "grillas" / NOMBRE, capa.z, meta)

    amplia, meta_a, _ = grilla_tierra(NOMBRE_AMPLIO, [tesela], lat, lon, LADO_AMPLIO_M)
    meta_a["uso"] = "Solo horizonte de los renders (modelos/renders.py); el motor no la lee."
    meta_a["sin_dato_frac"] = round(float(np.isnan(amplia.z).mean()), 6)
    escribir_grilla(RAIZ / "datos" / "grillas" / NOMBRE_AMPLIO, amplia.z, meta_a)
    print("GRILLA LISTA:", json.dumps({"nombre": NOMBRE, "forma": list(capa.z.shape), "candidata": meta["candidata"],
                                       "parcelas": [p["id"] for p in meta["parcelas"]],
                                       "sin_dato_frac": meta["sin_dato_frac"],
                                       "amplia": {"forma": list(amplia.z.shape), "sin_dato_frac": meta_a["sin_dato_frac"]}},
                                      ensure_ascii=False))
    return meta


if __name__ == "__main__":
    principal()
