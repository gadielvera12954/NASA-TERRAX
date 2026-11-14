"""Horario de ensayo en la Tierra y planilla de la medición de sombras (F1, F14, F15, F19).

* `ventanas_ensayo`: cuándo el Sol de un lugar queda tan bajo como en Mons Mouton (de 7° a 1,5°,
  con refracción), al atardecer y al amanecer, y desde qué azimut llega. Va en la ficha de cada
  candidata ("horario") y en el kit de campo. Horizonte liso: el horario real de una parcela
  depende además de su horizonte (doc02 §5.2), que se aplica con su horizontes.bin.
* `planilla_campo`: predicción minuto a minuto para la tablita de 50 cm en Ciudad del Este.

Las horas se dan en UTC−3 (hora de Paraguay y de Argentina) y se truncan al minuto, igual que la
tabla del documento 02.

Uso de SI: redactado con Claude Code; probado contra la tabla 5.2 del documento 02 en test_sol.py.
"""
from __future__ import annotations

import datetime as dt
import math

import numpy as np

from .posicion import rango_utc, sol_tierra

RADIO_SOL_DEG = 0.267


def zona(horas: float = -3.0) -> dt.timezone:
    return dt.timezone(dt.timedelta(hours=horas))


def _serie(lat, lon, alt_m, desde_local: dt.datetime, hasta_local: dt.datetime, temperatura_c: float):
    t = rango_utc(desde_local.astimezone(dt.timezone.utc), hasta_local.astimezone(dt.timezone.utc), 60.0)
    az, e_geo, e_ap = sol_tierra(lat, lon, alt_m, t, refraccion=True, temperatura_c=temperatura_c)
    return t, az, e_geo, e_ap


def _cruce(t, az, e, objetivo: float, bajando: bool):
    for i in range(len(e) - 1):
        a, b = e[i], e[i + 1]
        if (bajando and a >= objetivo >= b and a != b) or (not bajando and a <= objetivo <= b and a != b):
            f = (a - objetivo) / (a - b)
            ti = t[i] + (t[i + 1] - t[i]) * f
            d_az = (az[i + 1] - az[i] + 180.0) % 360.0 - 180.0
            return ti, (az[i] + d_az * f) % 360.0
    return None, None


def cruces_atardecer(lat: float, lon: float, alt_m: float, fecha_local: dt.date, alturas,
                     zona_h: float = -3.0, temperatura_c: float = 10.0) -> dict:
    """Hora local y azimut en que el Sol aparente baja por cada altura pedida, esa tarde."""
    tz = zona(zona_h)
    a = dt.datetime.combine(fecha_local, dt.time(15, 0), tz)
    b = dt.datetime.combine(fecha_local, dt.time(23, 59), tz)
    t, az, _, e_ap = _serie(lat, lon, alt_m, a, b, temperatura_c)
    salida = {}
    for objetivo in alturas:
        ti, azi = _cruce(t, az, e_ap, float(objetivo), bajando=True)
        if ti is not None:
            salida[objetivo] = {"hora_local": ti.astimezone(tz), "azimut": round(float(azi), 1)}
    return salida


