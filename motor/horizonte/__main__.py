"""Calcula horizontes.bin a partir de las grillas de motor/escala.

    python -m motor.horizonte --objetivo DATOS/mons_mouton_60m \
        --capas DATOS/mons_mouton_margen_60m DATOS/lejano_240m \
        --salida salida/destino/horizontes.bin

Mathias lo corre también sobre cada parcela (`--salida salida/parcelas/P-07.bin`): el formato es
el mismo. Los parámetros (azimutes, altura del panel, radio, k, paso) salen de parametros.yaml.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

import numpy as np

import parametros
from motor import __version__

from . import formato
from .grilla import centro, convergencia, leer_grilla
from .nucleo import Capa, calcular_horizontes_puntos, margen_minimo_m


def calcular_mapa(capas: list[Capa], n_az: int, altura_obs_m: float, radio_m, k: float, d_max_m, paso_rel: float,
                  bloque_filas: int = 20, informar=print) -> np.ndarray:
    """Igual que calcular_horizontes, por bloques de filas para poder informar el avance."""
    alto, ancho = capas[0].alto, capas[0].ancho
    salida = np.empty((n_az, alto, ancho), dtype=np.float32)
    t0 = time.time()
    for f0 in range(0, alto, bloque_filas):
        f1 = min(alto, f0 + bloque_filas)
        ff, cc = np.mgrid[f0:f1, 0:ancho]
        pts = np.stack([ff.ravel(), cc.ravel()], axis=1)
        h = calcular_horizontes_puntos(capas, pts, n_az=n_az, altura_obs_m=altura_obs_m, radio_m=radio_m, k=k,
                                       d_max_m=d_max_m, paso_rel=paso_rel)
        salida[:, f0:f1, :] = h.T.reshape(n_az, f1 - f0, ancho)
        if informar:
            hecho = f1 / alto
            resta = (time.time() - t0) * (1 - hecho) / max(hecho, 1e-9)
            informar(f"  filas {f1}/{alto} · {100 * hecho:5.1f} % · faltan ~{resta / 60:4.1f} min")
    return salida


def principal(argv=None) -> dict:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--objetivo", required=True, help="grilla objetivo (sin extensión o .npy/.json)")
    p.add_argument("--capas", nargs="*", default=[], help="capas de margen, de la más fina a la más gruesa")
    p.add_argument("--salida", required=True, help="ruta de horizontes.bin")
    p.add_argument("--n-az", type=int, default=None, help="azimutes (por defecto horizonte.azimutes_mapa)")
    p.add_argument("--altura-obs", type=float, default=None, help="altura del observador en m")
    p.add_argument("--d-max-km", type=float, default=None, help="distancia máxima del rayo")
    a = p.parse_args(argv)

    prm = parametros.cargar()
    hz = prm["horizonte"]
    objetivo, meta_obj = leer_grilla(a.objetivo)
    capas = [objetivo]
    fuentes = list(meta_obj.get("fuentes", []))
    maqueta = bool(meta_obj.get("maqueta", False))
    for ruta in a.capas:
        c, m = leer_grilla(ruta)
        if m["proyeccion"] != meta_obj["proyeccion"]:
            raise SystemExit(f"la capa {ruta} no está en la misma proyección que la grilla objetivo")
        capas.append(c)
        fuentes += m.get("fuentes", [])
        maqueta = maqueta or bool(m.get("maqueta", False))
    cuerpo = meta_obj["cuerpo"]
    if cuerpo in prm["cuerpos"]:
        radio_m = prm["cuerpos"][cuerpo]["radio_km"] * 1000.0
        k = prm["cuerpos"][cuerpo]["k_refraccion"]
        margen_km = prm["grilla"]["margen_luna_km" if cuerpo == "luna" else "margen_tierra_km"]
    else:
        radio_m, k, margen_km = None, 0.0, None
    d_max_m = a.d_max_km * 1000.0 if a.d_max_km else (margen_km * 1000.0 if margen_km else None)
    n_az = a.n_az or hz["azimutes_mapa"]
    altura = hz["altura_observador_m"] if a.altura_obs is None else a.altura_obs

    print(f"horizonte: {objetivo.alto}×{objetivo.ancho} píxeles, {n_az} azimutes, {len(capas)} capas, "
          f"cuerpo {cuerpo}, d_max {d_max_m / 1000 if d_max_m else '∞'} km")
    margen = margen_minimo_m(capas)
    if d_max_m and margen < d_max_m:
        print(f"AVISO: las capas cubren solo {margen / 1000:.1f} km alrededor de la grilla objetivo y se piden "
              f"{d_max_m / 1000:.0f} km: en los bordes el horizonte es una cota inferior. Pedir más margen a motor/escala.")
    h = calcular_mapa(capas, n_az, altura, radio_m, k, d_max_m, hz["paso_relativo"])
    fc, cc = centro(objetivo)
    conv = float(convergencia(objetivo, meta_obj, np.array(fc), np.array(cc)))
    meta = formato.escribir(a.salida, h, cuerpo=cuerpo, convergencia_deg=conv, pixel_m=objetivo.pixel_m)
    meta.update({
        "altura_observador_m": float(altura),
        "grilla": meta_obj["nombre"],
        "fuentes": fuentes,
        "parametros_sha256": parametros.huella(),
        "maqueta": maqueta,
        "motor_version": __version__,
        "sin_dato_px": int(np.isnan(h[0]).sum()),
    })
    ruta_meta = pathlib.Path(a.salida).with_suffix(".json")
    ruta_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"escrito {a.salida} ({meta['sha256'][:12]}…) y {ruta_meta.name}")
    return meta


if __name__ == "__main__":
    sys.exit(0 if principal() else 1)
