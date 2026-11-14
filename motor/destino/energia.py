"""Energía del rover: disco solar visible, paneles, batería y condiciones críticas (F3 a F7).

F3  f_sol = 1 − (1/π)(arccos x − x·√(1 − x²)),  x = recorte((e − e_h)/ρ, −1, 1),  ρ = 0,267°
F4  P_i = P_max · max(0, n_i·s) · f_sol,  con n_i·s = cos e · cos(A_sol − ψ − a_i) para paneles verticales
F5  E(t+Δt) = min(E_max, max(0, E(t) + (Σ P_i − P_cons)·Δt))
F6  P_surv ≤ E_max / 50 h = 108,4 W
F7  riesgo si (i) T_osc > 50 h, (ii) min E < E_res o (iii) pendiente local > 15°

Generalización de F4 para la comparación A/B en pendiente: el cuerpo del rover se inclina β hacia
la dirección pendiente abajo γ (rotación de Rodrigues sobre el eje horizontal perpendicular), y se
usa n_i·s con vectores 3D. Con β = 0 da exactamente F4 (lo comprueba test_destino.py).

Uso de SI: redactado con Claude Code a partir del documento 02.
"""
from __future__ import annotations

import math

import numpy as np

RHO_SOL_DEG = 0.267
LADOS_VIPER = (0.0, 90.0, 180.0)


def fraccion_disco(e_deg, eh_deg, rho_deg: float = RHO_SOL_DEG):
    """F3: fracción visible del disco solar sobre un horizonte de altura e_h."""
    x = np.clip((np.asarray(e_deg, dtype=float) - np.asarray(eh_deg, dtype=float)) / rho_deg, -1.0, 1.0)
    f = 1.0 - (np.arccos(x) - x * np.sqrt(1.0 - x * x)) / math.pi
    f = np.clip(f, 0.0, 1.0)
    return float(f) if np.ndim(f) == 0 else f


def _vector_sol(e_deg, a_deg):
    e = np.radians(np.asarray(e_deg, dtype=float))
    a = np.radians(np.asarray(a_deg, dtype=float))
    return np.stack([np.cos(e) * np.sin(a), np.cos(e) * np.cos(a), np.sin(e)], axis=-1)


def _normales(psi_deg, lados_deg, inclinacion_deg: float, orientacion_pendiente_deg: float):
    """Normales de los paneles en ENU: (..., n_paneles, 3)."""
    psi = np.asarray(psi_deg, dtype=float)[..., None]
    lados = np.asarray(lados_deg, dtype=float)
    ang = np.radians(psi + lados)
    n = np.stack([np.sin(ang), np.cos(ang), np.zeros_like(ang)], axis=-1)
    if inclinacion_deg:
        b = math.radians(inclinacion_deg)
        g = math.radians(orientacion_pendiente_deg)
        eje = np.array([-math.cos(g), math.sin(g), 0.0])           # z × (dirección pendiente abajo)
        cb, sb = math.cos(b), math.sin(b)
        n = n * cb + np.cross(eje, n) * sb + eje * (n @ eje)[..., None] * (1.0 - cb)
    return n


def potencia_paneles(e_deg, a_sol_deg, psi_deg, lados_deg=LADOS_VIPER, panel_w: float = 320.0, fsol=1.0,
                     inclinacion_deg: float = 0.0, orientacion_pendiente_deg: float = 0.0):
    """F4 por panel. Con escalares devuelve (n_paneles,); con series (n, n_paneles)."""
    s = _vector_sol(e_deg, a_sol_deg)
    n = _normales(psi_deg, lados_deg, inclinacion_deg, orientacion_pendiente_deg)
    coseno = np.einsum("...pk,...k->...p", n, s)
    # Incidencia rasante exacta (90°) da ±1e-16 por redondeo: se toma como 0 W.
    coseno = np.where(coseno > 1e-12, coseno, 0.0)
    return panel_w * coseno * np.asarray(fsol, dtype=float)[..., None]


def potencia_total(e_deg, a_sol_deg, psi_deg, lados_deg=LADOS_VIPER, panel_w: float = 320.0, fsol=1.0,
                   inclinacion_deg: float = 0.0, orientacion_pendiente_deg: float = 0.0):
    p = potencia_paneles(e_deg, a_sol_deg, psi_deg, lados_deg, panel_w, fsol, inclinacion_deg, orientacion_pendiente_deg).sum(axis=-1)
    return float(p) if np.ndim(p) == 0 else p


def p_surv(bateria_wh: float = 5420.0, supervivencia_h: float = 50.0) -> float:
    """F6: cota del consumo medio de supervivencia (5.420 Wh / 50 h = 108,4 W)."""
    return bateria_wh / supervivencia_h


def bateria(p_total_w, p_cons_w, paso_h: float, e_max_wh: float, e0_wh: float) -> np.ndarray:
    """F5. Devuelve E en los n+1 instantes (E[0] = e0, E[k+1] después del paso k)."""
    p = np.asarray(p_total_w, dtype=float)
    cons = np.broadcast_to(np.asarray(p_cons_w, dtype=float), p.shape)
    e = np.empty(p.size + 1)
    e[0] = e0_wh
    for k in range(p.size):
        e[k + 1] = min(e_max_wh, max(0.0, e[k] + (p[k] - cons[k]) * paso_h))
    return e


def tramos(mascara) -> list[tuple[int, int]]:
    m = np.asarray(mascara, dtype=bool)
    if not m.any():
        return []
    d = np.diff(np.concatenate([[0], m.astype(np.int8), [0]]))
    return list(zip(np.nonzero(d == 1)[0].tolist(), (np.nonzero(d == -1)[0] - 1).tolist()))


def tramo_oscuro(p_total_w, p_surv_w: float, paso_h: float) -> float:
    """F7: largo (h) del tramo continuo más largo con potencia menor a P_surv."""
    return max(((b - a + 1) * paso_h for a, b in tramos(np.asarray(p_total_w) < p_surv_w)), default=0.0)


def condiciones(tramo_oscuro_h: float, bateria_min_wh: float, reserva_wh: float, pendiente_deg: float,
                limite_h: float = 50.0, pendiente_max_deg: float = 15.0) -> dict:
    """F7: las tres condiciones críticas. Basta una para que la operación esté en riesgo."""
    return {
        "oscuridad": bool(tramo_oscuro_h > limite_h),
        "bateria": bool(bateria_min_wh < reserva_wh),
        "pendiente": bool(pendiente_deg > pendiente_max_deg),
    }


def en_riesgo(c: dict) -> bool:
    return bool(c["oscuridad"] or c["bateria"] or c["pendiente"])


def pendiente_horn_deg(z: np.ndarray, fila: int, col: int, pixel_m: float) -> float:
    """Pendiente local en un píxel con la vecindad 3 × 3 de Horn (la misma fórmula F8 de huella)."""
    f0, f1 = max(fila - 1, 0), min(fila + 1, z.shape[0] - 1)
    c0, c1 = max(col - 1, 0), min(col + 1, z.shape[1] - 1)
    w = z[f0:f1 + 1, c0:c1 + 1].astype(float)
    if w.shape != (3, 3):
        return float("nan")
    z1, z2, z3 = w[0]
    z4, _, z6 = w[1]
    z7, z8, z9 = w[2]
    zx = ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8 * pixel_m)
    zy = ((z7 + 2 * z8 + z9) - (z1 + 2 * z2 + z3)) / (8 * pixel_m)
    return math.degrees(math.atan(math.hypot(zx, zy)))
