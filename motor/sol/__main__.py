"""Productos del módulo sol.

    python -m motor.sol series      # sol/*.json: Sol hora por hora en las lunaciones de verano e invierno
    python -m motor.sol control     # control contra Horizons (agregar --consultar para consultar hoy)
    python -m motor.sol planilla    # predicción minuto a minuto para la medición de sombras

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib

import parametros
from esquemas.validar import validar
from motor import __version__

from . import control, efemerides, horizons, lunacion, posicion, ventanas
from .refraccion import presion_estandar_mbar

RAIZ = pathlib.Path(__file__).resolve().parents[2]
UTC = dt.timezone.utc


def _fecha_utc(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s).replace(tzinfo=UTC)


def _escribir(ruta: pathlib.Path, obj: dict, esquema: str | None = None) -> None:
    if esquema:
        validar(obj, esquema)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def serie_luna_json(nombre: str, lat: float, lon: float, desde: str, hasta: str, paso_h: float) -> dict:
    a, b = _fecha_utc(desde), _fecha_utc(hasta)
    ser = lunacion.serie_luna(lat, lon, a, b, paso_h)
    res = lunacion.resumen_serie(ser)
    res["noches_horizonte_liso"] = [
        {k: n[k] for k in ("desde_utc", "hasta_utc", "horas", "completa")}
        for n in lunacion.noches_que_tocan(lat, lon, a, b, paso_h)
    ]
    return {
        "nombre": nombre,
        "cuerpo": "luna",
        "lugar": {"lat": lat, "lon": lon, "alt_m": 0.0, "nombre": "Mons Mouton (centro oficial)"},
        "t0_utc": ser["t"][0].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "paso_s": paso_h * 3600.0,
        "n": len(ser["t"]),
        "azimut_deg": [round(float(x), 3) for x in ser["az"]],
        "elevacion_deg": [round(float(x), 3) for x in ser["el"]],
        "refraccion": {"aplicada": False, "formula": "sin atmósfera (R = 0 en la Luna)"},
        "marco": "MOON_ME_DE421",
        "efemerides": "DE421 (Skyfield)",
        "resumen": res,
        "maqueta": False,
        "meta": parametros.bloque_meta("sol_lunacion", __version__, notas=[
            "Azimut geográfico desde el norte, sentido horario, como JPL Horizons.",
            "Las noches se miden enteras aunque crucen el borde de la ventana de la lunación.",
        ]),
    }


def serie_tierra_json(nombre: str, lugar: dict, fecha: str, desde: str, hasta: str, temperatura_c: float) -> dict:
    tz = ventanas.zona(-3)
    d = dt.date.fromisoformat(fecha)
    a = dt.datetime.combine(d, dt.time(*map(int, desde.split(":"))), tz).astimezone(UTC)
    b = dt.datetime.combine(d, dt.time(*map(int, hasta.split(":"))), tz).astimezone(UTC)
    t = posicion.rango_utc(a, b, 60.0)
    az, e_geo, e_ap = posicion.sol_tierra(lugar["lat"], lugar["lon"], lugar["alt_m"], t, refraccion=True, temperatura_c=temperatura_c)
    return {
        "nombre": nombre,
        "cuerpo": "tierra",
        "lugar": lugar,
        "t0_utc": t[0].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "paso_s": 60.0,
        "n": len(t),
        "azimut_deg": [round(float(x), 3) for x in az],
        "elevacion_deg": [round(float(x), 4) for x in e_ap],
        "refraccion": {"aplicada": True, "formula": "Sæmundsson (F15)", "presion_mbar": round(presion_estandar_mbar(lugar["alt_m"]), 1),
                       "temperatura_c": temperatura_c},
        "marco": "WGS84 (ITRS)",
        "efemerides": "DE421 (Skyfield)",
        "resumen": {"sol_max_deg": round(float(e_ap.max()), 3), "sol_min_deg": round(float(e_ap.min()), 3)},
        "maqueta": False,
        "meta": parametros.bloque_meta("sol_tierra", __version__, notas=["Elevación aparente (con refracción F15)."]),
    }


def cmd_series(args) -> None:
    prm = parametros.cargar()
    dst = prm["destino"]
    salida = pathlib.Path(args.salida)
    for nombre, lun in dst["lunaciones"].items():
        obj = serie_luna_json(f"luna_mons_mouton_{nombre}_2027", dst["centro"]["lat"], dst["centro"]["lon"],
                              lun["desde"], lun["hasta"], float(dst["paso_h"]))
        ruta = salida / "sol" / f"luna_mons_mouton_{nombre}_2027.json"
        _escribir(ruta, obj, "sol")
        r = obj["resumen"]
        print(f"{ruta.name}: Sol máx {r['sol_max_deg']}° ({r['fecha_sol_max_utc']}), noches {[n['horas'] for n in r['noches_horizonte_liso']]} h")
    campo = prm["campo"]
    obj = serie_tierra_json("tierra_ciudad_del_este_2026-11-14", campo["lugar"], campo["fecha"], "17:30", "19:15",
                            prm["sol"]["refraccion"]["temperatura_c"])
    _escribir(salida / "sol" / "tierra_ciudad_del_este_2026-11-14.json", obj, "sol")
    print("tierra_ciudad_del_este_2026-11-14.json escrito")


def cmd_control(args) -> None:
    prm = parametros.cargar()
    meta = prm["sol"]["meta_vs_horizons_deg"]
    carpetas = [horizons.REFERENCIA]
    if args.consultar:
        hoy = dt.datetime.now(UTC).date().isoformat()
        destino = horizons.CARPETA / hoy
        print(f"consultando JPL Horizons ({horizons.BASE}) → {destino}")
        horizons.consultar_todo(destino)
        carpetas.append(destino)
    else:
        carpetas += sorted(p for p in horizons.CARPETA.iterdir() if p.is_dir() and p != horizons.REFERENCIA)
    informe = {"meta_deg": meta, "kernels": efemerides.huellas(), "controles": []}
    for c in carpetas:
        r = control.controlar(c, meta)
        informe["controles"].append(r)
        print(f"{c.name}: peor diferencia {r['peor_dif_deg']:.6f}° (Luna {r['peor_dif_luna_deg']:.6f}°) → {'PASA' if r['pasa'] else 'FALLA'}")
    informe["pasa"] = all(r["pasa"] for r in informe["controles"])
    informe["meta"] = parametros.bloque_meta("control_sol_horizons", __version__)
    ruta = RAIZ / "informe" / "datos" / "control_sol_horizons.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(informe, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"escrito {ruta.relative_to(RAIZ)}")


def cmd_planilla(args) -> None:
    prm = parametros.cargar()
    c = prm["campo"]
    filas = ventanas.planilla_campo(c["lugar"]["lat"], c["lugar"]["lon"], c["lugar"]["alt_m"], dt.date.fromisoformat(c["fecha"]),
                                    args.desde, args.hasta, c["tablita_alto_m"], temperatura_c=args.temperatura)
    ruta = RAIZ / "informe" / "datos" / f"prediccion_campo_{c['fecha']}.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps({"lugar": c["lugar"], "fecha": c["fecha"], "tablita_alto_m": c["tablita_alto_m"],
                                "temperatura_c": args.temperatura, "filas": filas,
                                "meta": parametros.bloque_meta("prediccion_campo", __version__)}, ensure_ascii=False, indent=1) + "\n",
                    encoding="utf-8")
    print(f"escrito {ruta.relative_to(RAIZ)} ({len(filas)} minutos)")


def principal(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("series")
    s.add_argument("--salida", default=str(RAIZ / "salida"))
    s.set_defaults(f=cmd_series)
    c = sub.add_parser("control")
    c.add_argument("--consultar", action="store_true", help="consultar hoy la API de JPL Horizons")
    c.set_defaults(f=cmd_control)
    pl = sub.add_parser("planilla")
    pl.add_argument("--desde", default="17:45")
    pl.add_argument("--hasta", default="19:00")
    pl.add_argument("--temperatura", type=float, default=10.0, help="°C medidos en el lugar (por defecto 10, estándar)")
    pl.set_defaults(f=cmd_planilla)
    a = p.parse_args(argv)
    a.f(a)


if __name__ == "__main__":
    principal()
