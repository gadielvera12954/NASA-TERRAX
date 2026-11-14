"""Efemérides DE421 y marco lunar MOON_ME_DE421 con Skyfield (el mismo marco de los productos LOLA).

Los kernels están en motor/sol/kernels (o en la carpeta de la variable TERRA_X_KERNELS). Si faltan,
Skyfield los baja de NAIF/JPL la primera vez. Sus SHA-256 van al manifiesto.

Uso de SI: redactado con Claude Code siguiendo la guía de marcos planetarios de Skyfield.
"""
from __future__ import annotations

import dataclasses
import hashlib
import os
import pathlib
from functools import lru_cache

from skyfield.api import Loader, PlanetaryConstants

KERNELS = pathlib.Path(os.environ.get("TERRA_X_KERNELS", pathlib.Path(__file__).resolve().parent / "kernels"))
ARCHIVOS = ("de421.bsp", "moon_080317.tf", "pck00008.tpc", "moon_pa_de421_1900-2050.bpc")


@dataclasses.dataclass(frozen=True)
class Efemerides:
    ts: object
    eph: object
    pc: object
    marco_luna: object

    @property
    def sol(self):
        return self.eph["sun"]

    @property
    def luna(self):
        return self.eph["moon"]

    @property
    def tierra(self):
        return self.eph["earth"]


@lru_cache(maxsize=1)
def cargar() -> Efemerides:
    KERNELS.mkdir(parents=True, exist_ok=True)
    carga = Loader(str(KERNELS), verbose=False)
    ts = carga.timescale(builtin=True)
    eph = carga("de421.bsp")
    pc = PlanetaryConstants()
    pc.read_text(carga("moon_080317.tf"))
    pc.read_text(carga("pck00008.tpc"))
    pc.read_binary(carga("moon_pa_de421_1900-2050.bpc"))
    marco = pc.build_frame_named("MOON_ME_DE421")
    return Efemerides(ts=ts, eph=eph, pc=pc, marco_luna=marco)


def huellas() -> list[dict]:
    """Fuentes con SHA-256 para el manifiesto."""
    salida = []
    for nombre in ARCHIVOS:
        ruta = KERNELS / nombre
        sha = hashlib.sha256(ruta.read_bytes()).hexdigest() if ruta.exists() else None
        salida.append({"id": f"naif_{nombre}", "sha256": sha, "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"})
    return salida
