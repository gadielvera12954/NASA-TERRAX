"""Parámetros congelados y forma de todo lo que la Parte 3 deja en salida/."""
import json
import pathlib

import pytest

import parametros
from esquemas.validar import validar
from motor.destino import png16
from motor.horizonte import formato

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "salida"


def test_parametros_congelados_sin_cambios_sin_registrar():
    e = parametros.estado_congelado()
    assert e["congelado"], "parametros.yaml todavía no se congeló"
    assert e["coincide"], ("parametros.yaml cambió después de congelarlo: anotar el cambio en parametros/CAMBIOS.md "
                           "y volver a congelar con parametros.congelar(por=..., nota=...)")


def test_pesos_suman_uno_y_todo_hueco_esta_marcado():
    p = parametros.cargar()
    assert sum(p["pesos"].values()) == pytest.approx(1.0)
    for clave in p["confirmar"]:
        parametros.obtener(clave)                 # cada clave a confirmar existe


ESQUEMA = {"sol": "sol", "fichas": "tarjeta", "destino": "destino"}


def _salidas():
    if not SALIDA.exists():
        return []
    return [p for p in SALIDA.rglob("*.json") if "maqueta" not in p.relative_to(SALIDA).parts[:1]]


@pytest.mark.parametrize("ruta", _salidas(), ids=lambda p: str(p.relative_to(SALIDA)))
def test_cada_salida_cumple_su_esquema(ruta):
    obj = json.loads(ruta.read_text(encoding="utf-8"))
    rel = ruta.relative_to(SALIDA)
    if rel.name == "pruebas.json":
        validar(obj, "pruebas")
    elif rel.name == "indice.json":
        validar(obj, "fichas_indice")
    elif rel.name == "paridad.json":
        validar(obj, "paridad")
    elif rel.name == "horizontes.json":
        validar({**obj, "archivo": obj["archivo"]}, "horizontes_meta")
    elif rel.name == "manifest_parte3.json":
        assert all(len(a["sha256"]) == 64 for a in obj["archivos"])
    elif rel.parts[0] in ESQUEMA:
        validar(obj, ESQUEMA[rel.parts[0]])
    if rel.name != "manifest_parte3.json":
        assert "maqueta" in obj, "todo archivo lleva la marca maqueta (true o false)"


def test_binarios_y_mapas_se_leen():
    b = SALIDA / "destino" / "horizontes.bin"
    if not b.exists():
        pytest.skip("todavía no se corrió python -m motor.destino")
    hz = formato.leer(b)
    assert hz.n_az == 72
    for n in ("verano", "invierno"):
        m = png16.leer(SALIDA / "destino" / f"refugios_{n}.png")
        assert m.shape == (hz.alto, hz.ancho)


def test_manifiesto_coincide_con_los_archivos():
    import hashlib
    m = SALIDA / "manifest_parte3.json"
    if not m.exists():
        pytest.skip("todavía no se corrió python -m motor.tests.informe")
    for a in json.loads(m.read_text(encoding="utf-8"))["archivos"]:
        p = SALIDA / a["archivo"]
        assert hashlib.sha256(p.read_bytes()).hexdigest() == a["sha256"], f"{a['archivo']} cambió después del manifiesto"
