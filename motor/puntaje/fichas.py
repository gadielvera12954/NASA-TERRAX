"""Tarjetas de Análogo Abiertas (fichas/<id>.json), índice de candidatas y controles.

Controles (doc02 §6, "Control positivo" y "Control negativo"):
  * el propio recorte de Mons Mouton metido entre las parcelas tiene que quedar primero;
  * sus copias con ruido creciente tienen que quedar en orden;
  * la parcela con vegetación (Médanos del Chaco) tiene que salir "Incompatible".
Si alguno falla, el índice marca la búsqueda como no confiable.

Orden: por el peor caso L (empate por C). `orden` es el puesto entre todas, controles incluidos;
`orden_candidatas` es el puesto entre las candidatas reales, y la robustez (F12) se cuenta solo
entre ellas.

Uso de SI: redactado con Claude Code; probado en test_puntaje.py.
"""
from __future__ import annotations

import datetime as dt

import parametros
from motor import __version__

from . import compatibilidad, decision, robustez
from .compatibilidad import PROPIEDADES

ES_TIERRA = lambda p: p["lugar"]["lat"] > -60.0


def _dimensiones(ev: dict, parcela: dict, prm: dict) -> dict:
    umbral = prm["perfil_dimensiones"]["fuerte_desde_utilidad"]

    def calc(us):
        us = [u for u in us if u is not None]
        if not us:
            return {"valor": "desconocido", "fuente": "calculada"}
        return {"valor": "fuerte" if sum(us) / len(us) >= umbral else "debil", "fuente": "calculada"}

    u = ev["utilidades"]
    relieve = calc([u["pendiente"], u["rugosidad"]])
    dims = {"relieve": relieve, "iluminacion": calc([u["luz_rasante"]])}
    if relieve["valor"] == "desconocido":
        dims["operaciones_roboticas"] = {"valor": "desconocido", "fuente": "calculada"}
    else:
        ok = relieve["valor"] == "fuerte" and ev["requisitos"]["pendiente"]["estado"] == "cumple"
        dims["operaciones_roboticas"] = {"valor": "fuerte" if ok else "debil", "fuente": "calculada"}
    for k, v in prm["perfil_dimensiones"]["juicio_equipo"].items():
        if parcela.get("control") in ("positivo", "positivo_ruido"):
            dims[k] = {"valor": "fuerte", "fuente": "control"}
        else:
            dims[k] = {"valor": v, "fuente": "juicio_equipo"}
    return dims


def _fuentes(*listas):
    vistas, out = set(), []
    for lista in listas:
        for f in lista or []:
            if f["id"] not in vistas:
                vistas.add(f["id"])
                out.append({"id": f["id"], "sha256": f.get("sha256")})
    return out


