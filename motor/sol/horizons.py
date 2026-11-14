"""Cliente de la API oficial de JPL Horizons (solo biblioteca estándar) y lectura de sus respuestas.

Se usa para el control "Sol en la Luna: menos de 0,1° frente a Horizons" del documento 02. Cada
respuesta se guarda tal cual la entrega NASA, con la fecha de la consulta y la versión de la API.

    referencia_horizons/2026-11-07/  consulta del equipo para los documentos (sin tocar)
    referencia_horizons/<fecha>/      consulta del día del hackatón (python -m motor.sol control --consultar)

Uso de SI: redactado con Claude Code a partir de _fuentes/verificacion/consultar_horizons.py.
"""
from __future__ import annotations

import csv
import dataclasses
import datetime as dt
import json
import pathlib
import time
import urllib.parse
import urllib.request

BASE = "https://ssd.jpl.nasa.gov/api/horizons.api"
CARPETA = pathlib.Path(__file__).resolve().parent / "referencia_horizons"
REFERENCIA = CARPETA / "2026-11-07"
MESES = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}

# nombre, centro, sitio (lon E, lat, km), inicio, fin, paso, refractado, (lat, lon, alt_m) para comparar
TRABAJOS = [
    ("luna_mons_mouton_centro_2027_2028", "coord@301", "31.00,-84.60,0", "2027-01-01", "2029-01-01", "2 h", False, (-84.60, 31.00, 0.0)),
    ("luna_im2_athena_2027_2028", "coord@301", "29.1957,-84.7906,0", "2027-01-01", "2029-01-01", "2 h", False, (-84.7906, 29.1957, 0.0)),
    ("luna_mons_mouton_norte_2027_2028", "coord@301", "31.00,-83.30,0", "2027-01-01", "2029-01-01", "2 h", False, (-83.30, 31.00, 0.0)),
    ("luna_mons_mouton_sur_2027_2028", "coord@301", "31.00,-86.22,0", "2027-01-01", "2029-01-01", "2 h", False, (-86.22, 31.00, 0.0)),
    ("tierra_cde_2026-11-14_geometrica", "coord@399", "-54.61,-25.51,0.2", "2026-11-14 19:00", "2026-11-15 00:00", "1 m", False, (-25.51, -54.61, 200.0)),
    ("tierra_cde_2026-11-14_refractada", "coord@399", "-54.61,-25.51,0.2", "2026-11-14 19:00", "2026-11-15 00:00", "1 m", True, (-25.51, -54.61, 200.0)),
    ("tierra_cde_2026-11-15_refractada", "coord@399", "-54.61,-25.51,0.2", "2026-11-15 19:00", "2026-11-16 00:00", "1 m", True, (-25.51, -54.61, 200.0)),
    ("tierra_payunia_2026-11-14_refractada", "coord@399", "-69.25,-36.42,1.8", "2026-11-14 20:00", "2026-11-15 02:00", "1 m", True, (-36.42, -69.25, 1800.0)),
    ("tierra_puna_2026-11-14_refractada", "coord@399", "-67.40,-26.06,3.4", "2026-11-14 20:00", "2026-11-15 02:00", "1 m", True, (-26.06, -67.40, 3400.0)),
]


@dataclasses.dataclass
class Referencia:
    meta: str
    filas: list  # [(datetime UTC, azimut_deg, elevacion_deg)]


def _fecha(s: str) -> dt.datetime:
    d, h = s.split()
    y, m, dd = d.split("-")
    hh, mm = h.split(":")[:2]
    return dt.datetime(int(y), MESES[m], int(dd), int(hh), int(mm), tzinfo=dt.timezone.utc)


def leer_csv(ruta) -> Referencia:
    with open(ruta, encoding="utf-8") as fh:
        r = csv.reader(fh)
        meta = next(r)[0].lstrip("# ").strip()
        next(r)
        filas = [(_fecha(u), float(a), float(e)) for u, a, e in r]
    return Referencia(meta=meta, filas=filas)


def consultar(centro: str, sitio: str, inicio: str, fin: str, paso: str, refractado: bool = False,
              objetivo: str = "10", espera_s: float = 120.0) -> tuple[list, str]:
    p = {
        "format": "json", "COMMAND": f"'{objetivo}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'", "CENTER": f"'{centro}'", "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{sitio}'", "START_TIME": f"'{inicio}'", "STOP_TIME": f"'{fin}'",
        "STEP_SIZE": f"'{paso}'", "QUANTITIES": "'4'", "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'", "EXTRA_PREC": "'YES'", "TIME_DIGITS": "'MINUTES'",
    }
    if refractado:
        p["APPARENT"] = "'REFRACTED'"
    url = BASE + "?" + urllib.parse.urlencode(p)
    with urllib.request.urlopen(url, timeout=espera_s) as r:
        datos = json.load(r)
    res = datos.get("result", "")
    if "$$SOE" not in res:
        raise RuntimeError(res[:800])
    cuerpo = res.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    filas = []
    for ln in cuerpo:
        c = [x.strip() for x in ln.split(",")]
        filas.append((c[0], float(c[3]), float(c[4])))
    return filas, datos.get("signature", {}).get("version", "?")


def guardar_csv(ruta, filas, meta: str) -> pathlib.Path:
    ruta = pathlib.Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["# " + meta])
        w.writerow(["utc", "azimut_deg", "elevacion_deg"])
        w.writerows(filas)
    return ruta


def consultar_todo(carpeta: pathlib.Path, informar=print) -> list[pathlib.Path]:
    """Repite todas las consultas de la verificación y las guarda en `carpeta`."""
    sello = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    salida = []
    for nombre, centro, sitio, a, b, paso, refr, _ in TRABAJOS:
        filas, ver = consultar(centro, sitio, a, b, paso, refr)
        meta = f"JPL Horizons API v{ver}; consulta {sello}; centro {centro}; sitio {sitio}; paso {paso}; refraccion={refr}"
        salida.append(guardar_csv(carpeta / f"{nombre}.csv", filas, meta))
        if informar:
            informar(f"  {nombre}: {len(filas)} filas")
        time.sleep(1.0)
    return salida
