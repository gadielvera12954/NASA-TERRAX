"""Regenera todo lo de la Parte 3 en orden, con los datos que haya en este momento.

    python -m motor.tests.cierre                                   # Sol, destino liso, puntaje de maqueta, pruebas, informe
    python -m motor.tests.cierre --distribuciones DATOS/dist.json  # con las distribuciones reales de huella
    python -m motor.tests.cierre --consultar-horizons              # además consulta hoy la API de JPL Horizons

La corrida del destino con relieve (maqueta o real) tarda minutos y va aparte:
    python -m motor.destino maqueta
    python -m motor.destino real --objetivo ... --capas ...

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import argparse

from motor.destino import __main__ as destino
from motor.puntaje import __main__ as puntaje
from motor.sol import __main__ as sol

from . import informe, validacion


def principal(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--distribuciones", default=None)
    p.add_argument("--consultar-horizons", action="store_true")
    a = p.parse_args(argv)
    print("1/6 Sol por lunación y serie de Ciudad del Este")
    sol.principal(["series"])
    print("2/6 Control del Sol contra JPL Horizons")
    sol.principal(["control"] + (["--consultar"] if a.consultar_horizons else []))
    sol.principal(["planilla"])
    print("3/6 Fichas del destino con horizonte liso (Sol real)")
    destino.principal(["liso"])
    print("4/6 Puntaje y Tarjetas de Análogo Abiertas")
    puntaje.principal(["--distribuciones", a.distribuciones] if a.distribuciones else ["--maqueta"])
    print("5/6 Plan de validación → pruebas.json")
    validacion.principal()
    print("6/6 Informe y manifiesto")
    informe.principal()


if __name__ == "__main__":
    principal()
