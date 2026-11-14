"""PUENTE TEMPORAL: copia las salidas del motor físico a web/public/data y rehace manifest.json.

No reemplaza a motor/exportar (dueño: Mathias); hace lo mínimo que pide el contrato para que la web
muestre datos reales: copia los archivos, calcula el SHA-256 de cada uno y lista las fuentes reales
con su versión. También corrige sol/lunaciones.json, que traía la mitad de cada noche (hallazgo 1).

    python -m puente_lola.exportar_web

Uso de SI: redactado con Claude Code a pedido de quien lidera el equipo.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import pathlib
import shutil

import numpy as np

import parametros
from motor.sol import efemerides, lunacion

RAIZ = pathlib.Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "salida"
WEB = RAIZ / "web" / "public" / "data"
UTC = dt.timezone.utc


def sha(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def copiar() -> list[pathlib.Path]:
    copiados = []
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
            shutil.copy2(f, WEB / "destino" / f"vista_refugios_{n}.png")
            copiados.append(WEB / "destino" / f"vista_refugios_{n}.png")
    return copiados


def lunaciones() -> dict:
    """Sol por lunación en el centro de Mons Mouton (2027-2028) con la noche completa sobre horizonte liso."""
    c = parametros.cargar()["destino"]["centro"]
    a, b = dt.datetime(2026, 12, 1, tzinfo=UTC), dt.datetime(2029, 2, 1, tzinfo=UTC)
    ser = lunacion.serie_luna(c["lat"], c["lon"], a, b, 1.0)
    t, el = ser["t"], np.asarray(ser["el"])
    noches = lunacion.noches(t, el, 1.0)
    # Ventanas de lunación de mínimo a mínimo del Sol (las mismas fechas de los documentos).
    mins = [i for i in range(14 * 24, len(el) - 14 * 24) if el[i] == el[i - 14 * 24:i + 14 * 24 + 1].min()]
    filas = []
    for i0, i1 in zip(mins, mins[1:]):
        if t[i0].year < 2027 or t[i0].year > 2028:
            continue
        seg = el[i0:i1]
        tocan = [n for n in noches if n["i1"] >= i0 and n["i0"] < i1 and n["completa"]]
        imax = i0 + int(np.argmax(seg))
        filas.append({"inicio": t[i0].date().isoformat(), "pico": t[imax].date().isoformat(), "emax": round(float(seg.max()), 2),
                      "emin": round(float(seg.min()), 2), "frac_sobre_0": round(float((seg > 0).mean()), 3),
                      "horas_seguidas_bajo_0": max((n["horas"] for n in tocan), default=None)})
    return {"lugar": {"lat": c["lat"], "lon": c["lon"], "nombre": "Mons Mouton (centro oficial)"},
            "centro": {"global_max": round(float(el.max()), 3), "global_min": round(float(el.min()), 3), "lunaciones": filas},
            "nota": ("horas_seguidas_bajo_0 es la noche completa más larga que toca cada lunación (Sol bajo el horizonte liso, paso de 1 h, "
                     "Skyfield y DE421). La versión anterior cortaba cada noche por la mitad: ver informe/hallazgos_para_el_equipo.md."),
            "maqueta": False, "meta": parametros.bloque_meta("lunaciones", "0.1.0")}


def fuentes() -> list[dict]:
    salida = [{"id": "JPL Horizons API v1.2", "entidad": "NASA JPL Solar System Dynamics",
               "coordenadas": "Mons Mouton (84.60°S, 31.00°E), IM-2, rim points; Ciudad del Este, Payunia, Puna",
               "resolucion": "2 h (Moon 2027-2028) and 1 min (Earth, Nov 14-15, 2026); queried Nov 7 and Nov 14, 2026",
               "licencia": "NASA Open Data", "sha256": None}]
    for k in efemerides.huellas():
        salida.append({"id": k["id"].replace("naif_", "NAIF kernel "), "entidad": "NASA JPL NAIF (used by Skyfield)",
                       "coordenadas": "Solar system ephemeris DE421 and lunar MOON_ME frame", "resolucion": "—",
                       "licencia": "NASA Open Data", "sha256": k["sha256"]})
    prov_p = RAIZ / "datos" / "fuentes_pgda.json"
    if prov_p.exists():
        prov = json.loads(prov_p.read_text(encoding="utf-8"))
        descr = {"mons_mouton_60m": ("LOLA LDEM_80S_20MPP_ADJ (PGDA 90), target crop", "30 × 30 km around Mons Mouton",
                                     "20 m averaged in 3 × 3 blocks to 60 m (no interpolation)"),
                 "mons_mouton_margen_60m": ("LOLA LDEM_60S_60MPP_ADJ (PGDA 90), near relief", "±60 km around Mons Mouton", "60 m native"),
                 "mons_mouton_lejano_240m": ("LOLA LDEM_60S_240MPP_ADJ (PGDA 90), far relief", "±312 km around Mons Mouton", "240 m native"),
                 "nasa_avgvisib_85s_60m": ("NASA AVGVISIB_85S_060M_201608 (PGDA 69), average illumination", "Target crop (inside 85°S map extent)",
                                           "60 m native; DN × 0.00004")}
        for nombre, g in prov["grillas"].items():
            i, cob, res = descr.get(nombre, (nombre, "", ""))
            salida.append({"id": i, "entidad": "NASA GSFC Planetary Geology, Geophysics and Geochemistry Lab (LOLA team)",
                           "coordenadas": cob, "resolucion": res, "licencia": "NASA Open Data (cite Barker et al. 2023; Mazarico et al. 2011)",
                           "sha256": g["sha256"]})
    return salida


def principal():
    copiados = copiar()
    lun = lunaciones()
    (WEB / "sol").mkdir(parents=True, exist_ok=True)
    (WEB / "sol" / "lunaciones.json").write_text(json.dumps(lun, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    prm = parametros.cargar()
    archivos = []
    maqueta = False
    for p in sorted(WEB.rglob("*")):
        if p.is_file() and p.name != "manifest.json":
            m = None
            if p.suffix == ".json":
                try:
                    m = json.loads(p.read_text(encoding="utf-8")).get("maqueta")
                except Exception:
                    m = None
            maqueta = maqueta or bool(m)
            archivos.append({"archivo": str(p.relative_to(WEB)).replace("\\", "/"), "bytes": p.stat().st_size, "sha256": sha(p), "maqueta": m})
    manifest = {"proyecto": "TERRA-X", "version": "1.0.0", "maqueta": maqueta,
                "fecha": dt.datetime.now(UTC).date().isoformat(),
                "parametros_sha256": parametros.huella(),
                "parametros": {"sol_elevacion_min": prm["luz_rasante"]["e_min_deg"], "sol_elevacion_max": prm["luz_rasante"]["e_max_deg"],
                               "umbral_limites": prm["decision"]["umbral_theta"], "resolucion_metros": prm["grilla"]["pixel_m"],
                               "azimutes_horizonte": prm["horizonte"]["azimutes_mapa"]},
                "fuentes": fuentes(), "archivos": archivos,
                "nota": "Escrito por puente_lola/exportar_web.py hasta que exista motor/exportar."}
    (WEB / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"web/public/data: {len(copiados)} archivos copiados, {len(archivos)} con SHA-256 en manifest.json, maqueta={maqueta}")


if __name__ == "__main__":
    principal()
