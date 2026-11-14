"""PNG en escala de grises de 16 bits, solo con la biblioteca estándar (zlib).

Se usa para destino/refugios_{verano,invierno}.png: cada píxel guarda las horas seguidas sin Sol
(0 a 65534) y 65535 significa "sin dato".

Uso de SI: redactado con Claude Code; probado en test_destino.py.
"""
from __future__ import annotations

import pathlib
import struct
import zlib

import numpy as np

FIRMA = b"\x89PNG\r\n\x1a\n"
SIN_DATO = 65535


def _chunk(tipo: bytes, datos: bytes) -> bytes:
    return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)


def escribir(ruta, a: np.ndarray, texto: dict | None = None) -> None:
    a = np.asarray(a)
    if a.ndim != 2:
        raise ValueError("se espera una matriz 2D")
    alto, ancho = a.shape
    datos = np.ascontiguousarray(a.astype(">u2"))
    crudo = b"".join(b"\x00" + datos[f].tobytes() for f in range(alto))
    partes = [FIRMA, _chunk(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 16, 0, 0, 0, 0))]
    for clave, valor in (texto or {}).items():
        partes.append(_chunk(b"tEXt", clave.encode("latin-1") + b"\x00" + str(valor).encode("latin-1", "replace")))
    partes += [_chunk(b"IDAT", zlib.compress(crudo, 9)), _chunk(b"IEND", b"")]
    ruta = pathlib.Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"".join(partes))


def leer(ruta) -> np.ndarray:
    """Lee un PNG escrito por `escribir` (gris, 16 bits, sin entrelazado, filtro 0)."""
    b = pathlib.Path(ruta).read_bytes()
    if b[:8] != FIRMA:
        raise ValueError("no es un PNG")
    i, idat, ancho, alto = 8, b"", 0, 0
    while i < len(b):
        n = struct.unpack(">I", b[i:i + 4])[0]
        tipo = b[i + 4:i + 8]
        datos = b[i + 8:i + 8 + n]
        if tipo == b"IHDR":
            ancho, alto, prof, color, _, _, entre = struct.unpack(">IIBBBBB", datos)
            if prof != 16 or color != 0 or entre != 0:
                raise ValueError("solo PNG gris de 16 bits sin entrelazado")
        elif tipo == b"IDAT":
            idat += datos
        i += 12 + n
    crudo = zlib.decompress(idat)
    paso = 1 + 2 * ancho
    filas = []
    for f in range(alto):
        linea = crudo[f * paso:(f + 1) * paso]
        if linea[0] != 0:
            raise ValueError("filtro PNG no admitido")
        filas.append(np.frombuffer(linea[1:], dtype=">u2"))
    return np.stack(filas).astype(np.uint16)
