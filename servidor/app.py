"""TERRA-X · servidor del motor en vivo.

Expone por HTTP las MISMAS funciones del motor físico (motor/, Parte 3) para que la web pueda pedir
cálculos nuevos mientras la persona interactúa: estacionar el rover en cualquier píxel de Mons
Mouton, cambiar la fecha o el vehículo, o comprobar una sombra medida en el campo.

Reglas que respeta:
- No guarda nada: sin base de datos, sin cuentas, sin estado entre pedidos.
- No inventa números: cada respuesta sale de motor/ con parametros.yaml y lleva la huella de los
  parámetros. Lo que la persona cambia (consumo, panel, batería) vuelve marcado como "supuesto".
- Si faltan las grillas reales de datos/ (no están en el repositorio), el horizonte del punto sale
  de horizontes.bin (72 azimutes) y la respuesta lo dice.

La web funciona igual sin este servidor: cae a los datos precalculados y a un cálculo en el
navegador con horizontes.bin. Ver servidor/LEEME.md.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import pathlib
import threading
import time
from collections import OrderedDict
from functools import lru_cache

import numpy as np
from flask import Flask, jsonify, request

import parametros
from motor import __version__ as MOTOR_VERSION
from motor.destino import energia, simulacion
from motor.horizonte import calcular_horizontes_puntos, formato, geometria, horizonte_en_azimut
from motor.horizonte.grilla import leer_grilla
from motor.sol import ventanas
from motor.sol.posicion import sol_luna, sol_tierra
from motor.tests import campo

RAIZ = pathlib.Path(__file__).resolve().parents[1]
WEB_DATA = RAIZ / "web" / "public" / "data"
WEB_MODELOS = RAIZ / "web" / "public" / "modelos"
GRILLAS = RAIZ / "datos" / "grillas"
UTC = dt.timezone.utc
DIAS_MAX = 62
ANIO_MIN, ANIO_MAX = 1900, 2050          # cobertura de moon_pa_de421_1900-2050.bpc

app = Flask(__name__)
app.json.ensure_ascii = False
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024          # ningún pedido legítimo pasa de unos cientos de bytes (un artículo, unos KB)
app.config["JSON_SORT_KEYS"] = False

from servidor import cuentas, si  # noqa: E402  (cuentas, divulgación, panel admin y relevo del chat SI)

cuentas.configurar(app)
app.register_blueprint(si.bp)

RUTAS = [
    {"metodo": "GET", "ruta": "/api/estado", "que": "engine version, frozen-parameter hash, which terrain data is loaded"},
    {"metodo": "GET", "ruta": "/api/sol/ahora", "que": "the Sun right now over Mons Mouton and over the field site (DE421)"},
    {"metodo": "POST", "ruta": "/api/destino/punto", "que": "park the rover at (fila, col): horizon, power, battery, verdict"},
    {"metodo": "POST", "ruta": "/api/destino/comparar",
     "que": "2 to 3 /punto requests in one call, each with a reproducible scenario_id, plus a side-by-side summary"},
    {"metodo": "POST", "ruta": "/api/campo/sombra", "que": "predicted board shadow and the error of a measured one"},
    {"metodo": "POST", "ruta": "/api/cuentas/registro | /entrar | /salir · GET /api/cuentas/yo", "que": "accounts (local server only)"},
    {"metodo": "GET", "ruta": "/api/divulgacion", "que": "published outreach articles by verified authors"},
    {"metodo": "GET", "ruta": "/api/admin/resumen", "que": "admin panel (admins only)"},
]


class Pedido(ValueError):
    """Error del pedido (400): el mensaje se muestra tal cual en la web."""


# ------------------------------------------------------------------------------------------------
# Datos (se leen una vez)
# ------------------------------------------------------------------------------------------------
@lru_cache(maxsize=1)
def terreno():
    """Capas reales de LOLA si están en datos/grillas; si no, None."""
    base = GRILLAS / "mons_mouton_60m"
    if not base.with_suffix(".npy").exists():
        return None
    objetivo, meta = leer_grilla(base)
    capas = [objetivo]
    for nombre in ("mons_mouton_margen_60m", "mons_mouton_lejano_240m"):
        p = GRILLAS / nombre
        if p.with_suffix(".npy").exists():
            capas.append(leer_grilla(p)[0])
    return capas, meta


@lru_cache(maxsize=1)
def horizontes():
    ruta = WEB_DATA / "destino" / "horizontes.bin"
    if not ruta.exists():
        return None
    return formato.leer(ruta), json.loads(ruta.with_suffix(".json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def grilla_info() -> dict:
    """Tamaño y proyección de la grilla del destino (de datos/ o, si falta, de modelos.json)."""
    t = terreno()
    if t is not None:
        capas, meta = t
        return {"filas": capas[0].alto, "columnas": capas[0].ancho, "pixel_m": capas[0].pixel_m,
                "x0_m": capas[0].x0, "y0_m": capas[0].y0, "proyeccion": meta["proyeccion"], "fuentes": meta.get("fuentes", [])}
    m = json.loads((WEB_MODELOS / "modelos.json").read_text(encoding="utf-8"))["terreno"]
    return {k: m[k] for k in ("filas", "columnas", "pixel_m", "x0_m", "y0_m", "proyeccion", "fuentes")}


# ------------------------------------------------------------------------------------------------
# Reutilización de cálculos caros (horizonte por raycast y serie solar DE421)
# ------------------------------------------------------------------------------------------------
# No es estado de la persona: son resultados puros de (entradas, parámetros congelados, versión del
# motor), así que repetirlos da exactamente los mismos números. Se guardan como copias y se entregan
# como copias para que ningún pedido modifique lo que usa otro. Un candado por clave evita calcular
# dos veces lo mismo cuando llegan pedidos simultáneos.
CACHE_MAX = 64
_cache: "OrderedDict[tuple, object]" = OrderedDict()
_cache_candado = threading.Lock()
_en_curso: dict[tuple, threading.Lock] = {}


def _copia(v):
    if isinstance(v, np.ndarray):
        return v.copy()
    if isinstance(v, tuple):
        return tuple(_copia(x) for x in v)
    if isinstance(v, list):
        return list(v)
    return v


def _reutilizar(clave: tuple, calcular) -> tuple[object, bool]:
    """(valor, reutilizado). `clave` debe incluir todo lo que cambia el resultado."""
    with _cache_candado:
        if clave in _cache:
            _cache.move_to_end(clave)
            return _copia(_cache[clave]), True
        candado = _en_curso.setdefault(clave, threading.Lock())
    with candado:
        with _cache_candado:
            if clave in _cache:
                return _copia(_cache[clave]), True
        try:
            valor = calcular()
            with _cache_candado:
                _cache[clave] = _copia(valor)
                _cache.move_to_end(clave)
                while len(_cache) > CACHE_MAX:
                    _cache.popitem(last=False)
        finally:
            with _cache_candado:
                _en_curso.pop(clave, None)
    return valor, False


def vaciar_cache() -> None:
    with _cache_candado:
        _cache.clear()


def scenario_id(entradas: dict, fuente_horizonte: str) -> str:
    """SHA-256 de las entradas normalizadas + parámetros congelados + versión del motor + datos usados.

    No incluye la hora ni el tiempo de cálculo: el mismo pedido sobre los mismos datos da el mismo id.
    """
    base = {"entradas": entradas, "parametros_sha256": parametros.huella(), "motor_version": MOTOR_VERSION,
            "fuente_horizonte": fuente_horizonte,
            "grilla_sha256": [f.get("sha256") for f in grilla_info().get("fuentes", [])]}
    return hashlib.sha256(json.dumps(base, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


# ------------------------------------------------------------------------------------------------
# Validación de entradas
# ------------------------------------------------------------------------------------------------
def _numero(d: dict, clave: str, minimo: float, maximo: float, defecto=None) -> float:
    v = d.get(clave, defecto)
    if v is None:
        raise Pedido(f"missing '{clave}'")
    try:
        v = float(v)
    except (TypeError, ValueError):
        raise Pedido(f"'{clave}' must be a number") from None
    if not math.isfinite(v) or not (minimo <= v <= maximo):
        raise Pedido(f"'{clave}' must be between {minimo} and {maximo}")
    return v


def _fecha(texto, clave: str) -> dt.datetime:
    try:
        f = dt.date.fromisoformat(str(texto)[:10])
    except ValueError:
        raise Pedido(f"'{clave}' must be an ISO date (YYYY-MM-DD)") from None
    if not (ANIO_MIN < f.year < ANIO_MAX):
        raise Pedido(f"'{clave}' must be between {ANIO_MIN + 1} and {ANIO_MAX - 1} (DE421 lunar frame coverage)")
    return dt.datetime(f.year, f.month, f.day, tzinfo=UTC)


def _iso(t: dt.datetime) -> str:
    return t.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _lista(a, dec: int) -> list:
    return np.round(np.asarray(a, dtype=float), dec).tolist()


# ------------------------------------------------------------------------------------------------
# Punto del rover
# ------------------------------------------------------------------------------------------------
def punto(fila: int, col: int, prm: dict, modo: str) -> dict:
    g = grilla_info()
    if not (0 <= fila < g["filas"] and 0 <= col < g["columnas"]):
        raise Pedido("the selected point is outside the Mons Mouton grid")
    x = g["x0_m"] + col * g["pixel_m"]
    y = g["y0_m"] - fila * g["pixel_m"]
    proy = g["proyeccion"]
    lat, lon = geometria.latlon_desde_xy_polar_sur(x, y, proy["radio_m"], proy["lon0_deg"])
    lat, lon = float(lat), float(lon)
    conv = float(geometria.convergencia_polar_sur(lon, proy["lon0_deg"]))
    hz = prm["horizonte"]
    radio = prm["cuerpos"]["luna"]["radio_km"] * 1000.0
    t = terreno()
    salida = {"fila": fila, "col": col, "lat": round(lat, 5), "lon": round(lon, 5), "convergencia_deg": round(conv, 3),
              "altura_m": None, "pendiente_deg": None}
    if t is not None:
        capas, _ = t
        salida["altura_m"] = round(float(capas[0].z[fila, col]), 1)
        p = energia.pendiente_horn_deg(capas[0].z, fila, col, capas[0].pixel_m)
        salida["pendiente_deg"] = None if math.isnan(p) else round(p, 2)

    reutilizado = False
    if modo == "liso":
        h360, tipo, detalle = None, "liso", "Smooth horizon: no relief (observer 1 m above a sphere)."
        fuente = "liso"
    elif t is not None and modo in ("relieve", "auto"):
        capas, _ = t
        h360, reutilizado = _reutilizar(
            ("horizonte", fila, col, parametros.huella(), MOTOR_VERSION),
            lambda: np.asarray(calcular_horizontes_puntos(
                capas, [(fila, col)], n_az=hz["azimutes_rover"], altura_obs_m=hz["altura_observador_m"], radio_m=radio,
                k=0.0, d_max_m=prm["grilla"]["margen_luna_km"] * 1000.0, paso_rel=hz["paso_relativo"])[0]))
        tipo = "relieve"
        fuente = "grillas"
        detalle = (f"Ray-cast now over LOLA relief out to {prm['grilla']['margen_luna_km']} km "
                   f"({hz['azimutes_rover']} azimuths, {len(capas)} layers).")
    else:
        h = horizontes()
        if h is None:
            raise Pedido("no terrain data available on this server (datos/grillas and horizontes.bin are both missing)")
        h360 = h[0].grados()[:, fila, col]
        tipo = "relieve"
        detalle = f"Lookup in horizontes.bin ({h[0].n_az} azimuths): the real grids are not on this machine."
        fuente = "horizontes.bin"
    salida["horizonte"] = {"tipo": tipo, "n_az": 0 if h360 is None else int(len(h360)), "detalle": detalle,
                           "altura_observador_m": float(hz["altura_observador_m"])}
    return {"info": salida, "lat": lat, "lon": lon, "conv": conv, "h360": h360,
            "pendiente": salida["pendiente_deg"] or 0.0, "fuente": fuente, "reutilizado": reutilizado}


def simular(cuerpo: dict) -> dict:
    prm = parametros.cargar()
    v, d = prm["vehiculo"], prm["destino"]
    fila = int(_numero(cuerpo, "fila", 0, 1e6))
    col = int(_numero(cuerpo, "col", 0, 1e6))
    modo = str(cuerpo.get("horizonte", "auto"))
    if modo not in ("auto", "relieve", "liso"):
        raise Pedido("'horizonte' must be auto, relieve or liso")

    lunacion = cuerpo.get("lunacion")
    if lunacion:
        if lunacion not in d["lunaciones"]:
            raise Pedido(f"'lunacion' must be one of {sorted(d['lunaciones'])}")
        desde = _fecha(d["lunaciones"][lunacion]["desde"], "desde")
        hasta = _fecha(d["lunaciones"][lunacion]["hasta"], "hasta")
    else:
        desde, hasta = _fecha(cuerpo.get("desde"), "desde"), _fecha(cuerpo.get("hasta"), "hasta")
        dias = (hasta - desde).days
        if not (1 <= dias <= DIAS_MAX):
            raise Pedido(f"the period must last between 1 and {DIAS_MAX} days")

    supuestos = []
    for clave, lo, hi in (("panel_w", 50, 2000), ("bateria_wh", 500, 50000), ("consumo_w", 10, 500)):
        if cuerpo.get(clave) is not None:
            nuevo = _numero(cuerpo, clave, lo, hi)
            if abs(nuevo - float(v[clave])) > 1e-9:
                supuestos.append({"clave": clave, "valor": nuevo, "publicado": float(v[clave])})
            v[clave] = nuevo
    v["p_surv_w"] = energia.p_surv(float(v["bateria_wh"]), float(v["supervivencia_h"]))       # F6

    t0 = time.perf_counter()
    pt = punto(fila, col, prm, modo)
    serie, serie_reutilizada = _reutilizar(
        ("serie", round(pt["lat"], 9), round(pt["lon"], 9), desde.isoformat(), hasta.isoformat(), parametros.huella(), MOTOR_VERSION),
        lambda: simulacion.serie_sol(pt["lat"], pt["lon"], desde, hasta, prm))
    entradas = {"fila": fila, "col": col, "horizonte": modo, "lunacion": lunacion or None,
                "desde": desde.date().isoformat(), "hasta": hasta.date().isoformat(),
                "panel_w": float(v["panel_w"]), "bateria_wh": float(v["bateria_wh"]), "consumo_w": float(v["consumo_w"])}
    resultado = simulacion.simular_punto(pt["lat"], pt["lon"], desde, hasta, pt["h360"], d["rumbo"], pt["conv"],
                                         pendiente_local_deg=pt["pendiente"], prm=prm, serie=serie)

    # Series para los gráficos: las mismas fórmulas F3 a F5 que usa simular_punto.
    t, az, el = serie
    paso_h = float(d["paso_h"])
    radio_m = prm["cuerpos"]["luna"]["radio_km"] * 1000.0
    if pt["h360"] is None:
        eh = np.full_like(el, simulacion.depresion_horizonte_liso_deg(prm["horizonte"]["altura_observador_m"], radio_m))
    else:
        eh = horizonte_en_azimut(np.asarray(pt["h360"], dtype=float), (az + pt["conv"]) % 360.0)
    fsol = energia.fraccion_disco(el, eh, prm["sol"]["radio_angular_deg"])
    psi = az - 45.0
    paneles = energia.potencia_paneles(el, az, psi, v["lados_deg"], v["panel_w"], fsol)
    p = paneles.sum(axis=-1)
    e_max = float(v["bateria_wh"])
    bat = energia.bateria(p, float(v["consumo_w"]), paso_h, e_max, e_max * float(v["bateria_inicial_frac"]))
    i0 = int(round((desde - t[0]).total_seconds() / (paso_h * 3600.0)))
    i1 = int(round((hasta - t[0]).total_seconds() / (paso_h * 3600.0)))

    return {
        "origen": "motor-en-vivo",
        "scenario_id": scenario_id(entradas, pt["fuente"]),
        "entradas": entradas,
        "reutilizado": {"horizonte": bool(pt["reutilizado"]), "serie_sol": bool(serie_reutilizada)},
        "punto": pt["info"],
        "periodo": {"lunacion": lunacion or None, "desde": desde.date().isoformat(), "hasta": hasta.date().isoformat(),
                    "margen_dias": float(d["margen_noches_dias"])},
        "vehiculo": {"plantilla": v["plantilla"], "panel_w": v["panel_w"], "lados_deg": v["lados_deg"],
                     "bateria_wh": v["bateria_wh"], "supervivencia_h": v["supervivencia_h"],
                     "p_surv_w": round(float(v["p_surv_w"]), 2), "consumo_w": v["consumo_w"],
                     "reserva_frac": v["reserva_frac"], "rumbo": d["rumbo"], "cambios": supuestos},
        "limite_refugio_h": float(d["limite_refugio_h"]),
        "resultado": resultado,
        "serie": {
            "t0_utc": _iso(t[0]), "paso_s": paso_h * 3600.0, "n": int(len(t)), "i0": i0, "i1": i1,
            "azimut_deg": _lista(az, 2), "elevacion_deg": _lista(el, 3), "horizonte_deg": _lista(eh, 2),
            "disco_visible": _lista(fsol, 3), "potencia_w": _lista(p, 1),
            "paneles_w": [_lista(paneles[:, k], 1) for k in range(paneles.shape[1])],
            "bateria_wh": _lista(bat[:-1], 0),
        },
        "horizonte_grilla_deg": None if pt["h360"] is None else _lista(pt["h360"], 2),
        "supuestos": list(simulacion.SUPUESTOS),
        "maqueta": False,
        "calculo_ms": round((time.perf_counter() - t0) * 1000.0),
        "meta": parametros.bloque_meta("escenario_en_vivo", MOTOR_VERSION),
    }


# ------------------------------------------------------------------------------------------------
# Rutas
# ------------------------------------------------------------------------------------------------
@app.get("/api")
def ruta_indice():
    """Qué expone este servidor, para quien llega sin leer servidor/LEEME.md."""
    return jsonify({"motor": "terra-x", "version": MOTOR_VERSION, "rutas": RUTAS,
                    "nota": "Stateless local engine: no database, no accounts, no data is kept between requests.",
                    "documentacion": "servidor/LEEME.md"})


@app.before_request
def _preflight():
    """Preflight CORS para una web servida desde otro puerto local (la de Vite usa un proxy y no lo necesita).

    Se resuelve antes del enrutado para no registrar una ruta comodín: así un GET a una ruta
    inexistente sigue dando 404 y no 405.
    """
    if request.method == "OPTIONS" and request.path.startswith("/api"):
        resp = app.make_response(("", 204))
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"
        resp.headers["Access-Control-Max-Age"] = "600"
        return resp
    return None


@app.get("/api/estado")
def ruta_estado():
    prm = parametros.cargar()
    t, h = terreno(), horizontes()
    return jsonify({
        "motor": "terra-x",
        "version": MOTOR_VERSION,
        "parametros_sha256": parametros.huella(),
        "parametros_congelados": parametros.estado_congelado().get("coincide", False),
        "relieve": {"grillas_reales": t is not None, "capas": 0 if t is None else len(t[0]),
                    "horizontes_bin": h is not None, "margen_km": prm["grilla"]["margen_luna_km"]},
        "grilla": {k: grilla_info()[k] for k in ("filas", "columnas", "pixel_m")},
        "lunaciones": prm["destino"]["lunaciones"],
        "vehiculo": {k: prm["vehiculo"][k] for k in ("plantilla", "panel_w", "bateria_wh", "consumo_w", "supervivencia_h",
                                                     "p_surv_w", "reserva_frac", "consumo_sensibilidad_w")},
        "efemerides": prm["sol"]["efemerides"],
        "hora_utc": _iso(dt.datetime.now(UTC)),
    })


@app.get("/api/sol/ahora")
def ruta_sol_ahora():
    """El Sol en este instante sobre Mons Mouton y sobre el sitio de la medición de campo."""
    prm = parametros.cargar()
    ahora = dt.datetime.now(UTC).replace(microsecond=0)
    c = prm["destino"]["centro"]
    az_l, el_l = sol_luna(c["lat"], c["lon"], [ahora])
    lugar = prm["campo"]["lugar"]
    az_t, e_geo, e_ap = sol_tierra(lugar["lat"], lugar["lon"], lugar["alt_m"], [ahora], refraccion=True,
                                   temperatura_c=prm["sol"]["refraccion"]["temperatura_c"])
    liso = simulacion.depresion_horizonte_liso_deg(prm["horizonte"]["altura_observador_m"],
                                                   prm["cuerpos"]["luna"]["radio_km"] * 1000.0)
    return jsonify({
        "hora_utc": _iso(ahora),
        "luna": {"nombre": "Mons Mouton", "lat": c["lat"], "lon": c["lon"], "azimut_deg": round(float(az_l[0]), 2),
                 "elevacion_deg": round(float(el_l[0]), 3), "sobre_horizonte_liso": bool(el_l[0] >= liso)},
        "tierra": {"nombre": lugar["nombre"], "lat": lugar["lat"], "lon": lugar["lon"], "azimut_deg": round(float(az_t[0]), 2),
                   "elevacion_geometrica_deg": round(float(e_geo[0]), 3), "elevacion_aparente_deg": round(float(e_ap[0]), 3)},
        "efemerides": "DE421 (Skyfield)",
        "meta": parametros.bloque_meta("sol_ahora", MOTOR_VERSION),
    })


@app.post("/api/destino/punto")
def ruta_punto():
    return jsonify(simular(request.get_json(silent=True) or {}))


COMPARAR_MIN, COMPARAR_MAX = 2, 3
# Lo que se pone lado a lado: todo sale tal cual de `resultado` (motor/destino/simulacion.py).
COMPARAR_METRICAS = ("tramo_oscuro_mas_largo_h", "noche_geometrica_h", "bateria_minima_wh", "bateria_minima_frac",
                     "sobre_p_surv_frac", "sol_en_paneles_frac", "potencia_media_w", "en_riesgo")


@app.post("/api/destino/comparar")
def ruta_comparar():
    """De 2 a 3 escenarios en un pedido, cada uno con el MISMO cálculo que /api/destino/punto.

    Cuerpo: {"escenarios": [{"id": "A", "fila": ..., "col": ..., "lunacion": ...}, ...], "series": true}
    Un escenario inválido no tumba a los demás: vuelve con ok=false y su error.
    """
    cuerpo = request.get_json(silent=True) or {}
    lista = cuerpo.get("escenarios")
    if not isinstance(lista, list) or not (COMPARAR_MIN <= len(lista) <= COMPARAR_MAX):
        raise Pedido(f"'escenarios' must be a list of {COMPARAR_MIN} to {COMPARAR_MAX} requests")
    con_series = cuerpo.get("series", True) is not False
    t0 = time.perf_counter()
    ids, salida, resumen = [], [], []
    for k, pedido in enumerate(lista):
        eid = str((pedido.get("id") if isinstance(pedido, dict) else None) or "ABC"[k])[:24]
        if eid in ids:
            raise Pedido(f"duplicate scenario id '{eid}'")
        ids.append(eid)
        if not isinstance(pedido, dict):
            salida.append({"id": eid, "ok": False, "error": "each scenario must be an object"})
            continue
        try:
            esc = simular({c: v for c, v in pedido.items() if c != "id"})
        except Pedido as e:
            salida.append({"id": eid, "ok": False, "error": str(e)})
            continue
        if not con_series:
            esc.pop("serie", None)
            esc.pop("horizonte_grilla_deg", None)
        salida.append({"id": eid, "ok": True, "scenario_id": esc["scenario_id"], "escenario": esc})
        r = esc["resultado"]
        resumen.append({"id": eid, "scenario_id": esc["scenario_id"], "punto": {c: esc["punto"][c] for c in ("fila", "col", "lat", "lon")},
                        "periodo": esc["periodo"], "consumo_w": esc["vehiculo"]["consumo_w"],
                        **{m: r[m] for m in COMPARAR_METRICAS},
                        "supera_limite_refugio": bool(r["tramo_oscuro_mas_largo_h"] > esc["limite_refugio_h"])})
    mejor = {}
    if len(resumen) >= 2:
        mejor = {"tramo_oscuro_mas_largo_h": min(resumen, key=lambda x: x["tramo_oscuro_mas_largo_h"])["id"],
                 "bateria_minima_frac": max(resumen, key=lambda x: x["bateria_minima_frac"])["id"],
                 "sobre_p_surv_frac": max(resumen, key=lambda x: x["sobre_p_surv_frac"])["id"]}
    prm = parametros.cargar()
    return jsonify({
        "origen": "motor-en-vivo",
        "escenarios": salida,
        "resumen": resumen,
        "mejor": mejor,
        "criterio_mejor": "shortest longest-dark stretch; highest minimum battery; largest share above survival power",
        "limite_refugio_h": float(prm["destino"]["limite_refugio_h"]),
        "calculo_ms": round((time.perf_counter() - t0) * 1000.0),
        "meta": parametros.bloque_meta("comparacion_en_vivo", MOTOR_VERSION),
    })


@app.post("/api/campo/sombra")
def ruta_sombra():
    """Predicción de la sombra de la tablita y, si llega una medición, su error (F14, F15, F19)."""
    prm = parametros.cargar()
    b = request.get_json(silent=True) or {}
    c = prm["campo"]
    lugar = {"nombre": str(b.get("lugar") or c["lugar"]["nombre"])[:80],
             "lat": _numero(b, "lat", -66, 66, c["lugar"]["lat"]),
             "lon": _numero(b, "lon", -180, 180, c["lugar"]["lon"]),
             "alt_m": _numero(b, "alt_m", -400, 6000, c["lugar"]["alt_m"])}
    fecha = _fecha(b.get("fecha") or c["fecha"], "fecha").date()
    hora = str(b.get("hora_local", "")).strip()
    try:
        partes = [int(x) for x in hora.split(":")]
        hh, mm, ss = partes[0], partes[1], (partes[2] if len(partes) > 2 else 0)
        local = dt.datetime.combine(fecha, dt.time(hh, mm, ss), ventanas.zona(-3))
    except (ValueError, IndexError):
        raise Pedido("'hora_local' must be HH:MM or HH:MM:SS (UTC−3)") from None
    alto = _numero(b, "alto_m", 0.05, 5.0, c["tablita_alto_m"])
    temp = _numero(b, "temperatura_c", -30, 55, prm["sol"]["refraccion"]["temperatura_c"])
    az, e_geo, e_ap = sol_tierra(lugar["lat"], lugar["lon"], lugar["alt_m"], [local.astimezone(UTC)], refraccion=True, temperatura_c=temp)
    e = float(e_ap[0])
    pred = {"hora_utc": _iso(local), "azimut_deg": round(float(az[0]), 2), "elevacion_geometrica_deg": round(float(e_geo[0]), 3),
            "elevacion_aparente_deg": round(e, 3), "en_rango_h2": bool(c["e_min_deg"] <= e <= c["e_max_deg"]),
            "rango_h2_deg": [c["e_min_deg"], c["e_max_deg"]], "sombra_m": None, "penumbra_m": None,
            "ancho_minimo_m": None, "tolerancia_deg": None}
    if e > 0.3:
        pred["sombra_m"] = round(alto / math.tan(math.radians(e)), 3)
        pred["ancho_minimo_m"] = round(ventanas.ancho_minimo_m(alto, e), 4)
        pred["tolerancia_deg"] = round(ventanas.tolerancia_altura_deg(e, c["meta_error_frac"]), 3)
        if e > 0.6:
            pred["penumbra_m"] = round(ventanas.punta_difusa_m(alto, e), 3)
    salida = {"origen": "motor-en-vivo", "lugar": lugar, "fecha": fecha.isoformat(), "hora_local": hora, "alto_m": alto,
              "prediccion": pred, "comparacion": None, "meta_error_frac": c["meta_error_frac"],
              "meta": parametros.bloque_meta("sombra_campo", MOTOR_VERSION)}
    if b.get("largo_sombra_m") not in (None, ""):
        if e <= 0.3:
            raise Pedido("the Sun is at or below the horizon at that time: there is no shadow to compare")
        largo = _numero(b, "largo_sombra_m", 0.01, 500.0)
        fila = {"hora_local": f"{hh:02d}:{mm:02d}:{ss:02d}", "largo_sombra_m": str(largo), "alto_m": str(alto), "temperatura_c": str(temp)}
        if b.get("inclinacion_suelo_deg") not in (None, ""):
            fila["inclinacion_suelo_deg"] = str(_numero(b, "inclinacion_suelo_deg", -20, 20))
        if b.get("ancho_m") not in (None, ""):
            fila["ancho_m"] = str(_numero(b, "ancho_m", 0.005, 2.0))
        comp = campo.comparar([fila], lugar, fecha.isoformat(), prm)
        salida["comparacion"] = {**comp["mediciones"][0], "pasa": comp["pasa"], "meta": comp["meta"]}
    return jsonify(salida)


@app.errorhandler(Pedido)
@app.errorhandler(cuentas.Pedido)
def _error_pedido(e):
    return jsonify({"error": str(e)}), 400


@app.errorhandler(404)
def _error_404(_):
    return jsonify({"error": "not found", "rutas": [r["ruta"] for r in RUTAS]}), 404


@app.errorhandler(405)
def _error_405(_):
    return jsonify({"error": "method not allowed"}), 405


@app.errorhandler(413)
def _error_413(_):
    return jsonify({"error": f"request body larger than {app.config['MAX_CONTENT_LENGTH']} bytes"}), 413


@app.errorhandler(Exception)
def _error_general(e):
    app.logger.exception("fallo del motor")
    return jsonify({"error": "engine error", "detalle": type(e).__name__}), 500


@app.after_request
def _cabeceras(resp):
    origen = request.headers.get("Origin", "")
    if origen.startswith(("http://localhost:", "http://127.0.0.1:")) or origen in ("http://localhost", "http://127.0.0.1"):
        resp.headers["Access-Control-Allow-Origin"] = origen
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-TerraX"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Vary"] = "Origin"
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-TerraX-Engine"] = MOTOR_VERSION
    return resp


def calentar() -> None:
    """Carga efemérides, grillas y compila Numba antes del primer clic."""
    def tarea():
        try:
            prm = parametros.cargar()
            c = prm["destino"]["centro"]
            sol_luna(c["lat"], c["lon"], [dt.datetime.now(UTC)])
            g = grilla_info()
            punto(g["filas"] // 2, g["columnas"] // 2, prm, "auto")
            app.logger.warning("motor listo: relieve real=%s", terreno() is not None)
        except Exception:                                                    # el servidor igual responde /api/estado
            app.logger.exception("no se pudo calentar el motor")
    threading.Thread(target=tarea, daemon=True).start()
