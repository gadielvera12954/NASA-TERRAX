"""Parámetros congelados de TERRA-X (Parte 3, Jean).

Lee `parametros.yaml`, calcula su huella SHA-256 y comprueba que coincide con la registrada en
`CONGELADO.json`. Todo el motor lee los parámetros solo a través de `cargar()`, así cada salida
puede llevar la huella exacta de los parámetros con los que se calculó.

Uso de SI: código redactado con Claude Code (Anthropic) y revisado por el equipo.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import pathlib
from functools import lru_cache
from typing import Any

import yaml

CARPETA = pathlib.Path(__file__).resolve().parent
ARCHIVO = CARPETA / "parametros.yaml"
CONGELADO = CARPETA / "CONGELADO.json"


def huella(ruta: pathlib.Path = ARCHIVO) -> str:
    """SHA-256 de los bytes exactos del archivo de parámetros."""
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


@lru_cache(maxsize=4)
def _cargar(ruta: str) -> dict[str, Any]:
    with open(ruta, "r", encoding="utf-8") as fh:
        datos = yaml.safe_load(fh)
    if not isinstance(datos, dict):
        raise ValueError(f"{ruta} no contiene un mapa YAML")
    return datos


def cargar(ruta: pathlib.Path | str = ARCHIVO) -> dict[str, Any]:
    """Devuelve una copia profunda de los parámetros (nadie puede mutar el original en memoria)."""
    return json.loads(json.dumps(_cargar(str(ruta))))


def obtener(clave: str, ruta: pathlib.Path | str = ARCHIVO) -> Any:
    """Acceso por ruta con puntos, por ejemplo `obtener("decision.umbral_theta")`."""
    nodo: Any = cargar(ruta)
    for parte in clave.split("."):
        nodo = nodo[parte]
    return nodo


USO_SI = ("Código del motor físico (Parte 3) redactado con SI (Claude Code, Anthropic) a partir de los "
          "documentos 02 y 04, con pruebas de resultado conocido escritas antes del código. Los números los "
          "calcula el motor determinista con datos y parámetros publicados; ningún modelo de lenguaje interviene "
          "en el cálculo.")


def bloque_meta(producto: str, motor_version: str, notas: list[str] | None = None, version_formato: int = 1) -> dict[str, Any]:
    """Bloque `meta` común a todas las salidas (esquemas/comun.schema.json#/$defs/meta)."""
    return {
        "producto": producto,
        "version_formato": version_formato,
        "motor_version": motor_version,
        "parametros_sha256": huella(),
        "generado_utc": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "uso_si": USO_SI,
        "notas": list(notas or []),
    }


def estado_congelado() -> dict[str, Any]:
    """Compara la huella actual con la registrada al congelar."""
    actual = huella()
    if not CONGELADO.exists():
        return {"congelado": False, "huella_actual": actual, "coincide": False}
    reg = json.loads(CONGELADO.read_text(encoding="utf-8"))
    return {
        "congelado": True,
        "huella_actual": actual,
        "huella_registrada": reg.get("sha256"),
        "coincide": reg.get("sha256") == actual,
        "congelado_utc": reg.get("congelado_utc"),
    }


def congelar(por: str, nota: str = "") -> dict[str, Any]:
    """Registra la huella actual. Se llama UNA vez, antes de ver datos reales.

    Un cambio posterior exige una entrada nueva en CAMBIOS.md y volver a llamar a esta función
    con el motivo en `nota`; el registro anterior queda en el historial del archivo.
    """
    previo = json.loads(CONGELADO.read_text(encoding="utf-8")) if CONGELADO.exists() else None
    reg = {
        "archivo": "parametros/parametros.yaml",
        "sha256": huella(),
        "congelado_utc": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "por": por,
        "nota": nota,
        "historial": ([previo] + previo.get("historial", [])) if previo else [],
    }
    if previo:
        reg["historial"][0].pop("historial", None)
    CONGELADO.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return reg
