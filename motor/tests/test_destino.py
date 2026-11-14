"""motor/destino: paneles, batería, condiciones críticas y mapa de refugios (F3 a F7, F20).

Respuestas conocidas (documento 02):
  * F3: 0 con el disco tapado, 0,5 con el centro en el horizonte, 1 con el disco entero.
  * F4: con el Sol a 5°, 451 W en una esquina (meta: dentro del 1 % de los 450 W de NASA),
    319 W de frente, 0 W del lado sin panel; dos paneles a 45° con el Sol a 0° dan 452,5 W y con
    el Sol a 5°-7° de 450,8 a 449,2 W.
  * F6: 5.420 Wh / 50 h = 108,4 W.
"""
import datetime as dt
import math

import numpy as np
import pytest

from motor.destino import energia, paridad, png16, refugios, simulacion
from motor.horizonte import formato

UTC = dt.timezone.utc


# ------------------------------------------------------------------ F3 -----------------------
def test_f3_fraccion_del_disco():
    rho = 0.267
    assert energia.fraccion_disco(-rho, 0.0) == 0.0
    assert math.isclose(energia.fraccion_disco(0.0, 0.0), 0.5)
    assert energia.fraccion_disco(rho, 0.0) == 1.0
    assert energia.fraccion_disco(5.0, 0.0) == 1.0 and energia.fraccion_disco(-5.0, 0.0) == 0.0
    for x in (0.1, 0.05, 0.2):
        assert math.isclose(energia.fraccion_disco(x, 0.0) + energia.fraccion_disco(-x, 0.0), 1.0)


# ------------------------------------------------------------------ F4 -----------------------
def test_f4_esquina_de_viper_dentro_del_1_por_ciento():
    p = energia.potencia_total(5.0, 45.0, 0.0)
    assert abs(p - 450.0) / 450.0 <= 0.01
    assert round(p) == 451


def test_f4_frente_y_lado_sin_panel():
    assert round(energia.potencia_total(5.0, 90.0, 0.0)) == 319
    assert energia.potencia_total(5.0, 270.0, 0.0) == 0.0
    assert math.isclose(energia.potencia_total(0.0, 45.0, 0.0), 452.55, abs_tol=0.01)
    assert math.isclose(energia.potencia_total(5.0, 45.0, 0.0), 450.83, abs_tol=0.02)
    assert math.isclose(energia.potencia_total(7.0, 45.0, 0.0), 449.18, abs_tol=0.02)   # doc02: 449,2 W


def test_f4_rumbo_y_disco_tapado():
    # El rumbo ψ resta del azimut del Sol: girar el rover 90° cambia qué panel recibe el Sol.
    assert energia.potencia_total(5.0, 135.0, 90.0) == pytest.approx(energia.potencia_total(5.0, 45.0, 0.0))
    assert energia.potencia_total(5.0, 45.0, 0.0, fsol=0.0) == 0.0
    assert energia.potencia_total(5.0, 45.0, 0.0, fsol=0.5) == pytest.approx(0.5 * energia.potencia_total(5.0, 45.0, 0.0))


def test_f4_rover_inclinado():
    # Sin inclinación coincide con F4; con 15° el panel que mira pendiente abajo baja su normal 15°.
    for a in (0.0, 30.0, 90.0, 200.0):
        assert energia.potencia_total(5.0, a, 0.0, inclinacion_deg=0.0) == pytest.approx(energia.potencia_total(5.0, a, 0.0))
    pend_abajo = energia.potencia_paneles(5.0, 0.0, 0.0, lados_deg=(0.0,), inclinacion_deg=15.0, orientacion_pendiente_deg=0.0)
    assert pend_abajo[0] == pytest.approx(320.0 * math.cos(math.radians(20.0)))
    pend_arriba = energia.potencia_paneles(5.0, 180.0, 0.0, lados_deg=(180.0,), inclinacion_deg=15.0, orientacion_pendiente_deg=0.0)
    assert pend_arriba[0] == pytest.approx(320.0 * math.cos(math.radians(10.0)))


# ------------------------------------------------------------- F5 a F7 ----------------------
def test_f6_cota_de_supervivencia():
    assert math.isclose(energia.p_surv(5420.0, 50.0), 108.4)


def test_f5_bateria_se_vacia_en_50_h_con_p_surv():
    P = np.zeros(80)
    E = energia.bateria(P, 108.4, 1.0, 5420.0, 5420.0)
    assert E[0] == 5420.0
    assert math.isclose(E[50], 0.0, abs_tol=1e-6) and E[60] == 0.0      # nunca negativa
    E2 = energia.bateria(np.full(10, 1000.0), 60.0, 1.0, 5420.0, 5000.0)
    assert E2.max() == 5420.0                                           # nunca pasa de E_max


def test_f7_tramo_oscuro_y_condiciones():
    P = np.array([300] * 5 + [50] * 60 + [300] * 5 + [0] * 20, dtype=float)
    assert energia.tramo_oscuro(P, 108.4, 1.0) == 60.0
    c = energia.condiciones(tramo_oscuro_h=60.0, bateria_min_wh=900.0, reserva_wh=1084.0, pendiente_deg=12.0)
    assert c == {"oscuridad": True, "bateria": True, "pendiente": False}
    assert energia.en_riesgo(c)
    c2 = energia.condiciones(tramo_oscuro_h=50.0, bateria_min_wh=2000.0, reserva_wh=1084.0, pendiente_deg=15.0)
    assert not energia.en_riesgo(c2)                                     # 50 h y 15° todavía no son "más de"


