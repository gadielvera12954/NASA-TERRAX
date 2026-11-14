"""Horizonte por píxel y azimut, con curvatura y margen (F2), acelerado con Numba.

    e_h(α) = max_{d>0} atan( (z(d, α) − z0 − Δz(d)) / d ),   Δz(d) = (1 − k)·d²/(2R)

Cómo se recorre cada rayo
-------------------------
* El rayo sale del centro del píxel en la dirección α (azimut de la grilla, horario desde +y).
* El perfil z(d, α) se toma en los puntos donde el rayo cruza las líneas que unen centros de
  celdas (columnas y filas de la grilla). En cada cruce la altura es la combinación lineal de las
  dos celdas vecinas sobre esa línea. Es la misma superficie lineal por tramos que usa HORAYZON
  (triangulación entre centros, plan B del documento 02). No se crea ninguna grilla más fina:
  solo se evalúa el perfil exactamente sobre el rayo.
* Por qué así y no "celda más cercana": con la celda más cercana, cerca del observador se toman
  centros fuera del rayo y el máximo se calcula sobre un abanico de direcciones; en la superficie
  gaussiana eso agrega de 3 a 6 puntos de sombra frente a Smith (F17) en los azimutes oblicuos
  (ver informe/puerta_horizonte.md). Sobre el rayo exacto el sesgo desaparece.
* Lejos del observador se saltean cruces: el siguiente cruce se busca después de d·paso_relativo.
* Cada punto usa la capa más fina que lo contiene (las capas de margen cubren hasta 30 km en la
  Tierra y hasta 300 km en la Luna). El rayo termina al salir de todas las capas o al pasar d_max.
* `periodico=True` (solo laboratorio sintético) envuelve la grilla como un toro.

Uso de SI: redactado con Claude Code; lo prueban test_horizonte_poste.py, test_horizonte_esfera.py
y test_horizonte_cuenco_gaussiana.py (Puerta Horizonte).
"""
from __future__ import annotations

import dataclasses
import math
from typing import Iterable, Sequence

import numba
import numpy as np


@dataclasses.dataclass
class Capa:
    """Grilla de alturas en una proyección métrica. Ver esquemas/grilla_entrada.md.

    z[f, c]: altura (m) del centro de la celda. x0, y0: centro de la celda [0, 0].
    La columna crece hacia +x y la fila hacia −y.
    """

    z: np.ndarray
    pixel_m: float
    x0: float = 0.0
    y0: float = 0.0
    nombre: str = ""

    def __post_init__(self):
        self.z = np.ascontiguousarray(self.z, dtype=np.float32)
        if self.z.ndim != 2 or min(self.z.shape) < 2:
            raise ValueError("Capa.z debe ser una matriz 2D de al menos 2 × 2")
        self.pixel_m = float(self.pixel_m)
        self.x0 = float(self.x0)
        self.y0 = float(self.y0)

    @property
    def alto(self) -> int:
        return int(self.z.shape[0])

    @property
    def ancho(self) -> int:
        return int(self.z.shape[1])

    def xy(self, fila, col):
        return self.x0 + np.asarray(col) * self.pixel_m, self.y0 - np.asarray(fila) * self.pixel_m


@numba.njit(cache=True, inline="always")
def _capa_en(x, y, n_capas, alto, ancho, x0, y0, px, periodico):
    """Índice de la capa más fina donde el punto se puede interpolar, o −1."""
    for L in range(n_capas):
        u = (x - x0[L]) / px[L]
        v = (y0[L] - y) / px[L]
        if periodico:
            return L
        if u >= 0.0 and u <= ancho[L] - 1 and v >= 0.0 and v <= alto[L] - 1:
            return L
    return -1


@numba.njit(cache=True, inline="always")
def _z(z_flat, o, H, W, i, j, periodico):
    if periodico:
        i = i % H
        j = j % W
    return z_flat[o + i * W + j]


