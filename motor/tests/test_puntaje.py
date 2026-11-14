"""motor/puntaje: Wasserstein, utilidad, C, E, L, U, etiquetas y robustez (F10 a F12, F18).

Respuestas conocidas (documento 02):
  * F11, caso a mano: C = 0,94 y E = 0,75 → L = 0,705 y U = 0,955; C = 0,82 y E = 0,70 → 0,574 y 0,874.
  * Figura 4: A (0,90; 0,85) → Análogo sostenido; B (0,82; 0,70) → Con huecos; C (0,50; 0,80) → No alcanza.
  * Regla de etiquetas: requisito incumplido → Incompatible; desconocido o E < 0,50 → No podemos
    concluir; U < θ → No alcanza; L ≥ θ → Análogo sostenido; si no → Con huecos.
  * Controles: el propio recorte de Mons Mouton primero, sus copias con ruido en orden y la parcela
    con vegetación "Incompatible".
"""
import math

import numpy as np
import pytest
from scipy.stats import wasserstein_distance

import parametros
from motor.puntaje import compatibilidad, decision, distancias, fichas, robustez
from motor.tests import sinteticos


@pytest.fixture(scope="module")
def prm():
    return parametros.cargar()


# ------------------------------------------------------------------ F10, F18, F11 -------------
def test_f11_caso_a_mano():
    assert compatibilidad.limites(0.94, 0.75) == pytest.approx((0.705, 0.955))
    assert compatibilidad.limites(0.82, 0.70) == pytest.approx((0.574, 0.874))


def test_f18_utilidad():
    assert distancias.utilidad(0.0, 3.0) == 1.0
    assert distancias.utilidad(3.0, 3.0) == pytest.approx(math.exp(-1))
    assert distancias.utilidad(30.0, 3.0) < 1e-4


def test_f10_wasserstein_por_cuantiles_coincide_con_scipy():
    rng = np.random.default_rng(0)
    a, b = rng.gamma(3.0, 2.0, 5000), rng.gamma(4.0, 2.0, 5000)
    w_q = distancias.w1({"cuantiles": distancias.cuantiles({"valores": a.tolist()})},
                        {"cuantiles": distancias.cuantiles({"valores": b.tolist()})})
    w_v = distancias.w1({"valores": a.tolist()}, {"valores": b.tolist()})
    assert w_v == pytest.approx(wasserstein_distance(a, b), rel=1e-9)
    assert w_q == pytest.approx(w_v, rel=0.02)
    assert distancias.w1({"valores": [1.0, 2.0, 3.0]}, {"valores": [3.0, 4.0, 5.0]}) == pytest.approx(2.0)
    assert distancias.w1({"valores": [1.0, 2.0]}, {"valores": [1.0, 2.0]}) == 0.0


def test_distancia_de_luz_rasante():
    e = [1.5, 2.0, 2.5]
    assert distancias.distancia_luz({"e_deg": e, "f_media": [0.5, 0.4, 0.3]}, {"e_deg": e, "f_media": [0.5, 0.4, 0.3]}) == 0.0
    assert distancias.distancia_luz({"e_deg": e, "f_media": [0.6, 0.5, 0.4]}, {"e_deg": e, "f_media": [0.5, 0.4, 0.3]}) == pytest.approx(0.1)
    with pytest.raises(ValueError):
        distancias.distancia_luz({"e_deg": [1.5, 2.0], "f_media": [0.5, 0.4]}, {"e_deg": e, "f_media": [0.5, 0.4, 0.3]})


# ------------------------------------------------------------------ etiquetas ----------------
@pytest.mark.parametrize("req, E, L, U, esperado", [
    ({"vegetacion": "incumple", "pendiente": "cumple"}, 0.8, 0.79, 0.99, "incompatible"),
    ({"vegetacion": "desconocido", "pendiente": "cumple"}, 0.8, 0.79, 0.99, "no_podemos_concluir"),
    ({"vegetacion": "cumple", "pendiente": "cumple"}, 0.45, 0.40, 0.95, "no_podemos_concluir"),
    ({"vegetacion": "cumple", "pendiente": "cumple"}, 0.8, 0.40, 0.60, "no_alcanza"),
    ({"vegetacion": "cumple", "pendiente": "cumple"}, 0.8, 0.72, 0.92, "analogo_sostenido"),
    ({"vegetacion": "cumple", "pendiente": "cumple"}, 0.7, 0.574, 0.874, "con_huecos"),
])
def test_regla_de_etiquetas(req, E, L, U, esperado):
    assert compatibilidad.etiqueta(req, E, L, U, umbral=0.70, e_min=0.50) == esperado


def test_figura_4_del_documento():
    cumple = {"vegetacion": "cumple", "pendiente": "cumple"}
    for C, E, esperado in [(0.90, 0.85, "analogo_sostenido"), (0.82, 0.70, "con_huecos"), (0.50, 0.80, "no_alcanza")]:
        L, U = compatibilidad.limites(C, E)
        assert compatibilidad.etiqueta(cumple, E, L, U, 0.70, 0.50) == esperado