# ------------------------------------------------------------------ F20 ----------------------
@pytest.fixture(scope="module")
def grilla_mons_mouton():
    from motor.horizonte import geometria as g
    R = 1737400.0
    x, y = g.xy_desde_latlon_polar_sur(-84.60, 31.00, R)
    meta = {"nombre": "mini", "cuerpo": "luna", "pixel_m": 60.0, "x0_m": float(x) - 60.0, "y0_m": float(y) + 60.0,
            "proyeccion": {"tipo": "polar_estereografica_sur", "radio_m": R, "lon0_deg": 0.0}, "fuentes": [], "maqueta": True}
    return meta


def test_f20_horizonte_liso_da_la_noche_de_la_lunacion(grilla_mons_mouton):
    from motor.horizonte import Capa
    from motor.horizonte.grilla import convergencia, latlon
    from motor.sol import lunacion
    capa = Capa(np.zeros((3, 3), dtype=np.float32), 60.0, grilla_mons_mouton["x0_m"], grilla_mons_mouton["y0_m"])
    lat, lon = latlon(capa, grilla_mons_mouton)
    conv = convergencia(capa, grilla_mons_mouton)
    h = np.zeros((72, 3, 3), dtype=np.float64)
    h[:, 0, 0] = 12.7           # píxel encerrado: nunca ve el Sol
    h[:, 0, 1] = -12.8          # píxel sin horizonte: en verano el Sol baja solo a −4,07°
    desde, hasta = dt.datetime(2027, 10, 27, tzinfo=UTC), dt.datetime(2027, 11, 26, tzinfo=UTC)
    r = refugios.mapa_refugios(h, lat, lon, conv, desde, hasta, margen_dias=16.0, paso_h=1.0)
    noche = max(n["horas"] for n in lunacion.noches_que_tocan(-84.60, 31.00, desde, hasta, 1.0))
    assert abs(r["horas"][1, 1] - noche) <= 2.0
    assert r["horas"][0, 1] == 0.0
    assert r["horas"][0, 0] >= 29 * 24                    # oscuro toda la serie
    assert not r["refugio"][1, 1] and r["refugio"][0, 1] and not r["refugio"][0, 0]
    assert 0.0 <= r["iluminacion"][1, 1] <= 1.0 and r["iluminacion"][0, 1] == 1.0 and r["iluminacion"][0, 0] == 0.0


def test_png16_ida_y_vuelta(tmp_path):
    a = np.array([[0, 50, 65535], [720, 1, 300]], dtype=np.uint16)
    ruta = tmp_path / "x.png"
    png16.escribir(ruta, a)
    assert ruta.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    assert np.array_equal(png16.leer(ruta), a)


# ------------------------------------------------------------ simulación ---------------------
def test_rover_en_horizonte_liso_no_sobrevive_la_noche():
    desde, hasta = dt.datetime(2027, 10, 27, tzinfo=UTC), dt.datetime(2027, 11, 26, tzinfo=UTC)
    r = simulacion.simular_punto(-84.60, 31.00, desde, hasta, horizonte_360=None, rumbo="sol-en-esquina")
    assert r["noche_geometrica_h"] > 280
    # El tramo con menos de 108,4 W (F7) es apenas más corto que la noche geométrica (centro del
    # Sol bajo el horizonte): con el Sol en una esquina, un cuarto del disco ya da más de 108 W.
    assert 0 <= r["noche_geometrica_h"] - r["tramo_oscuro_mas_largo_h"] <= 12
    assert r["tramo_oscuro_mas_largo_h"] > 280
    assert r["condiciones"]["oscuridad"] and r["condiciones"]["bateria"] and r["en_riesgo"]
    assert r["bateria_minima_wh"] == 0.0
    assert 0.5 < r["sol_en_paneles_frac"] < 0.65


def test_rover_con_horizonte_bajo_si_sobrevive():
    # Un punto que ve el horizonte 5° más abajo en toda dirección (como el de 5 km del doc02 §5.1)
    # no pierde nunca el Sol en verano (mínimo −4,07°).
    desde, hasta = dt.datetime(2027, 10, 27, tzinfo=UTC), dt.datetime(2027, 11, 26, tzinfo=UTC)
    r = simulacion.simular_punto(-84.60, 31.00, desde, hasta, horizonte_360=np.full(360, -5.0), rumbo="sol-en-esquina")
    assert r["noche_geometrica_h"] == 0.0
    assert not r["condiciones"]["oscuridad"] and not r["en_riesgo"]


# ------------------------------------------------------------- paridad -----------------------
def test_archivo_de_paridad(tmp_path):
    rng = np.random.default_rng(3)
    h = rng.uniform(-6, 9, size=(72, 20, 30))
    ruta = tmp_path / "horizontes.bin"
    formato.escribir(ruta, h, cuerpo="luna", convergencia_deg=31.0, pixel_m=60.0)
    p = paridad.generar(ruta, n=1000, semilla=11, maqueta=True)
    from esquemas.validar import validar
    validar(p, "paridad")
    assert len(p["casos"]) == 1000
    hz = formato.leer(ruta)
    tipos = {c["tipo"] for c in p["casos"]}
    assert {"azar", "cerca_del_umbral", "empate", "borde_de_azimut", "vuelta_de_360"} <= tipos
    for c in p["casos"]:
        k = formato.indice_azimut(c["az"], 72)
        b = int(hz.bytes[k, c["fila"], c["col"]])
        assert c["k"] == k and c["byte"] == b
        assert c["sombra"] == formato.en_sombra_byte(b, c["el"])
        if c["tipo"] == "empate":
            assert c["sombra"] is False
