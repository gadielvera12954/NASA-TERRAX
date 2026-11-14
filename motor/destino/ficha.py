"""Arma la ficha del destino (esquemas/destino.schema.json) y escribe mapas y paridad.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib

import numpy as np

import parametros
from esquemas.validar import validar
from motor import __version__
from motor.horizonte import formato
from motor.horizonte.grilla import convergencia, latlon

from . import paridad, png16, refugios, simulacion

UTC = dt.timezone.utc


def fechas_lunacion(prm: dict, nombre: str) -> tuple[dt.datetime, dt.datetime]:
    lun = prm["destino"]["lunaciones"][nombre]
    return (dt.datetime.fromisoformat(lun["desde"]).replace(tzinfo=UTC), dt.datetime.fromisoformat(lun["hasta"]).replace(tzinfo=UTC))


def escribir_json(ruta: pathlib.Path, obj: dict, esquema: str | None) -> None:
    if esquema:
        validar(obj, esquema)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def resumen_refugios(res: dict, fila: int | None, col: int | None, pixel_m: float, mapa: str, limite_h: float, valido=None) -> dict:
    horas = res["horas"]
    ok = np.ones_like(horas, dtype=bool) if valido is None else valido
    ref = res["refugio"] & ok
    cercano = None
    if fila is not None and ref.any():
        ff, cc = np.nonzero(ref)
        cercano = round(float(np.min(np.hypot(ff - fila, cc - col))) * pixel_m / 1000.0, 3)
    return {
        "limite_h": float(limite_h),
        "fraccion_terreno": round(float(ref.sum() / max(ok.sum(), 1)), 4),
        "refugio_mas_cercano_km": cercano,
        "mapa": mapa,
        "codificacion": "PNG gris de 16 bits: horas seguidas sin Sol (0 a 65534); 65535 = sin dato",
        "horas_p50": round(float(np.median(horas[ok])), 1) if ok.any() else None,
    }


def armar_ficha(nombre: str, lat: float, lon: float, prm: dict, horizonte_360=None, conv_deg: float = 0.0,
                pendiente_local_deg: float = 0.0, fila=None, col=None, refugios_resumen=None, maqueta: bool = False,
                notas=None) -> dict:
    desde, hasta = fechas_lunacion(prm, nombre)
    serie = simulacion.serie_sol(lat, lon, desde, hasta, prm)
    t, az, el = serie
    i0 = int(round((desde - t[0]).total_seconds() / 3600.0 / float(prm["destino"]["paso_h"])))
    i1 = int(round((hasta - t[0]).total_seconds() / 3600.0 / float(prm["destino"]["paso_h"])))
    imax = i0 + int(np.argmax(el[i0:i1]))
    base, ab, sens = simulacion.ab_y_sensibilidad(lat, lon, desde, hasta, horizonte_360, conv_deg, pendiente_local_deg, prm, serie)
    v = prm["vehiculo"]
    return {
        "sitio": prm["destino"]["sitio"],
        "cuerpo": "luna",
        "lunacion": {"nombre": nombre, "desde": desde.date().isoformat(), "hasta": hasta.date().isoformat(),
                     "sol_max_deg": round(float(el[i0:i1].max()), 3), "sol_min_deg": round(float(el[i0:i1].min()), 3),
                     "fecha_sol_max": t[imax].strftime("%Y-%m-%dT%H:%M:%SZ")},
        "punto": {"lat": round(float(lat), 5), "lon": round(float(lon), 5), "fila": fila, "col": col},
        "horizonte": {"tipo": "liso" if horizonte_360 is None else "relieve",
                      "n_az": 0 if horizonte_360 is None else int(len(horizonte_360)),
                      "altura_observador_m": float(prm["horizonte"]["altura_observador_m"])},
        "vehiculo": {"plantilla": v["plantilla"], "panel_w": v["panel_w"], "lados_deg": v["lados_deg"], "bateria_wh": v["bateria_wh"],
                     "supervivencia_h": v["supervivencia_h"], "p_surv_w": v["p_surv_w"], "consumo_w": {"valor": v["consumo_w"], "supuesto": True},
                     "reserva_frac": v["reserva_frac"], "rumbo": prm["destino"]["rumbo"]},
        "resultado": base,
        "ab": ab,
        "sensibilidad_consumo": sens,
        "refugios": refugios_resumen,
        "supuestos": list(simulacion.SUPUESTOS) + ([] if horizonte_360 is not None else
                                                   ["Horizonte liso: sin relieve. El relieve real cambia este resultado (doc02 §5.1)."]),
        "maqueta": bool(maqueta),
        "meta": parametros.bloque_meta("ficha_destino", __version__, notas=notas),
    }


def productos_con_relieve(objetivo, meta_obj: dict, ruta_bin: pathlib.Path, salida: pathlib.Path, prm: dict,
                          horizonte_rover=None, maqueta: bool = False, informar=print) -> dict:
    """Refugios de verano e invierno, fichas y paridad a partir de un horizontes.bin ya calculado."""
    hz = formato.leer(ruta_bin)
    h = hz.grados()
    lat, lon = latlon(objetivo, meta_obj)
    conv = convergencia(objetivo, meta_obj)
    d = prm["destino"]
    fila, col = (objetivo.alto - 1) // 2, (objetivo.ancho - 1) // 2
    try:
        from motor.horizonte.grilla import fila_col_de_latlon
        fila, col = fila_col_de_latlon(objetivo, meta_obj, d["centro"]["lat"], d["centro"]["lon"])
    except ValueError:
        pass
    lat_r, lon_r = float(lat[fila, col]), float(lon[fila, col])
    from .energia import pendiente_horn_deg
    pend = pendiente_horn_deg(objetivo.z, fila, col, objetivo.pixel_m)
    valido = np.isfinite(objetivo.z)
    hechos = {}
    for nombre in d["lunaciones"]:
        desde, hasta = fechas_lunacion(prm, nombre)
        informar(f"  refugios {nombre}: {objetivo.alto}×{objetivo.ancho} píxeles")
        res = refugios.mapa_refugios(h, lat, lon, conv, desde, hasta, d["margen_noches_dias"], d["paso_h"], d["limite_refugio_h"],
                                     prm["sol"]["radio_angular_deg"])
        mapa = f"refugios_{nombre}.png"
        png16.escribir(salida / "destino" / mapa, refugios.a_png16(res["horas"], ~valido),
                       {"TERRA-X": "horas seguidas sin Sol (F20)", "maqueta": str(maqueta).lower()})
        resumen = resumen_refugios(res, fila, col, objetivo.pixel_m, mapa, d["limite_refugio_h"], valido)
        h360 = horizonte_rover if horizonte_rover is not None else h[:, fila, col]
        ficha = armar_ficha(nombre, lat_r, lon_r, prm, h360, float(conv[fila, col]), pend, fila, col, resumen, maqueta,
                            notas=[f"Horizonte del punto del rover con {len(h360)} azimutes."])
        escribir_json(salida / "destino" / f"ficha_{nombre}.json", ficha, "destino")
        np.save(salida / "destino" / f"_iluminacion_{nombre}.npy", res["visibilidad"].astype(np.float32))
        hechos[nombre] = ficha
        r = ficha["resultado"]
        informar(f"  ficha_{nombre}.json: refugio en {100 * resumen['fraccion_terreno']:.1f} % del terreno, "
                 f"tramo oscuro {r['tramo_oscuro_mas_largo_h']:.0f} h en el punto del rover, riesgo={r['en_riesgo']}")
    par = paridad.generar(ruta_bin, prm["validacion"]["paridad_casos"], maqueta=maqueta)
    escribir_json(salida / "destino" / "paridad.json", par, "paridad")
    informar(f"  paridad.json: {len(par['casos'])} casos sobre {ruta_bin.name}")
    return hechos