def test_requisitos(prm):
    base = {"ndvi_p90": 0.10, "pendiente_mediana_deg": 8.0}
    assert compatibilidad.requisitos(base, prm)["vegetacion"]["estado"] == "cumple"
    assert compatibilidad.requisitos({**base, "ndvi_p90": 0.20}, prm)["vegetacion"]["estado"] == "incumple"
    assert compatibilidad.requisitos({**base, "ndvi_p90": None}, prm)["vegetacion"]["estado"] == "desconocido"
    assert compatibilidad.requisitos({**base, "pendiente_mediana_deg": 15.0}, prm)["pendiente"]["estado"] == "incumple"


def test_evidencia_cuenta_solo_lo_medido(prm):
    datos = sinteticos.distribuciones_maqueta()
    ref = datos["referencia"]
    ev = compatibilidad.evaluar(ref, ref, prm)                 # el recorte contra sí mismo
    assert ev["C"] == pytest.approx(1.0)
    assert ev["E"] == pytest.approx(0.80)                       # material y transitabilidad fina faltan
    assert ev["L"] == pytest.approx(0.80) and ev["U"] == pytest.approx(1.0)
    assert ev["propiedades"]["material"]["estado"] == "faltante"


# ------------------------------------------------------------------ controles ----------------
@pytest.fixture(scope="module")
def corrida(prm):
    return fichas.puntuar(sinteticos.distribuciones_maqueta(), prm, con_horario=False)


def test_controles_caen_donde_deben(corrida):
    c = corrida["indice"]["controles"]
    assert c["recorte_primero"] is True
    assert c["copias_en_orden"] is True
    assert c["vegetacion_rechazada"] is True
    assert c["confiable"] is True


def test_robustez_reproducible_y_normalizada(prm):
    datos = sinteticos.distribuciones_maqueta()
    a = fichas.puntuar(datos, prm, con_horario=False)
    b = fichas.puntuar(datos, prm, con_horario=False)
    fa = {f["id"]: f["robustez"]["primera_frac"] for f in a["fichas"]}
    fb = {f["id"]: f["robustez"]["primera_frac"] for f in b["fichas"]}
    assert fa == fb
    # La robustez se cuenta entre las candidatas reales (los controles no compiten con ellas)...
    reales = [f for f in a["fichas"] if f["control"] is None and f["etiqueta"] != "incompatible"]
    assert sum(f["robustez"]["primera_frac"] for f in reales) == pytest.approx(1.0)
    assert all(f["robustez"]["primera_frac"] is None for f in a["fichas"] if f["control"] is not None)
    # ...y el recorte de Mons Mouton tiene que quedar primero con casi cualquier peso.
    assert a["indice"]["controles"]["recorte_primero_frac"] > 0.95


def test_dirichlet_alrededor_de_los_pesos(prm):
    w = robustez.muestras_pesos(prm["pesos"], 1000, 100, 1)
    assert w.shape == (1000, 5)
    assert np.allclose(w.sum(axis=1), 1.0)
    assert np.allclose(w.mean(axis=0), [0.3, 0.3, 0.2, 0.1, 0.1], atol=0.01)


def test_dato_que_cambia_la_decision(prm):
    # Candidata con C = 0,85 y E = 0,80: L = 0,68 < 0,70 ≤ U = 0,88 → "Con huecos". Si el material
    # resultara perfecto: C = 0,867, E = 0,90, L = 0,78 → "Análogo sostenido". Si fuera pésimo, sigue con huecos.
    props = {"pendiente": 0.85, "luz_rasante": 0.85, "rugosidad": 0.85, "material": None, "transitabilidad_fina": None}
    req = {"vegetacion": "cumple", "pendiente": "cumple"}
    cambios = decision.dato_que_cambia("X", {"X": props, "Y": {k: 0.5 for k in props}}, {"X": req, "Y": req}, prm)
    por_prop = {c["propiedad"]: c for c in cambios}
    assert set(por_prop) == {"material", "transitabilidad_fina"}
    assert por_prop["material"]["mejor"]["etiqueta"] == "analogo_sostenido"
    assert por_prop["material"]["peor"]["etiqueta"] == "con_huecos"
    assert por_prop["material"]["cambia_etiqueta"] is True
    assert por_prop["material"]["cambia_primer_lugar"] is False          # X queda primera igual
    assert decision.medir_primero(cambios, prm)[0] == "material"


def test_fichas_validan_contra_el_esquema(corrida):
    from esquemas.validar import validar
    for f in corrida["fichas"]:
        validar(f, "tarjeta")
    validar(corrida["indice"], "fichas_indice")
    assert all(f["maqueta"] for f in corrida["fichas"])
    nunca = [f for f in corrida["fichas"] if "%" in str(f.get("veredicto", ""))]
    assert not nunca


def test_horario_de_una_candidata_de_payunia(prm):
    datos = sinteticos.distribuciones_maqueta()
    datos["parcelas"] = [p for p in datos["parcelas"] if p["id"] == "P-07"]
    out = fichas.puntuar(datos, prm, con_horario=True, dias=1)
    f = out["fichas"][0]
    tarde = [v for v in f["horario"] if v["tipo"] == "atardecer"][0]
    assert tarde["fecha"] == "2026-11-14"
    assert tarde["desde"][:2] == "19" and tarde["hasta"][:2] == "20"
