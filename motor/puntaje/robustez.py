"""F12: robustez ante otros pesos.

    a_j = (1/N) Σ_k 1[rank_k(j) = 1],   w^(k) ~ Dirichlet(α·w)

Con N = 1.000 y α = 100 los pesos se mueven pocos puntos alrededor de los de la tarea. El orden usa
el criterio congelado en parametros.yaml (peor caso L; empate por C y después por id). La semilla
es fija para que el resultado sea reproducible.

Uso de SI: redactado con Claude Code; probado en test_puntaje.py.
"""
from __future__ import annotations

import numpy as np

from .compatibilidad import PROPIEDADES, combinar


def muestras_pesos(pesos: dict, n: int, alfa: float, semilla: int) -> np.ndarray:
    rng = np.random.default_rng(semilla)
    base = np.array([pesos[p] for p in PROPIEDADES], dtype=float)
    return rng.dirichlet(alfa * base, size=n)


def clave_orden(C, L, id_: str):
    return (-L, -(C if C is not None else -1.0), id_)


def ordenar(estado: dict) -> list[str]:
    """estado: id → (C, L). Devuelve los ids de mejor a peor."""
    return sorted(estado, key=lambda i: clave_orden(estado[i][0], estado[i][1], i))


def primera_frac(utils_por_id: dict, ids: list[str], prm: dict) -> dict:
    if not ids:
        return {}
    r = prm["robustez"]
    W = muestras_pesos(prm["pesos"], int(r["n"]), float(r["dirichlet_alfa"]), int(r["semilla"]))
    cuenta = {i: 0 for i in ids}
    for w in W:
        pesos = dict(zip(PROPIEDADES, w))
        estado = {}
        for i in ids:
            C, E, L, U = combinar(utils_por_id[i], pesos)
            estado[i] = (C, L)
        cuenta[ordenar(estado)[0]] += 1
    return {i: cuenta[i] / len(W) for i in ids}
