"""Simulación del rover estacionado en el destino, hora por hora (F3 a F7), y ficha del destino.

Cómo se evalúa una lunación (decisión registrada en parametros.yaml, destino.noches_completas):
la serie se calcula desde `desde − margen` hasta `hasta + margen`, la batería arranca llena al
principio de la serie, y cada noche que se superpone con [desde, hasta) se mide entera. Las
fracciones (Sol en paneles, potencia media) se calculan solo dentro de [desde, hasta).

Rumbo: "sol-en-esquina" (escenario del documento 04) mantiene el Sol a 45° del frente, entre el
panel frontal y el lateral; un número fija el rumbo (rover estacionado sin girar).

Uso de SI: redactado con Claude Code; probado en test_destino.py.
"""
from __future__ import annotations

import datetime as dt
import math

import numpy as np

import parametros
from motor.horizonte.nucleo import horizonte_en_azimut
from motor.sol.posicion import rango_utc, sol_luna

from . import energia


def _indices(t, desde, paso_h, hasta):
    i0 = int(round((desde - t[0]).total_seconds() / (paso_h * 3600.0)))
    i1 = int(round((hasta - t[0]).total_seconds() / (paso_h * 3600.0)))
    return i0, i1


def _mas_largo_que_toca(mascara, i0, i1, paso_h):
    mejor, tramo = 0.0, None
    for a, b in energia.tramos(mascara):
        if a <= i1 - 1 and b >= i0:
            largo = (b - a + 1) * paso_h
            if largo > mejor:
                mejor, tramo = largo, (a, b)
    return mejor, tramo


def depresion_horizonte_liso_deg(altura_m: float, radio_m: float) -> float:
    return -math.degrees(math.atan(math.sqrt(2.0 * altura_m / radio_m)))


def simular_punto(lat: float, lon: float, desde: dt.datetime, hasta: dt.datetime, horizonte_360=None,
                  rumbo="sol-en-esquina", conv_deg: float = 0.0, inclinacion_deg: float = 0.0,
                  orientacion_pendiente_deg: float = 0.0, consumo_w: float | None = None,
                  pendiente_local_deg: float = 0.0, prm: dict | None = None, serie=None) -> dict:
    """Resultado de una corrida (esquemas/destino.schema.json#/$defs/resultado)."""
    prm = prm or parametros.cargar()
    v, d = prm["vehiculo"], prm["destino"]
    paso_h = float(d["paso_h"])
    margen = dt.timedelta(days=float(d["margen_noches_dias"]))
    if serie is None:
        t = rango_utc(desde - margen, hasta + margen, paso_h * 3600.0)
        az, el = sol_luna(lat, lon, t)
    else:
        t, az, el = serie
    i0, i1 = _indices(t, desde, paso_h, hasta)
    radio_m = prm["cuerpos"]["luna"]["radio_km"] * 1000.0
    if horizonte_360 is None:
        eh = np.full_like(el, depresion_horizonte_liso_deg(prm["horizonte"]["altura_observador_m"], radio_m))
    else:
        eh = horizonte_en_azimut(np.asarray(horizonte_360, dtype=float), (az + conv_deg) % 360.0)
    fsol = energia.fraccion_disco(el, eh, prm["sol"]["radio_angular_deg"])
    psi = (az - 45.0) if rumbo == "sol-en-esquina" else np.full_like(az, float(rumbo))
    p = energia.potencia_total(el, az, psi, v["lados_deg"], v["panel_w"], fsol, inclinacion_deg, orientacion_pendiente_deg)
    consumo = float(v["consumo_w"] if consumo_w is None else consumo_w)
    e_max = float(v["bateria_wh"])
    e = energia.bateria(p, consumo, paso_h, e_max, e_max * float(v["bateria_inicial_frac"]))
    p_surv = float(v["p_surv_w"])

    tramo_h, tramo = _mas_largo_que_toca(p < p_surv, i0, i1, paso_h)
    noche_h, _ = _mas_largo_que_toca(el < eh, i0, i1, paso_h)
    s0, s1 = i0, i1 - 1
    for a, b in energia.tramos(p < p_surv):
        if a <= i1 - 1 and b >= i0:
            s0, s1 = min(s0, a), max(s1, b)
    e_min = float(e[s0:s1 + 2].min())
    reserva = float(v["reserva_frac"]) * e_max
    c = energia.condiciones(tramo_h, e_min, reserva, pendiente_local_deg, d["limite_refugio_h"], v["pendiente_max_deg"])
    ventana = slice(i0, i1)
    return {
        "sol_en_paneles_frac": round(float((p[ventana] > 0).mean()), 4),
        "sobre_p_surv_frac": round(float((p[ventana] >= p_surv).mean()), 4),
        "potencia_media_w": round(float(p[ventana].mean()), 1),
        "tramo_oscuro_mas_largo_h": float(tramo_h),
        "noche_geometrica_h": float(noche_h),
        "bateria_minima_wh": round(e_min, 1),
        "bateria_minima_frac": round(e_min / e_max, 4),
        "condiciones": c,
        "en_riesgo": energia.en_riesgo(c),
        "consumo_w": consumo,
        "pendiente_local_deg": round(float(pendiente_local_deg), 2),
        "inclinacion_deg": float(inclinacion_deg),
    }


