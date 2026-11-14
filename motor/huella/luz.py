"""F16: respuesta del terreno a la luz rasante.

    f(e, A) = (1/N) Σ_p 1[e < e_h,p(A)]        f̄(e) = (1/N_A) Σ_A f(e, A)

`h` es la máscara de horizontes de motor/horizonte (Jean): h[azimut, fila, col] en grados. f̄(e)
promedia todos los azimuts y describe el TERRENO: es lo que se compara entre la Luna y la Tierra,
con la elevación geométrica en los dos mundos (la refracción solo entra en el horario).
Los píxeles sin dato (NaN en todos los azimutes) no cuentan.

Uso de SI: redactado con Claude Code para la Parte 4; lo prueba motor/tests/test_parte4_huella.py.
"""
from __future__ import annotations

import numpy as np


def grilla_e(prm: dict) -> list[float]:
    """Alturas del Sol de parametros.yaml (luz_rasante: 1,5° a 10° cada 0,5°)."""
    lr = prm["luz_rasante"]
    n = int(round((lr["e_max_deg"] - lr["e_min_deg"]) / lr["e_paso_deg"])) + 1
    return [round(lr["e_min_deg"] + i * lr["e_paso_deg"], 3) for i in range(n)]


def f_media(h: np.ndarray, e_deg) -> list[float]:
    h = np.asarray(h, dtype=np.float32)
    if h.ndim == 2:                                   # (n_puntos, n_az) o (n_az, n_puntos)
        h = h[:, :, None]
    validos = np.isfinite(h).all(axis=0)              # píxel con horizonte en todos los azimutes
    if not validos.any():
        raise ValueError("no hay ningún píxel con horizonte completo")
    hv = h[:, validos]                                # (n_az, n_validos)
    return [float(np.mean(e < hv)) for e in np.asarray(e_deg, dtype=np.float32)]
