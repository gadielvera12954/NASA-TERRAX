"""motor/sol: Skyfield con DE421, control contra JPL Horizons y refracción en la Tierra (F15).

Respuestas conocidas (documento 02):
  * F15 a nivel del mar: el Sol sube 0,32° a 1,5° y 0,16° a 5°; ignorarla da 3,2 % de error en
    la sombra a 5°, 1,8 % a 7°, 0,9 % a 10° y 0,4 % a 15°.
  * Meta "Sol en la Luna": menos de 0,1° frente a Horizons.
  * Tabla 5.2: horarios del 14/11/2026 (UTC−3) con el Sol a 15°, 7°, 5° y 1,5°.
  * Sección 5.1: Sol máximo 6,96° (centro), 6,77° (IM-2), 8,26° (borde norte), 5,34° (borde sur);
    lunación de verano con pico de 6,94°, de invierno con pico de 3,87°.
"""
import datetime as dt
import math

import numpy as np
import pytest

from motor.sol import horizons, lunacion, posicion, refraccion, ventanas

UTC = dt.timezone.utc


# ---------------------------------------------------------------- F15 -------------------------
def test_f15_numeros_del_documento():
    assert math.isclose(refraccion.saemundsson_deg(1.5), 0.32, abs_tol=0.005)
    assert math.isclose(refraccion.saemundsson_deg(5.0), 0.16, abs_tol=0.005)
    for e, pct in [(5, 3.2), (7, 1.8), (10, 0.9), (15, 0.4)]:
        ap = e + refraccion.saemundsson_deg(e)
        efecto = 100 * (math.tan(math.radians(ap)) / math.tan(math.radians(e)) - 1)
        assert round(efecto, 1) == pct


def test_f15_menos_presion_menos_refraccion():
    p = refraccion.presion_estandar_mbar(3400.0)
    assert 660 < p < 680
    assert refraccion.saemundsson_deg(1.5, presion_mbar=p) < 0.75 * refraccion.saemundsson_deg(1.5)
    assert refraccion.saemundsson_deg(1.5, presion_mbar=0.0) == 0.0     # en la Luna R = 0


# ------------------------------------------------------ Skyfield contra Horizons ---------------
@pytest.mark.parametrize("nombre, lat, lon", [
    ("luna_mons_mouton_centro_2027_2028", -84.60, 31.00),
    ("luna_im2_athena_2027_2028", -84.7906, 29.1957),
    ("luna_mons_mouton_norte_2027_2028", -83.30, 31.00),
    ("luna_mons_mouton_sur_2027_2028", -86.22, 31.00),
])
def test_sol_en_la_luna_contra_horizons(nombre, lat, lon):
    ref = horizons.leer_csv(horizons.REFERENCIA / f"{nombre}.csv")
    sel = slice(None, None, 12)                         # una muestra por día: 731 instantes
    t = [r[0] for r in ref.filas][sel]
    az, el = posicion.sol_luna(lat, lon, t)
    az_h = np.array([r[1] for r in ref.filas])[sel]
    el_h = np.array([r[2] for r in ref.filas])[sel]
    d_el = np.abs(el - el_h)
    d_az = np.abs((az - az_h + 180) % 360 - 180)
    assert d_el.max() < 0.1 and d_az.max() < 0.1


def test_sol_en_la_tierra_contra_horizons():
    ref = horizons.leer_csv(horizons.REFERENCIA / "tierra_cde_2026-11-14_geometrica.csv")
    t = [r[0] for r in ref.filas]
    az, el_geo, el_ap = posicion.sol_tierra(-25.51, -54.61, 200.0, t, refraccion=False)
    assert np.abs(el_geo - np.array([r[2] for r in ref.filas])).max() < 0.1
    ref_r = horizons.leer_csv(horizons.REFERENCIA / "tierra_cde_2026-11-14_refractada.csv")
    t = [r[0] for r in ref_r.filas]
    az, el_geo, el_ap = posicion.sol_tierra(-25.51, -54.61, 200.0, t, refraccion=True, presion_mbar=1010.0)
    el_h = np.array([r[2] for r in ref_r.filas])
    visible = el_h > 0.5
    assert np.abs(el_ap[visible] - el_h[visible]).max() < 0.1


def test_vector_del_sol_en_marco_lunar_da_lo_mismo_que_skyfield():
    # El método rápido (un vector por hora y una base local por píxel) es el que usan F20 y F13.
    t = [dt.datetime(2027, 11, 1, h, tzinfo=UTC) for h in range(0, 24, 3)]
    s = posicion.vector_sol_luna_me(t)
    for lat, lon in [(-84.60, 31.0), (-84.9, 27.0), (-84.3, 35.0)]:
        az_r, el_r = posicion.altaz_desde_vector(s, lat, lon)
        az, el = posicion.sol_luna(lat, lon, t)
        assert np.abs(el_r - el).max() < 0.002
        assert np.abs((az_r - az + 180) % 360 - 180).max() < 0.002