@numba.njit(parallel=True, cache=True)
def _rayos(z_flat, off, alto, ancho, x0, y0, px, filas, cols, z_obs, sin_az, cos_az,
           c_curv, d_max, paso_rel, periodico, out):
    n_capas = alto.shape[0]
    n_p = filas.shape[0]
    n_az = sin_az.shape[0]
    INF = np.inf
    for ip in numba.prange(n_p):
        xo = x0[0] + cols[ip] * px[0]
        yo = y0[0] - filas[ip] * px[0]
        zo = z_obs[ip]
        if zo != zo:
            for ia in range(n_az):
                out[ia, ip] = np.nan
            continue
        for ia in range(n_az):
            sa = sin_az[ia]
            ca = cos_az[ia]
            if abs(sa) < 1e-12:
                sa = 0.0
            if abs(ca) < 1e-12:
                ca = 0.0
            mejor = -INF
            d = 0.0
            while True:
                dt = d + d * paso_rel
                xt = xo + sa * dt
                yt = yo + ca * dt
                L = _capa_en(xt, yt, n_capas, alto, ancho, x0, y0, px, periodico)
                if L < 0:
                    break
                P = px[L]
                ut = (xt - x0[L]) / P
                vt = (y0[L] - yt) / P
                uo = (xo - x0[L]) / P
                vo = (y0[L] - yo) / P
                # Próximo cruce con una línea de columnas (u entero) y con una de filas (v entero).
                dc = INF
                if sa > 0.0:
                    jl = math.floor(ut) + 1.0
                    dc = (jl - uo) * P / sa
                elif sa < 0.0:
                    jl = math.ceil(ut) - 1.0
                    dc = (jl - uo) * P / sa
                dr = INF
                if ca > 0.0:
                    il = math.ceil(vt) - 1.0
                    dr = (vo - il) * P / ca
                elif ca < 0.0:
                    il = math.floor(vt) + 1.0
                    dr = (vo - il) * P / ca
                ds = dc if dc < dr else dr
                if ds > d_max or ds == INF:
                    break
                if ds < 0.5 * px[0]:
                    # Cruce degenerado sobre el propio centro del observador (redondeo en d ≈ 0):
                    # el primer cruce legítimo está siempre a una celda o más.
                    d = ds
                    continue
                x = xo + sa * ds
                y = yo + ca * ds
                u = (x - x0[L]) / P
                v = (y0[L] - y) / P
                H = alto[L]
                W = ancho[L]
                o = off[L]
                fuera = (not periodico) and (u < -1e-9 or u > W - 1 + 1e-9 or v < -1e-9 or v > H - 1 + 1e-9)
                if not fuera:
                    if dc <= dr:
                        # cruce de una línea de columnas: interpolar a lo largo de la columna
                        j = int(math.floor(u + 0.5))
                        i = int(math.floor(v))
                        if not periodico and i > H - 2:
                            i = H - 2
                        if not periodico and i < 0:
                            i = 0
                        t = v - i
                        za = _z(z_flat, o, H, W, i, j, periodico)
                        zb = _z(z_flat, o, H, W, i + 1, j, periodico)
                    else:
                        # cruce de una línea de filas: interpolar a lo largo de la fila
                        i = int(math.floor(v + 0.5))
                        j = int(math.floor(u))
                        if not periodico and j > W - 2:
                            j = W - 2
                        if not periodico and j < 0:
                            j = 0
                        t = u - j
                        za = _z(z_flat, o, H, W, i, j, periodico)
                        zb = _z(z_flat, o, H, W, i, j + 1, periodico)
                    if t < 0.0:
                        t = 0.0
                    if t > 1.0:
                        t = 1.0
                    if t == 0.0:
                        zz = za
                    elif t == 1.0:
                        zz = zb
                    else:
                        zz = za * (1.0 - t) + zb * t
                    if zz == zz:
                        tg = (zz - zo - c_curv * ds * ds) / ds
                        if tg > mejor:
                            mejor = tg
                d = ds
            out[ia, ip] = math.degrees(math.atan(mejor))


def _preparar(capas: Sequence[Capa]):
    if not capas:
        raise ValueError("hace falta al menos una capa (la grilla objetivo)")
    z_flat = np.concatenate([c.z.ravel() for c in capas]).astype(np.float32)
    tam = np.array([c.z.size for c in capas], dtype=np.int64)
    off = np.concatenate([[0], np.cumsum(tam)[:-1]]).astype(np.int64)
    alto = np.array([c.alto for c in capas], dtype=np.int64)
    ancho = np.array([c.ancho for c in capas], dtype=np.int64)
    x0 = np.array([c.x0 for c in capas], dtype=np.float64)
    y0 = np.array([c.y0 for c in capas], dtype=np.float64)
    px = np.array([c.pixel_m for c in capas], dtype=np.float64)
    return z_flat, off, alto, ancho, x0, y0, px


def azimutes(n_az: int) -> np.ndarray:
    """Azimutes de la grilla, en grados: 0, 360/n, 2·360/n, …"""
    return np.arange(n_az, dtype=np.float64) * (360.0 / n_az)


def _curvatura(radio_m, k) -> float:
    if radio_m is None or not math.isfinite(radio_m):
        return 0.0
    return (1.0 - k) / (2.0 * float(radio_m))


