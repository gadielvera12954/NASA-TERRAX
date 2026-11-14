"""Contrato de horizontes.bin (esquemas/horizontes_bin.md): codificación, cabecera y regla de consulta."""
import math

import numpy as np
import pytest

from motor.horizonte import formato


def test_codificacion_de_bytes_conocidos():
    e = np.array([2.3, -12.8, -13.0, 12.7, 20.0, -np.inf, 0.05, -0.05, 0.0, np.nan, 0.149, 0.151])
    esperado = [151, 0, 0, 255, 255, 0, 129, 128, 128, 0, 129, 130]
    assert formato.codificar(e).tolist() == esperado


def test_decodificacion_exacta():
    assert formato.decodificar(np.uint8(151)) == 2.3
    assert formato.decodificar(np.uint8(128)) == 0.0
    assert formato.decodificar(np.uint8(0)) == -12.8
    assert formato.decodificar(np.uint8(255)) == 12.7


@pytest.mark.parametrize("az, k", [(0.0, 0), (2.4999, 0), (2.5, 1), (7.5, 2), (357.4, 71), (357.5, 0), (359.99, 0), (180.0, 36)])
def test_indice_de_azimut_con_empate_hacia_arriba(az, k):
    assert formato.indice_azimut(az, 72) == k


def test_igualdad_es_iluminado():
    # e == horizonte decodificado -> iluminado (la sombra exige e < e_h)
    assert formato.en_sombra_byte(151, 2.3) is False
    assert formato.en_sombra_byte(151, 2.2999) is True


def test_escritura_y_lectura_con_cabecera(tmp_path):
    rng = np.random.default_rng(0)
    n_az, alto, ancho = 72, 7, 5
    h = rng.uniform(-15, 15, size=(n_az, alto, ancho)).astype(np.float32)
    ruta = tmp_path / "h.bin"
    meta = formato.escribir(ruta, h, cuerpo="luna", convergencia_deg=31.0, pixel_m=60.0)
    datos = ruta.read_bytes()
    assert len(datos) == 32 + n_az * alto * ancho
    assert datos[:4] == b"TXHZ" and datos[4] == 1 and datos[5] == 0 and datos[6] == 1 and datos[7] == 0
    assert int.from_bytes(datos[8:10], "little") == 72
    assert int.from_bytes(datos[10:12], "little") == 128
    assert int.from_bytes(datos[12:14], "little") == 10
    assert int.from_bytes(datos[16:20], "little") == ancho
    assert int.from_bytes(datos[20:24], "little") == alto
    assert int.from_bytes(datos[24:28], "little", signed=True) == 31000
    assert int.from_bytes(datos[28:32], "little") == 60000
    # orden azimut-mayor: offset = 32 + (k·alto + fila)·ancho + col
    b = formato.codificar(h)
    k, f, c = 13, 4, 2
    assert datos[32 + (k * alto + f) * ancho + c] == b[k, f, c]
    leido = formato.leer(ruta)
    assert leido.bytes.shape == (n_az, alto, ancho)
    assert np.array_equal(leido.bytes, b)
    assert leido.convergencia_deg == 31.0 and leido.pixel_m == 60.0 and leido.cuerpo == "luna"
    assert meta["sha256"] == formato.sha256(ruta)


def test_lectura_rechaza_otro_formato(tmp_path):
    ruta = tmp_path / "malo.bin"
    ruta.write_bytes(b"XXXX" + bytes(28))
    with pytest.raises(ValueError):
        formato.leer(ruta)


def test_sombra_desde_bytes_coincide_con_regla():
    b = np.full((72, 1, 1), 128, dtype=np.uint8)
    b[18, 0, 0] = 160  # azimut 90°: horizonte 3,2°
    assert formato.sombra_desde_bytes(b, 90.0, 3.0)[0, 0]
    assert not formato.sombra_desde_bytes(b, 90.0, 3.2)[0, 0]
    assert not formato.sombra_desde_bytes(b, 95.0, 3.0)[0, 0]   # cae en k = 19
    assert formato.sombra_desde_bytes(b, 92.4, 3.0)[0, 0]       # todavía k = 18
    assert math.isclose(formato.decodificar(np.uint8(160)), 3.2)