def puntuar(datos: dict, prm: dict | None = None, con_horario: bool = True, dias: int | None = None) -> dict:
    prm = prm or parametros.cargar()
    ref = datos["referencia"]
    parcelas = datos["parcelas"]
    evs = {p["id"]: compatibilidad.evaluar(p, ref, prm) for p in parcelas}
    utils = {i: ev["utilidades"] for i, ev in evs.items()}
    reqs = {i: ev["requisitos"] for i, ev in evs.items()}
    elegibles = [i for i in evs if evs[i]["etiqueta"] != "incompatible"]
    reales = [p["id"] for p in parcelas if p.get("control") is None]
    reales_eleg = [i for i in reales if i in elegibles]

    orden_todas = robustez.ordenar({i: (evs[i]["C"], evs[i]["L"]) for i in elegibles})
    orden_reales = robustez.ordenar({i: (evs[i]["C"], evs[i]["L"]) for i in reales_eleg})
    frac_reales = robustez.primera_frac(utils, reales_eleg, prm)
    frac_todas = robustez.primera_frac(utils, elegibles, prm)

    # Controles
    por_id = {p["id"]: p for p in parcelas}
    pos = [p["id"] for p in parcelas if p.get("control") == "positivo"]
    ruido = sorted((p for p in parcelas if p.get("control") == "positivo_ruido"), key=lambda p: p.get("ruido_nivel", 0))
    neg = [p["id"] for p in parcelas if p.get("control") == "negativo"]
    detalle = []
    recorte_primero = (bool(orden_todas) and orden_todas[0] == pos[0]) if pos else None
    if pos:
        detalle.append(f"Recorte de Mons Mouton: puesto {orden_todas.index(pos[0]) + 1 if pos[0] in orden_todas else '—'} "
                       f"(primero en {100 * frac_todas.get(pos[0], 0):.1f} % de los pesos de robustez)")
    copias_en_orden = None
    if ruido:
        puestos = [orden_todas.index(p["id"]) + 1 if p["id"] in orden_todas else 10 ** 6 for p in ruido]
        copias_en_orden = all(a < b for a, b in zip(puestos, puestos[1:])) and (not pos or all(x > orden_todas.index(pos[0]) + 1 for x in puestos))
        detalle.append("Copias con ruido: puestos " + ", ".join(str(x) for x in puestos))
    vegetacion = all(evs[i]["etiqueta"] == "incompatible" for i in neg) if neg else None
    if neg:
        detalle.append("Control negativo: " + ", ".join(f"{i} → {evs[i]['etiqueta']}" for i in neg))
    marcas = [x for x in (recorte_primero, copias_en_orden, vegetacion) if x is not None]
    confiable = all(marcas) if marcas else None

    desde = dt.date.fromisoformat(prm["horario"]["desde"])
    n_dias = int(dias if dias is not None else prm["horario"]["dias"])
    zona_h = float(prm["horario"]["zona_horaria"].split(":")[0])
    umbral = prm["decision"]["umbral_theta"]
    meta = parametros.bloque_meta("tarjeta_analogo", __version__, notas=[
        "Compatibilidad y evidencia van separadas: un valor de C no es un porcentaje de parecido.",
        "L y U son límites algebraicos (utilidad 0 o 1 en lo que falta), no un intervalo de confianza.",
    ])
    fichas = []
    for p in parcelas:
        i = p["id"]
        ev = evs[i]
        horario = []
        if con_horario and ES_TIERRA(p):
            from motor.sol import ventanas
            horario = ventanas.ventanas_ensayo(p["lugar"]["lat"], p["lugar"]["lon"], float(p.get("alt_m", 0.0)), desde, n_dias,
                                               prm["horario"]["e_alto_deg"], prm["horario"]["e_bajo_deg"], zona_h,
                                               prm["sol"]["refraccion"]["temperatura_c"])
        es_real = p.get("control") is None
        cambios = decision.dato_que_cambia(i, utils, reqs, prm, ids=reales if es_real else [i]) if (es_real and ev["etiqueta"] != "incompatible") else []
        luz = {}
        if p.get("luz_rasante") and ref.get("luz_rasante"):
            luz = {"e_deg": p["luz_rasante"]["e_deg"], "f_parcela": p["luz_rasante"]["f_media"], "f_referencia": ref["luz_rasante"]["f_media"]}
        fichas.append({
            "id": i,
            "nombre": p.get("nombre", i),
            "region": datos.get("region", ""),
            "control": p.get("control"),
            "etiqueta": ev["etiqueta"],
            "orden": (orden_todas.index(i) + 1) if i in orden_todas else None,
            "orden_candidatas": (orden_reales.index(i) + 1) if i in orden_reales else None,
            "lugar": {"lat": p["lugar"]["lat"], "lon": p["lugar"]["lon"], **({"alt_m": p["alt_m"]} if "alt_m" in p else {})},
            "C": None if ev["C"] is None else round(ev["C"], 4),
            "E": round(ev["E"], 4),
            "L": round(ev["L"], 4),
            "U": round(ev["U"], 4),
            "umbral": umbral,
            "requisitos": ev["requisitos"],
            "propiedades": ev["propiedades"],
            "dimensiones": _dimensiones(ev, p, prm),
            "luz_rasante": luz,
            "horario": horario,
            "no_transfiere": list(prm["no_transfiere"]) if ES_TIERRA(p) else [],
            "medir_primero": decision.medir_primero(cambios, prm) if es_real else [],
            "dato_que_cambia": cambios,
            "robustez": {"primera_frac": (round(frac_reales.get(i, 0.0), 4) if (es_real and i in reales_eleg) else None),
                         "n": int(prm["robustez"]["n"]), "alfa": float(prm["robustez"]["dirichlet_alfa"])},
            "fuentes": _fuentes(p.get("fuentes"), ref.get("fuentes"), datos.get("fuentes")),
            "maqueta": bool(datos.get("maqueta", False)),
            "meta": meta,
        })
    indice = {
        "region": datos.get("region", ""),
        "umbral": umbral,
        "candidatas": [{
            "id": f["id"], "nombre": f["nombre"], "control": f["control"], "etiqueta": f["etiqueta"], "orden": f["orden"],
            "lugar": f["lugar"], "C": f["C"], "E": f["E"], "L": f["L"], "U": f["U"],
            "primera_frac": f["robustez"]["primera_frac"], "archivo": f"{f['id']}.json",
        } for f in sorted(fichas, key=lambda f: (f["orden"] is None, f["orden"] or 0, f["id"]))],
        "controles": {"recorte_primero": recorte_primero, "copias_en_orden": copias_en_orden, "vegetacion_rechazada": vegetacion,
                      "confiable": confiable, "recorte_primero_frac": (round(frac_todas.get(pos[0], 0.0), 4) if pos else None),
                      "detalle": detalle},
        "maqueta": bool(datos.get("maqueta", False)),
        "meta": meta,
    }
    return {"fichas": fichas, "indice": indice, "evaluaciones": evs, "por_id": por_id}
