"""Validación de archivos contra los esquemas de esta carpeta (jsonschema, draft 2020-12).

Resuelve las referencias entre esquemas (`comun.schema.json#/$defs/...`) sin red.
Uso: `from esquemas.validar import validar; validar(obj, "tarjeta")`.

Uso de SI: redactado con Claude Code (Parte 3) para que motor y pruebas validen cada salida antes
de escribirla. Dueño de la carpeta: Mathias.
"""
from __future__ import annotations

import json
import pathlib
from functools import lru_cache

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

CARPETA = pathlib.Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def _registro() -> Registry:
    recursos = []
    for ruta in CARPETA.glob("*.schema.json"):
        esquema = json.loads(ruta.read_text(encoding="utf-8"))
        recursos.append((ruta.name, Resource.from_contents(esquema)))
    return Registry().with_resources(recursos)


@lru_cache(maxsize=32)
def _validador(nombre: str) -> Draft202012Validator:
    esquema = json.loads((CARPETA / f"{nombre}.schema.json").read_text(encoding="utf-8"))
    return Draft202012Validator(esquema, registry=_registro())


def errores(obj, nombre: str) -> list[str]:
    return [f"{'/'.join(map(str, e.absolute_path)) or '(raíz)'}: {e.message}" for e in _validador(nombre).iter_errors(obj)]


def validar(obj, nombre: str) -> None:
    """Lanza ValueError con todos los errores si el objeto no cumple el esquema."""
    errs = errores(obj, nombre)
    if errs:
        raise ValueError(f"no cumple esquemas/{nombre}.schema.json:\n  " + "\n  ".join(errs[:20]))
