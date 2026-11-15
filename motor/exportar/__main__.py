"""Copia las salidas del motor a web/public/data y escribe manifest.json con versión y SHA-256 de todo.

    python -m motor.exportar                # copia salida/ y datos de la Parte 4, rehace manifest.json
    python -m motor.exportar --solo-manifest

Formato de manifest.json: el mismo que lee la web (web/src/datos/integration.ts): proyecto, version,
fecha, maqueta, fuentes [{id, licencia, sha256, ...}] y archivos [{archivo, bytes, sha256, maqueta}].
Se agrega `partes`, con el manifiesto de la Parte 3 integrado y el resumen de la Parte 4.

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import pathlib
import shutil

import parametros

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "salida"
DATOS = RAIZ / "datos"
WEB = RAIZ / "web" / "public" / "data"
UTC = dt.timezone.utc

LIC_NASA = "NASA Open Data"
LIC_COPERNICUS = ("Copernicus DEM GLO-30 licence: free use; modified data must carry the attribution notice set in the "
                  "licence ('Produced using Copernicus WorldDEM-30 © DLR e.V. …'). Full text: https://documentation."
                  "dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf")
LIC_SENTINEL = "Copernicus Sentinel data (free, full and open; attribution: contains modified Copernicus Sentinel data)"


def sha_archivo(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def leer(p: pathlib.Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def copiar() -> list[pathlib.Path]:
    copiados = []
    if SALIDA.exists():
        for p in sorted(SALIDA.rglob("*")):
            rel = p.relative_to(SALIDA)
            if p.is_file() and rel.parts[0] != "maqueta" and not p.name.startswith("_"):
                d = WEB / rel
                d.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, d)
                copiados.append(d)
    for n in ("verano", "invierno"):
        f = RAIZ / "informe" / "figuras" / f"refugios_{n}.png"
        if f.exists():
            (WEB / "destino").mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, WEB / "destino" / f"vista_refugios_{n}.png")
            copiados.append(WEB / "destino" / f"vista_refugios_{n}.png")
    dist = DATOS / "distribuciones_payunia.json"
    if dist.exists():
        (WEB / "huella").mkdir(parents=True, exist_ok=True)
        shutil.copy2(dist, WEB / "huella" / dist.name)
        copiados.append(WEB / "huella" / dist.name)
    return copiados


def fuentes_parte3() -> list[dict]:
    salida = [{"id": "JPL Horizons API v1.2", "entidad": "NASA JPL Solar System Dynamics",
               "coordenadas": "Mons Mouton (84.60°S, 31.00°E), IM-2, rim points; Ciudad del Este, Payunia, Puna",
               "resolucion": "2 h (Moon 2027-2028) and 1 min (Earth, Nov 14-15, 2026)", "licencia": LIC_NASA, "sha256": None}]
    try:
        from motor.sol import efemerides
        for k in efemerides.huellas():
            salida.append({"id": k["id"].replace("naif_", "NAIF kernel "), "entidad": "NASA JPL NAIF (used by Skyfield)",
                           "coordenadas": "DE421 ephemeris and lunar MOON_ME frame", "resolucion": "—",
                           "licencia": LIC_NASA, "sha256": k["sha256"]})
    except Exception:                                     # sin kernels bajados no se inventa su huella
        pass
    return salida


def fuentes_luna() -> list[dict]:
    prov = leer(DATOS / "fuentes_pgda.json")
    if not prov:
        return []
    salida = []
    for nombre in ("mons_mouton_60m", "mons_mouton_margen_60m", "mons_mouton_lejano_240m", "nasa_avgvisib_85s_60m"):
        meta = leer(DATOS / "grillas" / f"{nombre}.json")
        if not meta:
            continue
        f = meta["fuentes"][0]
        salida.append({"id": f"{f['id'].replace('pgda_', '')} -> {nombre}", "entidad": "NASA GSFC PGDA (LOLA team; illumination: Mazarico et al.)",
                       "coordenadas": "Mons Mouton, lunar south pole", "resolucion": meta.get("promediado", ""),
                       "version": f.get("version", ""), "licencia": f"{LIC_NASA} (cite Barker et al. 2023; Mazarico et al. 2011)",
                       "sha256": f["sha256"]})
    return salida


def fuentes_tierra() -> list[dict]:
    salida = []
    for p in sorted((DATOS / "crudos" / "copernicus").glob("*.json")):
        m = leer(p)
        salida.append({"id": m["id"], "entidad": "European Union / ESA (Copernicus DEM GLO-30, AWS Open Data)",
                       "coordenadas": p.stem.replace("Copernicus_DSM_COG_10_", "").replace("_DEM", ""),
                       "resolucion": "1 arc-second, reprojected to UTM at 60 m by averaging", "version": m.get("version", ""),
                       "licencia": LIC_COPERNICUS, "sha256": m.get("sha256_archivo") or m["sha256"]})
    ndvi = leer(DATOS / "huella_etapas" / "ndvi.json")
    for nombre, v in (ndvi or {}).items():
        f = v["fuente"]
        salida.append({"id": f"{f['id']} ({nombre})", "entidad": "ESA Copernicus Sentinel-2 L2A via Element 84 Earth Search (AWS Open Data)",
                       "coordenadas": nombre, "resolucion": "B04/B08 averaged to 60 m; annual 90th percentile of monthly NDVI",
                       "version": f.get("version", ""), "licencia": LIC_SENTINEL, "sha256": f["sha256"]})
    return salida


def principal(argv=None) -> dict:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--solo-manifest", action="store_true")
    a = p.parse_args(argv)
    WEB.mkdir(parents=True, exist_ok=True)
    copiados = [] if a.solo_manifest else copiar()
    prm = parametros.cargar()
    archivos, maqueta = [], False
    for f in sorted(WEB.rglob("*")):
        if f.is_file() and f.name != "manifest.json":
            m = None
            if f.suffix == ".json":
                try:
                    m = json.loads(f.read_text(encoding="utf-8")).get("maqueta")
                except Exception:
                    m = None
            maqueta = maqueta or bool(m)
            archivos.append({"archivo": str(f.relative_to(WEB)).replace("\\", "/"), "bytes": f.stat().st_size,
                             "sha256": sha_archivo(f), "maqueta": m})
    m3_ruta = SALIDA / "manifest_parte3.json"
    m3 = leer(m3_ruta)
    resumen4 = leer(DATOS / "distribuciones_payunia_resumen.json")
    manifest = {
        "proyecto": "TERRA-X", "version": "1.0.0", "maqueta": maqueta, "fecha": dt.datetime.now(UTC).date().isoformat(),
        "parametros_sha256": parametros.huella(),
        "parametros": {"sol_elevacion_min": prm["luz_rasante"]["e_min_deg"], "sol_elevacion_max": prm["luz_rasante"]["e_max_deg"],
                       "umbral_limites": prm["decision"]["umbral_theta"], "resolucion_metros": prm["grilla"]["pixel_m"],
                       "azimutes_horizonte": prm["horizonte"]["azimutes_mapa"]},
        "fuentes": fuentes_parte3() + fuentes_luna() + fuentes_tierra(),
        "archivos": archivos,
        "partes": {
            "parte3": ({"manifest": "salida/manifest_parte3.json", "sha256": sha_archivo(m3_ruta),
                        "archivos": m3.get("archivos", [])} if m3 else None),
            "parte4": resumen4,
        },
        "uso_si": "Written by motor/exportar (Part 4), drafted with Claude Code; see SI_USAGE.md.",
    }
    (WEB / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"web/public/data: {len(copiados)} archivos copiados, {len(archivos)} con SHA-256, "
          f"{len(manifest['fuentes'])} fuentes, parte3={'sí' if m3 else 'no'}, maqueta={maqueta}")
    return manifest


if __name__ == "__main__":
    principal()