def calcular_horizontes_puntos(capas: Sequence[Capa], puntos: Iterable[tuple[int, int]], n_az: int = 360,
                               altura_obs_m: float = 1.0, radio_m: float | None = None, k: float = 0.0,
                               d_max_m: float | None = None, paso_rel: float = 0.001,
                               periodico: bool = False) -> np.ndarray:
    """Horizonte (grados) de los píxeles pedidos de la primera capa. Devuelve (n_puntos, n_az).

    −90° significa que ningún punto del rayo tapa (solo puede pasar en un plano sin curvatura).
    """
    pts = np.asarray(list(puntos), dtype=np.int64).reshape(-1, 2)
    if periodico and len(capas) != 1:
        raise ValueError("el modo periódico admite una sola capa")
    if periodico and d_max_m is None:
        raise ValueError("el modo periódico necesita d_max_m")
    z_flat, off, alto, ancho, x0, y0, px = _preparar(capas)
    filas = np.ascontiguousarray(pts[:, 0])
    cols = np.ascontiguousarray(pts[:, 1])
    if np.any((filas < 0) | (filas >= alto[0]) | (cols < 0) | (cols >= ancho[0])):
        raise IndexError("hay puntos fuera de la grilla objetivo")
    z_obs = capas[0].z[filas, cols].astype(np.float64) + float(altura_obs_m)
    az = np.radians(azimutes(n_az))
    out = np.empty((n_az, pts.shape[0]), dtype=np.float32)
    _rayos(z_flat, off, alto, ancho, x0, y0, px, filas, cols, z_obs, np.sin(az), np.cos(az),
           _curvatura(radio_m, k), float("inf") if d_max_m is None else float(d_max_m),
           float(paso_rel), bool(periodico), out)
    return out.T.copy()


def calcular_horizontes(capas: Sequence[Capa], n_az: int = 72, altura_obs_m: float = 1.0,
                        radio_m: float | None = None, k: float = 0.0, d_max_m: float | None = None,
                        paso_rel: float = 0.001, periodico: bool = False) -> np.ndarray:
    """Horizonte de todos los píxeles de la primera capa. Devuelve (n_az, alto, ancho) en grados."""
    alto, ancho = capas[0].alto, capas[0].ancho
    f, c = np.mgrid[0:alto, 0:ancho]
    pts = np.stack([f.ravel(), c.ravel()], axis=1)
    h = calcular_horizontes_puntos(capas, pts, n_az=n_az, altura_obs_m=altura_obs_m, radio_m=radio_m, k=k,
                                   d_max_m=d_max_m, paso_rel=paso_rel, periodico=periodico)
    return np.ascontiguousarray(h.T.reshape(n_az, alto, ancho))


def margen_minimo_m(capas: Sequence[Capa]) -> float:
    """Distancia mínima desde un píxel de la grilla objetivo hasta el borde de la capa más extensa.

    Si es menor que el margen pedido (30 km en la Tierra, 300 km en la Luna), los rayos de esos
    píxeles salen de los datos antes de tiempo y su horizonte es solo una cota inferior.
    """
    obj = capas[0]
    x0, x1 = obj.x0, obj.x0 + (obj.ancho - 1) * obj.pixel_m
    y1, y0 = obj.y0, obj.y0 - (obj.alto - 1) * obj.pixel_m
    mejor = 0.0
    for c in capas:
        cx0, cx1 = c.x0, c.x0 + (c.ancho - 1) * c.pixel_m
        cy1, cy0 = c.y0, c.y0 - (c.alto - 1) * c.pixel_m
        m = min(x0 - cx0, cx1 - x1, y0 - cy0, cy1 - y1)
        mejor = max(mejor, m)
    return float(mejor)


def sombra_mapa(horizontes_deg: np.ndarray, az_grilla_deg: float, e_deg: float) -> np.ndarray:
    """Máscara de sombra con la misma regla del contrato: azimut más cercano y e < e_h."""
    n_az = horizontes_deg.shape[0]
    k = int(math.floor(az_grilla_deg / (360.0 / n_az) + 0.5)) % n_az
    return e_deg < horizontes_deg[k]


def horizonte_en_azimut(horizonte_puntos: np.ndarray, az_grilla_deg) -> np.ndarray:
    """Horizonte de un punto (…, n_az) evaluado en azimutes arbitrarios, por azimut más cercano."""
    n_az = horizonte_puntos.shape[-1]
    k = (np.floor(np.asarray(az_grilla_deg, dtype=np.float64) / (360.0 / n_az) + 0.5).astype(np.int64)) % n_az
    return horizonte_puntos[..., k]