def ventanas_ensayo(lat: float, lon: float, alt_m: float, fecha_inicio: dt.date, dias: int = 7,
                    e_alto: float = 7.0, e_bajo: float = 1.5, zona_h: float = -3.0, temperatura_c: float = 10.0) -> list[dict]:
    """Ventanas de amanecer y atardecer con el Sol entre e_alto y e_bajo (refracción incluida)."""
    tz = zona(zona_h)
    signo = "-" if zona_h < 0 else "+"
    nombre_zona = f"{signo}{abs(int(zona_h)):02d}:{int(round(abs(zona_h) % 1 * 60)):02d}"
    salida = []
    for k in range(dias):
        dia = fecha_inicio + dt.timedelta(days=k)
        for tipo, h0, h1, bajando in (("amanecer", dt.time(4, 0), dt.time(11, 0), False),
                                      ("atardecer", dt.time(15, 0), dt.time(23, 59), True)):
            a = dt.datetime.combine(dia, h0, tz)
            b = dt.datetime.combine(dia, h1, tz)
            t, az, _, e_ap = _serie(lat, lon, alt_m, a, b, temperatura_c)
            primero, segundo = (e_alto, e_bajo) if bajando else (e_bajo, e_alto)
            t1, az1 = _cruce(t, az, e_ap, primero, bajando)
            t2, az2 = _cruce(t, az, e_ap, segundo, bajando)
            if t1 is None or t2 is None:
                continue
            salida.append({
                "tipo": tipo,
                "fecha": dia.isoformat(),
                "desde": t1.astimezone(tz).strftime("%H:%M"),
                "hasta": t2.astimezone(tz).strftime("%H:%M"),
                "azimut": [round(float(az1), 1), round(float(az2), 1)],
                "e_desde": primero,
                "e_hasta": segundo,
                "zona": nombre_zona,
                "horizonte": "liso",
                "duracion_min": round((t2 - t1).total_seconds() / 60.0, 1),
            })
    return salida


def punta_difusa_m(alto_m: float, e_deg: float, rho_deg: float = RADIO_SOL_DEG) -> float:
    """F19: largo de la penumbra en la punta de la sombra, Δs ≈ h·[cot(e − ρ) − cot(e + ρ)]."""
    a, b = math.radians(e_deg - rho_deg), math.radians(e_deg + rho_deg)
    return alto_m * (1.0 / math.tan(a) - 1.0 / math.tan(b))


def ancho_minimo_m(alto_m: float, e_deg: float, rho_deg: float = RADIO_SOL_DEG) -> float:
    """F19: ancho w para que la umbra llegue al suelo: L_u = w/(2·tan ρ) ≥ h/sin e."""
    return 2.0 * math.tan(math.radians(rho_deg)) * alto_m / math.sin(math.radians(e_deg))


def tolerancia_altura_deg(e_deg: float, error_frac: float = 0.05) -> float:
    """F14: error total δe + δγ que deja la sombra dentro de `error_frac` (doc02: 0,25° a 5°)."""
    e = math.radians(e_deg)
    return math.degrees(error_frac * math.sin(e) * math.cos(e))


def planilla_campo(lat: float, lon: float, alt_m: float, fecha_local: dt.date, desde: str = "17:45", hasta: str = "19:00",
                   alto_m: float = 0.5, zona_h: float = -3.0, temperatura_c: float = 10.0) -> list[dict]:
    """Predicción minuto a minuto para la medición de sombras con la tablita."""
    tz = zona(zona_h)
    h0 = dt.time(*map(int, desde.split(":")))
    h1 = dt.time(*map(int, hasta.split(":")))
    t, az, e_geo, e_ap = _serie(lat, lon, alt_m, dt.datetime.combine(fecha_local, h0, tz),
                                dt.datetime.combine(fecha_local, h1, tz), temperatura_c)
    filas = []
    for ti, a, eg, ea in zip(t, az, e_geo, e_ap):
        fila = {"hora_local": ti.astimezone(tz).strftime("%H:%M"), "e_geometrica_deg": round(float(eg), 3),
                "e_aparente_deg": round(float(ea), 3), "azimut_deg": round(float(a), 2)}
        if ea > RADIO_SOL_DEG + 0.05:
            s = alto_m / math.tan(math.radians(ea))
            ds = punta_difusa_m(alto_m, ea)
            fila.update({
                "sombra_m": round(s, 3),
                "punta_difusa_m": round(ds, 3),
                "punta_difusa_pct": round(100 * ds / s, 1),
                "ancho_minimo_cm": round(100 * ancho_minimo_m(alto_m, ea), 1),
                "sombra_sin_refraccion_m": round(alto_m / math.tan(math.radians(eg)), 3) if eg > 0.05 else None,
                "tolerancia_nivel_deg": round(tolerancia_altura_deg(ea), 3),
            })
        filas.append(fila)
    return filas
