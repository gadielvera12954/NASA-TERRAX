"""Puntúa las parcelas y escribe las Tarjetas de Análogo Abiertas.

    python -m motor.puntaje --distribuciones DATOS/distribuciones_payunia.json   # reales (motor/huella, Mathias)
    python -m motor.puntaje --maqueta                                              # distribuciones de MAQUETA

Salida: salida/fichas/<id>.json y salida/fichas/indice.json, y informe/datos/puntaje_controles.json
(controles y prueba de redundancia H1b) para pruebas.json.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import argparse
import json
import pathlib

from scipy.stats import spearmanr

import parametros
from esquemas.validar import validar
from motor.tests import sinteticos

from . import fichas

RAIZ = pathlib.Path(__file__).resolve().parents[2]


def redundancia_h1b(evals: dict, ids: list[str]) -> dict:
    """H1b: correlación de rangos entre la distancia de pendiente y la de luz rasante (meta ρ < 0,9)."""
    pares = [(evals[i]["propiedades"]["pendiente"]["distancia"], evals[i]["propiedades"]["luz_rasante"]["distancia"]) for i in ids
             if evals[i]["propiedades"]["pendiente"]["distancia"] is not None and evals[i]["propiedades"]["luz_rasante"]["distancia"] is not None]
    if len(pares) < 4:
        return {"rho": None, "n": len(pares)}
    a, b = zip(*pares)
    return {"rho": float(spearmanr(a, b).statistic), "n": len(pares)}


def principal(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--distribuciones")
    g.add_argument("--maqueta", action="store_true")
    p.add_argument("--salida", default=str(RAIZ / "salida"))
    p.add_argument("--sin-horario", action="store_true")
    a = p.parse_args(argv)
    prm = parametros.cargar()
    if a.maqueta:
        datos = sinteticos.distribuciones_maqueta()
    else:
        datos = json.loads(pathlib.Path(a.distribuciones).read_text(encoding="utf-8"))
    validar(datos, "distribuciones")
    out = fichas.puntuar(datos, prm, con_horario=not a.sin_horario)
    carpeta = pathlib.Path(a.salida) / "fichas"
    carpeta.mkdir(parents=True, exist_ok=True)
    for f in out["fichas"]:
        validar(f, "tarjeta")
        (carpeta / f"{f['id']}.json").write_text(json.dumps(f, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    validar(out["indice"], "fichas_indice")
    (carpeta / "indice.json").write_text(json.dumps(out["indice"], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    reales = [f["id"] for f in out["fichas"] if f["control"] is None]
    resumen = {"controles": out["indice"]["controles"], "redundancia_h1b": redundancia_h1b(out["evaluaciones"], reales),
               "maqueta": bool(datos.get("maqueta", False)), "meta": parametros.bloque_meta("puntaje_controles", "0.1.0")}
    (RAIZ / "informe" / "datos").mkdir(parents=True, exist_ok=True)
    (RAIZ / "informe" / "datos" / "puntaje_controles.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for fila in out["indice"]["candidatas"]:
        print(f"  {str(fila['orden'] or '—'):>3}  {fila['id']:<13} {fila['etiqueta']:<20} C={fila['C']}  E={fila['E']}  L={fila['L']}  U={fila['U']}")
    c = out["indice"]["controles"]
    print(f"controles: recorte primero={c['recorte_primero']} · copias en orden={c['copias_en_orden']} · "
          f"vegetación rechazada={c['vegetacion_rechazada']} → confiable={c['confiable']}")
    print(f"H1b (redundancia pendiente/luz): {resumen['redundancia_h1b']}")


if __name__ == "__main__":
    principal()
