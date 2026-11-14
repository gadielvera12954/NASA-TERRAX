"""El dato que cambia la decisión.

Para cada propiedad que le falta a una candidata se prueba el peor valor posible (utilidad 0) y el
mejor (utilidad 1), como si se midiera, y se mira si cambia su etiqueta o quién queda primera
(documento del proyecto, función 6). Convierte la incertidumbre en una lista de prioridades para el
equipo de campo: "qué medir primero".

Uso de SI: redactado con Claude Code; probado en test_puntaje.py.
"""
from __future__ import annotations

from .compatibilidad import PROPIEDADES, combinar, etiqueta
from .robustez import ordenar


def _estado(utils_por_id, req_por_id, prm, ids):
    est, etq, lu = {}, {}, {}
    for i in ids:
        C, E, L, U = combinar(utils_por_id[i], prm["pesos"])
        etq[i] = etiqueta(req_por_id[i], E, L, U, prm["decision"]["umbral_theta"], prm["decision"]["evidencia_minima"])
        lu[i] = (L, U)
        if etq[i] != "incompatible":
            est[i] = (C, L)
    return ordenar(est), etq, lu


def dato_que_cambia(id_: str, utils_por_id: dict, req_por_id: dict, prm: dict, ids=None) -> list[dict]:
    ids = list(ids or utils_por_id)
    orden0, etq0, _ = _estado(utils_por_id, req_por_id, prm, ids)
    primero0 = orden0[0] if orden0 else None
    salida = []
    for p in PROPIEDADES:
        if utils_por_id[id_].get(p) is not None:
            continue
        alternativas = {}
        for nombre, valor in (("peor", 0.0), ("mejor", 1.0)):
            mod = dict(utils_por_id)
            mod[id_] = {**utils_por_id[id_], p: valor}
            orden, etq, lu = _estado(mod, req_por_id, prm, ids)
            alternativas[nombre] = {"L": round(lu[id_][0], 4), "U": round(lu[id_][1], 4), "etiqueta": etq[id_],
                                    "orden": (orden.index(id_) + 1) if id_ in orden else None,
                                    "_primero": orden[0] if orden else None}
        cambia_etq = any(alternativas[k]["etiqueta"] != etq0[id_] for k in alternativas)
        cambia_1 = any(alternativas[k]["_primero"] != primero0 for k in alternativas)
        for k in alternativas:
            alternativas[k].pop("_primero")
        salida.append({"propiedad": p, "peor": alternativas["peor"], "mejor": alternativas["mejor"],
                       "cambia_etiqueta": bool(cambia_etq), "cambia_primer_lugar": bool(cambia_1)})
    return salida


def medir_primero(cambios: list[dict], prm: dict) -> list[str]:
    orden_base = list(prm.get("medir_despues", []))

    def clave(c):
        pos = orden_base.index(c["propiedad"]) if c["propiedad"] in orden_base else len(orden_base)
        return (not c["cambia_primer_lugar"], not c["cambia_etiqueta"], -prm["pesos"][c["propiedad"]], pos)

    lista = [c["propiedad"] for c in sorted(cambios, key=clave)]
    return lista + [p for p in orden_base if p not in lista]