# ---------------------------------------------------------- Ventanas en la Tierra -------------
@pytest.mark.parametrize("lugar, lat, lon, alt, esperado", [
    ("Ciudad del Este", -25.51, -54.61, 200.0, {15: "17:50", 7: "18:27", 5: "18:36", 1.5: "18:54"}),
    ("Payunia", -36.42, -69.25, 1800.0, {15: "19:00", 7: "19:41", 5: "19:52", 1.5: "20:12"}),
    ("Puna", -26.06, -67.40, 3400.0, {15: "18:41", 7: "19:19", 5: "19:28", 1.5: "19:46"}),
])
def test_horarios_del_documento_02(lugar, lat, lon, alt, esperado):
    cruces = ventanas.cruces_atardecer(lat, lon, alt, dt.date(2026, 11, 14), list(esperado))
    for e, hora in esperado.items():
        h, m = map(int, hora.split(":"))
        obtenido = cruces[e]["hora_local"]
        dif = (obtenido.hour * 60 + obtenido.minute + obtenido.second / 60) - (h * 60 + m)
        assert -1.0 <= dif <= 1.5, f"{lugar} {e}°: {obtenido:%H:%M:%S} vs {hora}"


def test_ventana_de_ensayo_payunia_coincide_con_la_ficha_de_ejemplo():
    vs = ventanas.ventanas_ensayo(-36.42, -69.25, 1800.0, dt.date(2026, 11, 14), dias=1)
    tarde = [v for v in vs if v["tipo"] == "atardecer"][0]
    minutos = lambda s: int(s[:2]) * 60 + int(s[3:])
    # Tolerancia de 1 minuto: el documento usó la refracción estándar de Horizons y acá se usa
    # la presión de la altura del sitio (1.800 m), que cambia el cruce en segundos.
    assert abs(minutos(tarde["desde"]) - minutos("19:41")) <= 1
    assert abs(minutos(tarde["hasta"]) - minutos("20:12")) <= 1
    assert 250 <= tarde["azimut"][0] <= 254 and 246 <= tarde["azimut"][1] <= 250


# ---------------------------------------------------------- Mons Mouton -----------------------
def test_estaciones_lunares_en_mons_mouton():
    ser = lunacion.serie_luna(-84.60, 31.00, dt.datetime(2027, 10, 27, tzinfo=UTC), dt.datetime(2027, 11, 26, tzinfo=UTC), 1.0)
    assert math.isclose(float(np.max(ser["el"])), 6.94, abs_tol=0.02)
    inv = lunacion.serie_luna(-84.60, 31.00, dt.datetime(2027, 5, 3, tzinfo=UTC), dt.datetime(2027, 6, 1, tzinfo=UTC), 1.0)
    assert math.isclose(float(np.max(inv["el"])), 3.87, abs_tol=0.02)


@pytest.mark.lento
def test_sol_maximo_2027_2028_en_cuatro_puntos():
    a, b = dt.datetime(2027, 1, 1, tzinfo=UTC), dt.datetime(2029, 1, 1, tzinfo=UTC)
    for lat, lon, emax in [(-84.60, 31.0, 6.96), (-84.7906, 29.1957, 6.77), (-83.30, 31.0, 8.26), (-86.22, 31.0, 5.34)]:
        ser = lunacion.serie_luna(lat, lon, a, b, 1.0)
        assert math.isclose(float(np.max(ser["el"])), emax, abs_tol=0.02)


def test_noches_completas_sobre_horizonte_liso():
    # La noche se mide entera: la ventana de la lunación de verano corta dos noches por la mitad.
    a, b = dt.datetime(2027, 10, 27, tzinfo=UTC), dt.datetime(2027, 11, 26, tzinfo=UTC)
    ns = lunacion.noches_que_tocan(-84.60, 31.00, a, b, paso_h=1.0)
    assert len(ns) == 2 and all(n["completa"] for n in ns)
    largo = max(n["horas"] for n in ns)
    assert 280 <= largo <= 305, largo
    inv = lunacion.noches_que_tocan(-84.60, 31.00, dt.datetime(2027, 5, 3, tzinfo=UTC), dt.datetime(2027, 6, 1, tzinfo=UTC), paso_h=1.0)
    assert 400 <= max(n["horas"] for n in inv) <= 425


def test_el_148_de_los_documentos_es_media_noche():
    # analizar_horizons.py corta las lunaciones en el mínimo del Sol (medianoche): cada ventana
    # tiene dos medias noches y el tramo más largo dentro de ella es la mitad de la noche real.
    a, b = dt.datetime(2027, 10, 27, tzinfo=UTC), dt.datetime(2027, 11, 26, tzinfo=UTC)
    ser = lunacion.serie_luna(-84.60, 31.00, a, b, 2.0)
    recortada = lunacion.tramo_mas_largo(ser["el"] <= 0.0, 2.0)
    assert 140 <= recortada <= 156                      # el "148 h" del documento
    completa = max(n["horas"] for n in lunacion.noches_que_tocan(-84.60, 31.00, a, b, paso_h=2.0))
    assert completa > 1.8 * recortada