def serie_sol(lat: float, lon: float, desde: dt.datetime, hasta: dt.datetime, prm: dict | None = None):
    prm = prm or parametros.cargar()
    paso_h = float(prm["destino"]["paso_h"])
    margen = dt.timedelta(days=float(prm["destino"]["margen_noches_dias"]))
    t = rango_utc(desde - margen, hasta + margen, paso_h * 3600.0)
    az, el = sol_luna(lat, lon, t)
    return t, az, el


def ab_y_sensibilidad(lat, lon, desde, hasta, horizonte_360, conv_deg, pendiente_local_deg, prm, serie) -> tuple[dict, dict, list]:
    """Corrida base, comparación A/B (plano contra 15° con la orientación más desfavorable de 8) y
    sensibilidad al consumo (50 a 108,4 W)."""
    base = simular_punto(lat, lon, desde, hasta, horizonte_360, prm["destino"]["rumbo"], conv_deg,
                         pendiente_local_deg=pendiente_local_deg, prm=prm, serie=serie)
    plano = simular_punto(lat, lon, desde, hasta, horizonte_360, prm["destino"]["rumbo"], conv_deg, 0.0, 0.0,
                          pendiente_local_deg=0.0, prm=prm, serie=serie)
    beta = float(prm["destino"]["inclinacion_ab_deg"])
    peor, peor_g = None, 0.0
    for g in range(0, 360, 45):
        r = simular_punto(lat, lon, desde, hasta, horizonte_360, prm["destino"]["rumbo"], conv_deg, beta, float(g),
                          pendiente_local_deg=beta, prm=prm, serie=serie)
        clave = (r["tramo_oscuro_mas_largo_h"], -r["bateria_minima_wh"], -r["potencia_media_w"])
        if peor is None or clave > (peor["tramo_oscuro_mas_largo_h"], -peor["bateria_minima_wh"], -peor["potencia_media_w"]):
            peor, peor_g = r, float(g)
    ab = {"plano": plano, "inclinado": peor, "inclinacion_deg": beta, "orientacion_pendiente_deg": peor_g}
    sens = []
    for cw in prm["vehiculo"]["consumo_sensibilidad_w"]:
        r = simular_punto(lat, lon, desde, hasta, horizonte_360, prm["destino"]["rumbo"], conv_deg, consumo_w=float(cw),
                          pendiente_local_deg=pendiente_local_deg, prm=prm, serie=serie)
        sens.append({"consumo_w": float(cw), "tramo_oscuro_mas_largo_h": r["tramo_oscuro_mas_largo_h"],
                     "bateria_minima_frac": r["bateria_minima_frac"], "en_riesgo": r["en_riesgo"]})
    return base, ab, sens


SUPUESTOS = [
    "Plantilla con cifras públicas de VIPER (NASA): no es una simulación oficial de esa misión.",
    "Consumo de 60 W: supuesto del equipo (los consumos de VIPER no son públicos); sensibilidad de 50 a 108,4 W.",
    "Paneles verticales (el ángulo no es público).",
    "Batería llena al comienzo del cálculo; reserva de 20 % (decisión del equipo).",
    "Sin temperatura, polvo, degradación ni sombra del propio rover.",
    "Las noches se miden enteras aunque crucen el borde de la ventana de la lunación.",
]
