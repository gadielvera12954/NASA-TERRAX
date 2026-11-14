"""Comparación de la medición de sombras del sábado con la predicción (F14, F15, F19; hipótesis H2).

Entrada: un CSV con una fila por medición (formato en informe/plantilla_medicion_campo.csv):
    hora_local, largo_sombra_m, inclinacion_suelo_deg, alto_m, ancho_m, temperatura_c, foto, notas
`hora_local` en UTC−3 con segundos (HH:MM:SS). `inclinacion_suelo_deg` es positiva si el suelo sube
a lo largo de la sombra (alejándose de la tablita).

Para cada medición se calcula la altura aparente del Sol a esa hora (Skyfield + F15), la sombra
esperada sobre suelo nivelado s = h / tan(e) y la corregida por la inclinación medida
s_γ = h·cos(e)/sin(e + γ), y el error ε = |s_med − s_calc| / s_calc (F14). La meta de H2 es ε ≤ 5 %
con el Sol entre 5° y 15°. Se marcan, sin descartarlas, las filas que no cumplen las condiciones
del protocolo (suelo con más inclinación que la tolerancia de F14, tablita más angosta que F19).

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import csv
import datetime as dt
import math
import pathlib

import numpy as np

from motor.sol import ventanas
from motor.sol.posicion import sol_tierra


def leer_csv(ruta) -> list[dict]:
    with open(ruta, encoding="utf-8-sig") as fh:
        return [{k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in fila.items()} for fila in csv.DictReader(fh)]


def comparar(filas: list[dict], lugar: dict, fecha: str, prm: dict) -> dict:
    tz = ventanas.zona(-3)
    c = prm["campo"]
    salida = []
    for f in filas:
        if not f.get("hora_local") or not f.get("largo_sombra_m"):
            continue
        h, m, *s = map(int, f["hora_local"].split(":"))
        t = dt.datetime.combine(dt.date.fromisoformat(fecha), dt.time(h, m, s[0] if s else 0), tz).astimezone(dt.timezone.utc)
        temp = float(f["temperatura_c"]) if f.get("temperatura_c") else prm["sol"]["refraccion"]["temperatura_c"]
        az, e_geo, e_ap = sol_tierra(lugar["lat"], lugar["lon"], lugar["alt_m"], [t], refraccion=True, temperatura_c=temp)
        e = float(e_ap[0])
        alto = float(f.get("alto_m") or c["tablita_alto_m"])
        ancho = float(f["ancho_m"]) if f.get("ancho_m") else None
        gamma = float(f["inclinacion_suelo_deg"]) if f.get("inclinacion_suelo_deg") else 0.0
        s_med = float(f["largo_sombra_m"])
        s_calc = alto / math.tan(math.radians(e))
        s_gam = alto * math.cos(math.radians(e)) / math.sin(math.radians(e + gamma))
        tol = ventanas.tolerancia_altura_deg(e, c["meta_error_frac"])
        avisos = []
        if abs(gamma) > tol:
            avisos.append(f"suelo inclinado {gamma:.2f}° > tolerancia {tol:.2f}° (F14)")
        if ancho is not None and ancho < ventanas.ancho_minimo_m(alto, e):
            avisos.append(f"tablita de {100 * ancho:.1f} cm, menos que el ancho mínimo de F19 ({100 * ventanas.ancho_minimo_m(alto, e):.1f} cm)")
        salida.append({
            "hora_local": f["hora_local"], "e_aparente_deg": round(e, 3), "azimut_deg": round(float(az[0]), 2),
            "sombra_medida_m": s_med, "sombra_calculada_m": round(s_calc, 3), "sombra_corregida_m": round(s_gam, 3),
            "error_frac": round(abs(s_med - s_calc) / s_calc, 4), "error_corregido_frac": round(abs(s_med - s_gam) / s_gam, 4),
            "en_rango_h2": c["e_min_deg"] <= e <= c["e_max_deg"], "avisos": avisos, "foto": f.get("foto", ""),
        })
    en_rango = [x for x in salida if x["en_rango_h2"]]
    peor = max((x["error_corregido_frac"] for x in en_rango), default=None)
    return {
        "lugar": lugar, "fecha": fecha, "mediciones": salida, "n_en_rango": len(en_rango),
        "error_max_en_rango": peor, "error_medio_en_rango": (float(np.mean([x["error_corregido_frac"] for x in en_rango])) if en_rango else None),
        "meta": c["meta_error_frac"], "pasa": (peor is not None and peor <= c["meta_error_frac"]),
    }


def buscar_medicion(raiz: pathlib.Path, fecha: str) -> pathlib.Path | None:
    for p in (raiz / "campo" / f"medicion_{fecha}.csv", raiz / "campo" / f"medicion_cde_{fecha}.csv"):
        if p.exists():
            return p
    return None
