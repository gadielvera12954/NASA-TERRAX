"""Lectura y escritura de horizontes.bin (formato TXHZ v1, ver esquemas/horizontes_bin.md).

Este módulo ES el contrato en Python: la regla de consulta `indice_azimut` + `en_sombra` es la misma
que aplica el navegador, y el archivo de paridad se calcula con estas funciones sobre los mismos
bytes.

Uso de SI: redactado con Claude Code; probado en motor/tests/test_formato_horizontes.py.
"""
from __future__ import annotations

import dataclasses
import hashlib
import math
import pathlib
import struct

import numpy as np

MAGIA = b"TXHZ"
VERSION = 1
CABECERA = 32
DESPLAZAMIENTO = 128
DIVISOR = 10
ORDEN_AZIMUT_MAYOR = 0
REFERENCIA_NORTE_GRILLA = 0
CUERPOS = {"sintetico": 0, "luna": 1, "tierra": 2}
CUERPOS_INV = {v: k for k, v in CUERPOS.items()}
_FMT = "<4sBBBBHHHHIIiI"  # 4+1+1+1+1+2+2+2+2+4+4+4+4 = 32 bytes
assert struct.calcsize(_FMT) == CABECERA


def codificar(e_deg) -> np.ndarray:
    """Ángulo en grados → byte: b = clip(floor(e·10 + 0,5) + 128, 0, 255). NaN y −∞ → 0."""
    e = np.asarray(e_deg, dtype=np.float64)
    b = np.floor(e * DIVISOR + 0.5) + DESPLAZAMIENTO
    b = np.where(np.isfinite(b), b, np.where(e > 0, 255.0, 0.0))
    b = np.where(np.isnan(e), 0.0, b)
    return np.clip(b, 0, 255).astype(np.uint8)


def decodificar(b):
    """Byte → ángulo en grados: (b − 128) / 10 (misma operación que en el navegador)."""
    return (np.asarray(b, dtype=np.float64) - float(DESPLAZAMIENTO)) / float(DIVISOR)


def indice_azimut(az_deg: float, n_az: int = 72) -> int:
    """k = floor(A / paso + 0,5) mod n_az, con paso = 360 / n_az (azimut más cercano, empate hacia arriba)."""
    paso = 360.0 / n_az
    return int(math.floor(az_deg / paso + 0.5)) % n_az


def indice_azimut_arreglo(az_deg, n_az: int = 72) -> np.ndarray:
    paso = 360.0 / n_az
    return (np.floor(np.asarray(az_deg, dtype=np.float64) / paso + 0.5).astype(np.int64)) % n_az


def en_sombra_byte(b: int, e_deg: float) -> bool:
    """Regla única: en sombra si e < e_h (igual = iluminado)."""
    return bool(e_deg < (float(b) - DESPLAZAMIENTO) / DIVISOR)


def sombra_desde_bytes(bytes_hz: np.ndarray, az_deg: float, e_deg: float) -> np.ndarray:
    """Máscara de sombra de toda la grilla para un Sol (A en azimut de grilla, e en grados)."""
    k = indice_azimut(az_deg, bytes_hz.shape[0])
    return e_deg < decodificar(bytes_hz[k])


@dataclasses.dataclass
class Horizontes:
    """Contenido de un horizontes.bin ya leído."""

    bytes: np.ndarray          # (n_az, alto, ancho) uint8
    cuerpo: str
    convergencia_deg: float
    pixel_m: float

    @property
    def n_az(self) -> int:
        return int(self.bytes.shape[0])

    @property
    def alto(self) -> int:
        return int(self.bytes.shape[1])

    @property
    def ancho(self) -> int:
        return int(self.bytes.shape[2])

    def grados(self) -> np.ndarray:
        return decodificar(self.bytes)

    def sombra(self, az_grilla_deg: float, e_deg: float) -> np.ndarray:
        return sombra_desde_bytes(self.bytes, az_grilla_deg, e_deg)


def sha256(ruta) -> str:
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def cabecera(n_az: int, alto: int, ancho: int, cuerpo: str, convergencia_deg: float, pixel_m: float) -> bytes:
    return struct.pack(
        _FMT, MAGIA, VERSION, ORDEN_AZIMUT_MAYOR, CUERPOS[cuerpo], REFERENCIA_NORTE_GRILLA,
        n_az, DESPLAZAMIENTO, DIVISOR, 0, ancho, alto, int(round(convergencia_deg * 1000.0)), int(round(pixel_m * 1000.0)),
    )


def escribir(ruta, horizontes_deg: np.ndarray, cuerpo: str, convergencia_deg: float, pixel_m: float) -> dict:
    """Escribe el archivo y devuelve sus metadatos (para manifest.json)."""
    h = np.asarray(horizontes_deg)
    if h.ndim != 3:
        raise ValueError("se esperan horizontes con forma (n_az, alto, ancho)")
    n_az, alto, ancho = h.shape
    datos = h if h.dtype == np.uint8 else codificar(h)
    ruta = pathlib.Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "wb") as fh:
        fh.write(cabecera(n_az, alto, ancho, cuerpo, convergencia_deg, pixel_m))
        fh.write(np.ascontiguousarray(datos, dtype=np.uint8).tobytes(order="C"))
    return {
        "archivo": ruta.name,
        "formato": "TXHZ v1",
        "sha256": sha256(ruta),
        "ancho": int(ancho),
        "alto": int(alto),
        "n_az": int(n_az),
        "pixel_m": float(pixel_m),
        "convergencia_deg": float(round(convergencia_deg * 1000.0) / 1000.0),
        "cuerpo": cuerpo,
    }


def leer(ruta) -> Horizontes:
    datos = pathlib.Path(ruta).read_bytes()
    if len(datos) < CABECERA:
        raise ValueError("horizontes.bin: archivo demasiado corto")
    (magia, version, orden, cuerpo, ref, n_az, desp, div, _res, ancho, alto, conv_mdeg, pixel_mm) = struct.unpack(_FMT, datos[:CABECERA])
    if magia != MAGIA or version != VERSION:
        raise ValueError("horizontes.bin: formato desconocido (se espera TXHZ v1)")
    if orden != ORDEN_AZIMUT_MAYOR or ref != REFERENCIA_NORTE_GRILLA or desp != DESPLAZAMIENTO or div != DIVISOR:
        raise ValueError("horizontes.bin: variante no admitida por esta versión")
    esperado = CABECERA + n_az * alto * ancho
    if len(datos) != esperado:
        raise ValueError(f"horizontes.bin: {len(datos)} bytes, se esperaban {esperado}")
    arr = np.frombuffer(datos, dtype=np.uint8, offset=CABECERA).reshape(n_az, alto, ancho)
    return Horizontes(bytes=arr, cuerpo=CUERPOS_INV.get(cuerpo, "sintetico"), convergencia_deg=conv_mdeg / 1000.0,
                      pixel_m=pixel_mm / 1000.0)
