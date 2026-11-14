"""Productos del destino (Mons Mouton).

    python -m motor.destino liso       # fichas con el Sol real y horizonte liso (sin relieve)
    python -m motor.destino maqueta    # terreno sintético de MAQUETA: horizontes, refugios, fichas y paridad
    python -m motor.destino real --objetivo DATOS/mons_mouton_60m --capas DATOS/margen_60m DATOS/lejano_240m
                                       # grillas reales de motor/escala (Mathias)
    python -m motor.destino paridad --horizontes salida/destino/horizontes.bin

Todo sale en salida/destino/, con la misma forma que web/public/data/destino/ (lo copia motor/exportar).

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import argparse
import json
import pathlib

import numpy as np

import parametros
from motor import __version__
from motor.horizonte import Capa, calcular_horizontes_puntos, formato
from motor.horizonte.__main__ import calcular_mapa
from motor.horizonte.grilla import centro, convergencia, escribir_grilla, leer_grilla
from motor.tests import sinteticos

from . import ficha, paridad

RAIZ = pathlib.Path(__file__).resolve().parents[2]


def _horizontes(capas, meta_obj, ruta_bin, prm, maqueta, d_max_m) -> dict:
    hz = prm["horizonte"]
    radio = prm["cuerpos"]["luna"]["radio_km"] * 1000.0
    h = calcular_mapa(capas, hz["azimutes_mapa"], hz["altura_observador_m"], radio, 0.0, d_max_m, hz["paso_relativo"], bloque_filas=50)
    fc, cc = centro(capas[0])
    conv = float(convergencia(capas[0], meta_obj, np.array(fc), np.array(cc)))
    meta = formato.escribir(ruta_bin, h, cuerpo=meta_obj["cuerpo"], convergencia_deg=conv, pixel_m=capas[0].pixel_m)
    meta.update({"altura_observador_m": hz["altura_observador_m"], "grilla": meta_obj["nombre"], "fuentes": meta_obj.get("fuentes", []),
                 "parametros_sha256": parametros.huella(), "maqueta": maqueta})
    ruta_bin.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return meta


def _horizonte_rover(capas, fila, col, prm, d_max_m):
    hz = prm["horizonte"]
    radio = prm["cuerpos"]["luna"]["radio_km"] * 1000.0
    return calcular_horizontes_puntos(capas, [(fila, col)], n_az=hz["azimutes_rover"], altura_obs_m=hz["altura_observador_m"],
                                      radio_m=radio, k=0.0, d_max_m=d_max_m, paso_rel=hz["paso_relativo"])[0]


def cmd_liso(a):
    prm = parametros.cargar()
    c = prm["destino"]["centro"]
    for nombre in prm["destino"]["lunaciones"]:
        f = ficha.armar_ficha(nombre, c["lat"], c["lon"], prm, None, 0.0, 0.0, None, None, None, maqueta=False,
                              notas=["Sol real (DE421) en el centro oficial de Mons Mouton, sin relieve: horizonte liso."])
        ficha.escribir_json(pathlib.Path(a.salida) / "destino" / f"ficha_liso_{nombre}.json", f, "destino")
        r = f["resultado"]
        print(f"ficha_liso_{nombre}.json: noche {r['noche_geometrica_h']:.0f} h, tramo < P_surv {r['tramo_oscuro_mas_largo_h']:.0f} h, "
              f"batería mínima {100 * r['bateria_minima_frac']:.0f} %, Sol en paneles {100 * r['sol_en_paneles_frac']:.0f} %, riesgo={r['en_riesgo']}")


def cmd_maqueta(a):
    prm = parametros.cargar()
    salida = pathlib.Path(a.salida)
    print(f"MAQUETA: terreno sintético de {a.n}×{a.n} píxeles de 60 m en el centro de Mons Mouton (no es dato real)")
    base = sinteticos.luna_sintetica(n=a.n, pixel_m=60.0)
    lejos = sinteticos.luna_sintetica_lejana(base, radio_km=a.radio_km, pixel_m=480.0)
    metas = []
    for nombre, t in (("maqueta_mons_mouton_60m", base), ("maqueta_lejano_480m", lejos)):
        m = {"nombre": nombre, "cuerpo": "luna", "pixel_m": t["pixel_m"], "x0_m": t["x0"], "y0_m": t["y0"], "proyeccion": t["proyeccion"],
             "promediado": "terreno sintético", "fuentes": [{"id": "sintetico_terra_x", "sha256": None}], "maqueta": True}
        escribir_grilla(salida / "maqueta" / "grillas" / nombre, t["z"], m)
        metas.append(m)
    capas = [Capa(base["z"], 60.0, base["x0"], base["y0"]), Capa(lejos["z"], 480.0, lejos["x0"], lejos["y0"])]
    ruta_bin = salida / "destino" / "horizontes.bin"
    print("horizontes (72 azimutes):")
    _horizontes(capas, metas[0], ruta_bin, prm, True, a.radio_km * 1000.0)
    fila, col = centro(capas[0])
    h360 = _horizonte_rover(capas, fila, col, prm, a.radio_km * 1000.0)
    ficha.productos_con_relieve(capas[0], metas[0], ruta_bin, salida, prm, h360, maqueta=True)


def cmd_real(a):
    prm = parametros.cargar()
    salida = pathlib.Path(a.salida)
    objetivo, meta_obj = leer_grilla(a.objetivo)
    capas = [objetivo] + [leer_grilla(r)[0] for r in a.capas]
    maqueta = bool(meta_obj.get("maqueta", False))
    ruta_bin = pathlib.Path(a.horizontes) if a.horizontes else salida / "destino" / "horizontes.bin"
    d_max = prm["grilla"]["margen_luna_km"] * 1000.0
    if not a.horizontes:
        print("horizontes (72 azimutes, puede tardar varios minutos):")
        _horizontes(capas, meta_obj, ruta_bin, prm, maqueta, d_max)
    from motor.horizonte.grilla import fila_col_de_latlon
    c = prm["destino"]["centro"]
    fila, col = fila_col_de_latlon(objetivo, meta_obj, c["lat"], c["lon"])
    h360 = _horizonte_rover(capas, fila, col, prm, d_max)
    ficha.productos_con_relieve(objetivo, meta_obj, ruta_bin, salida, prm, h360, maqueta=maqueta)


def cmd_iluminacion(a):
    """F13: iluminación simulada en puntos al azar contra el mapa AVGVISIB de NASA (PGDA 69)."""
    import datetime as dt
    from . import iluminacion
    prm = parametros.cargar()
    v = prm["validacion"]
    objetivo, meta_obj = leer_grilla(a.objetivo)
    capas = [objetivo] + [leer_grilla(r)[0] for r in a.capas]
    nasa, meta_nasa = leer_grilla(a.nasa)
    if nasa.z.shape != objetivo.z.shape or nasa.x0 != objetivo.x0 or nasa.y0 != objetivo.y0:
        raise SystemExit("el mapa de NASA tiene que venir en la misma grilla que la grilla objetivo (motor/escala)")
    pts = iluminacion.puntos_al_azar(objetivo.alto, objetivo.ancho, a.puntos or v["iluminacion_nasa_puntos"], 13,
                                     np.isfinite(objetivo.z) & np.isfinite(nasa.z))
    desde = dt.datetime.fromisoformat(a.desde).replace(tzinfo=dt.timezone.utc)
    hasta = dt.datetime.fromisoformat(a.hasta).replace(tzinfo=dt.timezone.utc)
    print(f"F13: {len(pts)} puntos, {desde.date()} a {hasta.date()} cada {v['iluminacion_nasa_paso_h']} h, observador a 0 m")
    sim = iluminacion.iluminacion_puntos(capas, meta_obj, pts, desde, hasta, v["iluminacion_nasa_paso_h"], prm["horizonte"]["azimutes_mapa"],
                                         prm["horizonte"]["altura_observador_nasa_m"], prm["cuerpos"]["luna"]["radio_km"] * 1000.0,
                                         prm["grilla"]["margen_luna_km"] * 1000.0, prm["horizonte"]["paso_relativo"])
    ref = nasa.z[pts[:, 0], pts[:, 1]].astype(float)
    if np.nanmax(ref) > 1.5:
        ref = ref / 100.0                       # el mapa puede venir en porcentaje
    r = iluminacion.correlacion(sim, ref)
    r.update({"desde": a.desde, "hasta": a.hasta, "maqueta": bool(meta_obj.get("maqueta") or meta_nasa.get("maqueta")),
              "meta_rho": v["iluminacion_nasa_rho_min"], "fuentes": meta_obj.get("fuentes", []) + meta_nasa.get("fuentes", []),
              "meta": parametros.bloque_meta("iluminacion_nasa", __version__)})
    ruta = RAIZ / "informe" / "datos" / "iluminacion_nasa.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(r, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"ρ = {r['rho']:.3f}, error cuadrático medio {r['rmse_puntos']:.1f} puntos → {'PASA' if r['rho'] >= r['meta_rho'] else 'FALLA'}")


def cmd_paridad(a):
    prm = parametros.cargar()
    hz = pathlib.Path(a.horizontes)
    meta_path = hz.with_suffix(".json")
    maqueta = json.loads(meta_path.read_text(encoding="utf-8")).get("maqueta", False) if meta_path.exists() else False
    par = paridad.generar(hz, prm["validacion"]["paridad_casos"], maqueta=maqueta)
    ficha.escribir_json(pathlib.Path(a.salida) / "destino" / "paridad.json", par, "paridad")
    print(f"paridad.json: {len(par['casos'])} casos")


def principal(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--salida", default=str(RAIZ / "salida"))
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("liso").set_defaults(f=cmd_liso)
    m = sub.add_parser("maqueta")
    m.add_argument("--n", type=int, default=500)
    m.add_argument("--radio-km", type=float, default=150.0)
    m.set_defaults(f=cmd_maqueta)
    r = sub.add_parser("real")
    r.add_argument("--objetivo", required=True)
    r.add_argument("--capas", nargs="*", default=[])
    r.add_argument("--horizontes", default=None, help="usar un horizontes.bin ya calculado")
    r.set_defaults(f=cmd_real)
    pa = sub.add_parser("paridad")
    pa.add_argument("--horizontes", required=True)
    pa.set_defaults(f=cmd_paridad)
    il = sub.add_parser("iluminacion")
    il.add_argument("--objetivo", required=True)
    il.add_argument("--capas", nargs="*", default=[])
    il.add_argument("--nasa", required=True, help="AVGVISIB de PGDA 69 en la misma grilla (motor/escala)")
    il.add_argument("--puntos", type=int, default=None)
    il.add_argument("--desde", default="2008-01-01", help="inicio de los 18,6 años (confirmar con la ficha de PGDA 69)")
    il.add_argument("--hasta", default="2026-08-07")
    il.set_defaults(f=cmd_iluminacion)
    a = p.parse_args(argv)
    a.f(a)


if __name__ == "__main__":
    principal()
