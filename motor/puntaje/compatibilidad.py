"""F11: compatibilidad C, evidencia E y límites L y U; requisitos indispensables y etiquetas.

    C = Σ_K w_i u_i / Σ_K w_i     E = Σ_K w_i / W     L = C·E     U = L + (1 − E)

K es el conjunto de propiedades con datos utilizables. L supone utilidad 0 en lo que falta y U
supone utilidad 1: son límites algebraicos, no un intervalo de confianza ni un porcentaje de parecido.

Regla de etiquetas (doc02 §3.6): requisito incumplido → Incompatible; requisito desconocido o
E < E_min → No podemos concluir; U < θ → No alcanza; L ≥ θ → Análogo sostenido; si no → Con huecos.
Un buen puntaje en otra propiedad nunca compensa un requisito incumplido.

Uso de SI: redactado con Claude Code; probado con los casos del documento 02 en test_puntaje.py.
"""
from __future__ import annotations

import numpy as np

from . import distancias

PROPIEDADES = ("pendiente", "luz_rasante", "rugosidad", "material", "transitabilidad_fina")


def limites(C, E: float) -> tuple[float, float]:
    L = 0.0 if C is None else C * E
    return L, L + (1.0 - E)


def combinar(utilidades: dict, pesos: dict) -> tuple:
    """C, E, L, U a partir de las utilidades conocidas (None = faltante)."""
    W = sum(pesos[p] for p in PROPIEDADES)
    k = [p for p in PROPIEDADES if utilidades.get(p) is not None]
    wk = sum(pesos[p] for p in k)
    C = (sum(pesos[p] * utilidades[p] for p in k) / wk) if wk > 0 else None
    E = wk / W
    L, U = limites(C, E)
    return C, E, L, U


def requisitos(parcela: dict, prm: dict) -> dict:
    r = prm["requisitos"]
    ndvi = parcela.get("ndvi_p90")
    pend = parcela.get("pendiente_mediana_deg")
    if pend is None and parcela.get("pendiente_deg"):
        pend = distancias.mediana(parcela["pendiente_deg"])

    def estado(valor, limite):
        if valor is None:
            return "desconocido"
        return "cumple" if valor < limite else "incumple"

    return {
        "vegetacion": {"estado": estado(ndvi, r["vegetacion_ndvi_p90_max"]), "valor": None if ndvi is None else float(ndvi),
                       "limite": float(r["vegetacion_ndvi_p90_max"]), "unidad": "NDVI percentil 90 anual"},
        "pendiente": {"estado": estado(pend, r["pendiente_mediana_max_deg"]), "valor": None if pend is None else round(float(pend), 3),
                      "limite": float(r["pendiente_mediana_max_deg"]), "unidad": "grados (mediana a 60 m)"},
    }


def _estado(req) -> str:
    return req["estado"] if isinstance(req, dict) else req


def etiqueta(reqs: dict, E: float, L: float, U: float, umbral: float, e_min: float) -> str:
    estados = [_estado(v) for v in reqs.values()]
    if "incumple" in estados:
        return "incompatible"
    if "desconocido" in estados or E < e_min:
        return "no_podemos_concluir"
    if U < umbral:
        return "no_alcanza"
    if L >= umbral:
        return "analogo_sostenido"
    return "con_huecos"


def propiedades(parcela: dict, ref: dict, prm: dict) -> dict:
    pesos, tol = prm["pesos"], prm["tolerancias"]
    out = {}

    def faltante(p, unidad):
        return {"estado": "faltante", "peso": pesos[p], "distancia": None, "tolerancia": None, "utilidad": None, "unidad": unidad}

    # Pendiente: W1 entre distribuciones, τ = 3°.
    if parcela.get("pendiente_deg") and ref.get("pendiente_deg"):
        d = distancias.w1(parcela["pendiente_deg"], ref["pendiente_deg"])
        out["pendiente"] = {"estado": "conocida", "peso": pesos["pendiente"], "distancia": round(d, 4),
                            "tolerancia": tol["pendiente_deg"], "utilidad": round(distancias.utilidad(d, tol["pendiente_deg"]), 6),
                            "unidad": "grados (W1)"}
    else:
        out["pendiente"] = faltante("pendiente", "grados (W1)")

    # Luz rasante: media de |f̄P − f̄Q| entre 1,5° y 10°, τ = 0,05.
    if parcela.get("luz_rasante") and ref.get("luz_rasante"):
        d = distancias.distancia_luz(parcela["luz_rasante"], ref["luz_rasante"])
        out["luz_rasante"] = {"estado": "conocida", "peso": pesos["luz_rasante"], "distancia": round(d, 5),
                              "tolerancia": tol["luz_rasante"], "utilidad": round(distancias.utilidad(d, tol["luz_rasante"]), 6),
                              "unidad": "fracción en sombra (media de |Δf̄| de 1,5° a 10°)"}
    else:
        out["luz_rasante"] = faltante("luz_rasante", "fracción en sombra")

    # Rugosidad: W1 en cada escala, τ = 25 % de la mediana de referencia; utilidad = media de escalas.
    detalle, us, ds = {}, [], []
    rp, rr = parcela.get("rugosidad_m") or {}, ref.get("rugosidad_m") or {}
    for s in prm["escalas_rugosidad_m"]:
        k = str(s)
        if rp.get(k) and rr.get(k):
            tau = tol["rugosidad_fraccion_ref"] * distancias.mediana(rr[k])
            d = distancias.w1(rp[k], rr[k])
            u = distancias.utilidad(d, tau)
            detalle[k] = {"w1_m": round(d, 4), "tolerancia_m": round(tau, 4), "utilidad": round(u, 6)}
            us.append(u)
            ds.append(d / tau)
    if us:
        out["rugosidad"] = {"estado": "conocida", "peso": pesos["rugosidad"], "distancia": round(float(np.mean(ds)), 5),
                            "tolerancia": 1.0, "utilidad": round(float(np.mean(us)), 6),
                            "unidad": "W1/τ, media de las escalas de 200 a 1.600 m", "detalle": detalle}
    else:
        out["rugosidad"] = faltante("rugosidad", "W1/τ")

    # Material y transitabilidad fina: solo con un dato medido (laboratorio o campo).
    for p, unidad in (("material", "utilidad declarada por una medición"), ("transitabilidad_fina", "utilidad declarada por una medición")):
        v = parcela.get(p)
        if isinstance(v, dict) and v.get("utilidad") is not None:
            out[p] = {"estado": "conocida", "peso": pesos[p], "distancia": None, "tolerancia": None,
                      "utilidad": float(v["utilidad"]), "unidad": unidad}
        else:
            out[p] = faltante(p, unidad)
    return out


def evaluar(parcela: dict, ref: dict, prm: dict) -> dict:
    props = propiedades(parcela, ref, prm)
    utils = {p: props[p]["utilidad"] for p in PROPIEDADES}
    C, E, L, U = combinar(utils, prm["pesos"])
    reqs = requisitos(parcela, prm)
    et = etiqueta(reqs, E, L, U, prm["decision"]["umbral_theta"], prm["decision"]["evidencia_minima"])
    return {"propiedades": props, "utilidades": utils, "C": C, "E": E, "L": L, "U": U, "requisitos": reqs, "etiqueta": et}
