"""Series del Sol con margen para el laboratorio 3D cuando la web corre SIN el servidor.

    python -m servidor.exportar_laboratorio

Escribe web/public/laboratorio/sol_{verano,invierno}.json: el Sol hora por hora en el centro oficial
de Mons Mouton durante cada lunación de parametros.yaml, con los 16 días de margen antes y después
(`destino.margen_noches_dias`). Sin ese margen el navegador cortaría cada noche por la mitad en el
borde de la ventana (el error que el equipo ya encontró en los documentos: 148–210 h en vez de
289–418 h).

Son los mismos valores que calcula motor/destino/simulacion.serie_sol; no se toca web/public/data
(esa carpeta es del exportador de Mathias y tiene sus huellas en manifest.json).

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import hashlib
import json
import pathlib

import numpy as np

import parametros
from motor import __version__
from motor.destino import ficha, simulacion

RAIZ = pathlib.Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "web" / "public" / "laboratorio"


def principal() -> None:
    prm = parametros.cargar()
    c, d = prm["destino"]["centro"], prm["destino"]
    SALIDA.mkdir(parents=True, exist_ok=True)
    indice = {}
    for nombre in d["lunaciones"]:
        desde, hasta = ficha.fechas_lunacion(prm, nombre)
        t, az, el = simulacion.serie_sol(c["lat"], c["lon"], desde, hasta, prm)
        paso_h = float(d["paso_h"])
        i0 = int(round((desde - t[0]).total_seconds() / (paso_h * 3600.0)))
        i1 = int(round((hasta - t[0]).total_seconds() / (paso_h * 3600.0)))
        obj = {
            "nombre": f"laboratorio_sol_{nombre}", "cuerpo": "luna",
            "lugar": {"lat": c["lat"], "lon": c["lon"], "nombre": "Mons Mouton (centro oficial)"},
            "lunacion": {"nombre": nombre, "desde": desde.date().isoformat(), "hasta": hasta.date().isoformat()},
            "margen_dias": float(d["margen_noches_dias"]),
            "t0_utc": t[0].strftime("%Y-%m-%dT%H:%M:%SZ"), "paso_s": paso_h * 3600.0, "n": len(t), "i0": i0, "i1": i1,
            "azimut_deg": np.round(az, 3).tolist(), "elevacion_deg": np.round(el, 4).tolist(),
            "marco": prm["sol"]["marco_luna"], "efemerides": "DE421 (Skyfield)", "maqueta": False,
            "meta": parametros.bloque_meta("laboratorio_sol", __version__,
                                           notas=["Misma serie que motor/destino/simulacion.serie_sol, con margen."]),
        }
        ruta = SALIDA / f"sol_{nombre}.json"
        ruta.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        indice[nombre] = {"archivo": ruta.name, "sha256": hashlib.sha256(ruta.read_bytes()).hexdigest(), "n": len(t)}
        print(f"{ruta.name}: {len(t)} horas, ventana [{i0}, {i1})")
    v = prm["vehiculo"]
    (SALIDA / "indice.json").write_text(json.dumps({
        "series": indice,
        "vehiculo": {k: v[k] for k in ("plantilla", "panel_w", "lados_deg", "bateria_wh", "supervivencia_h", "p_surv_w",
                                       "consumo_w", "consumo_sensibilidad_w", "reserva_frac", "bateria_inicial_frac",
                                       "pendiente_max_deg")},
        "limite_refugio_h": d["limite_refugio_h"], "rumbo": d["rumbo"],
        "radio_angular_sol_deg": prm["sol"]["radio_angular_deg"],
        "altura_observador_m": prm["horizonte"]["altura_observador_m"],
        "campo": prm["campo"],
        "parametros_sha256": parametros.huella(), "maqueta": False,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("indice.json listo")


if __name__ == "__main__":
    principal()
