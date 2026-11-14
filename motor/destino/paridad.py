"""Archivo de paridad Python ↔ navegador: 1.000 casos de píxel, Sol y resultado esperado.

Los casos se calculan con la regla exacta de esquemas/horizontes_bin.md sobre los bytes del mismo
horizontes.bin que lee el navegador. Los valores de azimut y altura se redondean a 3 decimales ANTES
de calcular el resultado, así el navegador lee de JSON exactamente los mismos números.

Mezcla de casos, para que la prueba encuentre los errores típicos:
    azar (550)              píxel, azimut y altura al azar
    cerca_del_umbral (150)  altura a menos de 0,05° del horizonte
    empate (100)            altura igual al horizonte: tiene que dar iluminado
    borde_de_azimut (150)   azimut justo en la mitad entre dos sectores (5k + 2,5 → k + 1)
    vuelta_de_360 (50)      azimut cerca de 360° (tiene que volver a k = 0)

Uso de SI: redactado con Claude Code; probado en test_destino.py.
"""
from __future__ import annotations

import pathlib

import numpy as np

import parametros
from motor import __version__
from motor.horizonte import formato

RANGO_E = {"luna": (-8.3, 10.0), "tierra": (1.5, 10.0), "sintetico": (-5.0, 10.0)}


def generar(ruta_bin, n: int = 1000, semilla: int = 20261115, maqueta: bool = False) -> dict:
    ruta_bin = pathlib.Path(ruta_bin)
    hz = formato.leer(ruta_bin)
    rng = np.random.default_rng(semilla)
    n_az, alto, ancho = hz.bytes.shape
    paso = 360.0 / n_az
    e_min, e_max = RANGO_E.get(hz.cuerpo, (-5.0, 10.0))
    cupos = {"azar": 550, "cerca_del_umbral": 150, "empate": 100, "borde_de_azimut": 150, "vuelta_de_360": 50}
    escala = n / sum(cupos.values())
    cupos = {k: int(round(v * escala)) for k, v in cupos.items()}
    cupos["azar"] += n - sum(cupos.values())
    casos = []

    def agregar(tipo, fila, col, az, el):
        az = round(float(az) % 360.0, 3)
        if az >= 360.0:
            az = 0.0
        el = round(float(el), 3)
        k = formato.indice_azimut(az, n_az)
        b = int(hz.bytes[k, fila, col])
        casos.append({"fila": int(fila), "col": int(col), "az": az, "el": el, "k": k, "byte": b,
                      "horizonte_deg": float(formato.decodificar(b)), "sombra": formato.en_sombra_byte(b, el), "tipo": tipo})

    for _ in range(cupos["azar"]):
        agregar("azar", rng.integers(alto), rng.integers(ancho), rng.uniform(0, 360), rng.uniform(e_min, e_max))
    for _ in range(cupos["cerca_del_umbral"]):
        f, c, k = rng.integers(alto), rng.integers(ancho), rng.integers(n_az)
        az = k * paso + rng.uniform(-0.45, 0.45) * paso
        h = float(formato.decodificar(hz.bytes[k, f, c]))
        delta = rng.uniform(0.001, 0.049) * rng.choice([-1.0, 1.0])
        agregar("cerca_del_umbral", f, c, az, h + delta)
    for _ in range(cupos["empate"]):
        f, c, k = rng.integers(alto), rng.integers(ancho), rng.integers(n_az)
        az = k * paso + rng.uniform(-0.45, 0.45) * paso
        h = float(formato.decodificar(hz.bytes[formato.indice_azimut(round(az % 360.0, 3), n_az), f, c]))
        agregar("empate", f, c, az, round(h, 1))
    for i in range(cupos["borde_de_azimut"]):
        f, c, k = rng.integers(alto), rng.integers(ancho), rng.integers(n_az - 1)
        az = k * paso + (paso / 2.0 if i % 2 == 0 else paso / 2.0 - 0.001)
        agregar("borde_de_azimut", f, c, az, rng.uniform(e_min, e_max))
    for i in range(cupos["vuelta_de_360"]):
        f, c = rng.integers(alto), rng.integers(ancho)
        az = [357.5, 358.2, 359.999, 0.0, 2.499][i % 5]
        agregar("vuelta_de_360", f, c, az, rng.uniform(e_min, e_max))

    return {
        "formato": "TXHZ v1",
        "archivo_horizontes": ruta_bin.name,
        "sha256_horizontes": formato.sha256(ruta_bin),
        "regla": "k = floor(A / (360/n_az) + 0.5) mod n_az; e_h = (b - 128) / 10; sombra = e < e_h (igual = iluminado)",
        "ancho": int(ancho),
        "alto": int(alto),
        "n_az": int(n_az),
        "casos": casos,
        "maqueta": bool(maqueta),
        "meta": parametros.bloque_meta("paridad", __version__, notas=[
            "Cada caso tiene que dar lo mismo en el navegador (prueba de Erwan con Vitest).",
        ]),
    }
