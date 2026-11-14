"""F9: rugosidad = dispersión de alturas respecto del plano ajustado en una ventana circular.

    σ_w = √( (1/N) Σ (z_k − (a x_k + b y_k + c))² )

En una ventana simétrica centrada en la celda, Σx = Σy = Σxy = 0, así que el ajuste por mínimos
cuadrados se separa:  c = media(z),  a = Σ x z / Σ x²,  b = Σ y z / Σ y²,  y

    σ_w² = media(z²) − c² − a²·Σx²/N − b²·Σy²/N

Cada suma es una correlación de la grilla con un núcleo fijo, así que se calcula para todas las
celdas a la vez (SciPy). Para que la resta no pierda precisión se trabaja con z menos la media de la
grilla. Una celda cuya ventana toca algún dato faltante o sale de la grilla queda NaN.

Diferencia con el mapa de NASA (documento 02, sección 3.4): NASA mide la dispersión de cada disparo
láser; aquí se usan celdas de 60 m. Misma idea, no la misma medida: se compara por orden (ρ), no
por igualdad.

Uso de SI: redactado con Claude Code para la Parte 4; lo prueba motor/tests/test_parte4_huella.py.
"""
from __future__ import annotations

import numpy as np
from scipy import ndimage


def mascara_circular(diametro_m: float, pixel_m: float) -> np.ndarray:
    """Celdas cuyo centro cae dentro del círculo de diámetro `diametro_m` (incluye el borde)."""
    r = diametro_m / 2.0 / pixel_m
    n = int(np.floor(r))
    f, c = np.mgrid[-n:n + 1, -n:n + 1]
    return (f * f + c * c) <= r * r + 1e-9


def rugosidad(z: np.ndarray, pixel_m: float, diametro_m: float) -> np.ndarray:
    m = mascara_circular(diametro_m, pixel_m).astype(np.float64)
    n = m.sum()
    if n < 4:
        raise ValueError(f"una ventana de {diametro_m} m a {pixel_m} m por celda tiene menos de 4 celdas")
    rad = (m.shape[0] - 1) // 2
    fy, cx = np.mgrid[-rad:rad + 1, -rad:rad + 1]
    x = cx * pixel_m * m
    y = -fy * pixel_m * m                            # la fila crece hacia −y
    sxx, syy = float((x * x).sum()), float((y * y).sum())

    z = np.asarray(z, dtype=np.float64)
    valido = np.isfinite(z)
    base = float(np.nanmean(z)) if valido.any() else 0.0
    zc = np.where(valido, z - base, 0.0)
    corr = lambda a, k: ndimage.correlate(a, k, mode="constant", cval=0.0)  # noqa: E731
    s1, s2 = corr(zc, m), corr(zc * zc, m)
    sx, sy = corr(zc, x), corr(zc, y)
    cuenta = corr(valido.astype(np.float64), m)
    c = s1 / n
    var = s2 / n - c * c - (sx / sxx) ** 2 * sxx / n - (sy / syy) ** 2 * syy / n
    sigma = np.sqrt(np.clip(var, 0.0, None)).astype(np.float32)
    # Ventana completa y con todos sus datos (fuera de la grilla cuenta como faltante): lo contrario
    # sería inventar.
    completa = cuenta >= n - 0.5
    sigma[~completa] = np.nan
    return sigma
