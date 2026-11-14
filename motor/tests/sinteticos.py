"""Terrenos sintéticos con respuesta conocida (laboratorio sintético del documento 02, §6).

Cada generador devuelve un diccionario simple (`z`, `pixel_m`, `x0`, `y0` y datos de la respuesta
calculada a mano), para no depender del código que se está probando.

    z[f, c]  altura en metros del centro de la celda (fila 0 = norte de la grilla)
    x0, y0   coordenadas del centro de la celda [0, 0]; x crece con la columna, y baja con la fila

Respuestas a mano usadas por las pruebas:
    F1  poste en plano: largo de sombra s = h / tan(e)
    F2  esfera perfecta: ningún píxel en sombra por relieve con el Sol sobre 0°;
        torre de altura h sobre la esfera: horizonte = −sqrt(2h/R) rad en toda dirección
    cuenco esférico de radio de borde Rc y profundidad D: sombra interna sobre la línea central
        L = 2·(Rc − tan(e)·zc) / (1 + tan²(e)),  con ρ = (Rc² + D²)/(2D) y zc = ρ − D
    F17 superficie gaussiana de pendiente RMS w: fracción en sombra de Smith (1967)

Uso de SI: redactado con Claude Code a partir del documento 02; las respuestas se derivan a mano
en los comentarios y se pueden comprobar con papel y lápiz.
"""
from __future__ import annotations

import math

import numpy as np


def plano_con_poste(n: int = 201, pixel_m: float = 1.0, alto_poste_m: float = 5.0) -> dict:
    """Plano z = 0 con un poste de una celda en el centro (F1)."""
    z = np.zeros((n, n), dtype=np.float32)
    c = n // 2
    z[c, c] = alto_poste_m
    return {"z": z, "pixel_m": pixel_m, "x0": 0.0, "y0": 0.0, "poste": (c, c), "alto_m": alto_poste_m}


def largo_sombra_teorico(alto_m: float, e_deg: float) -> float:
    """F1: s = h / tan(e)."""
    return alto_m / math.tan(math.radians(e_deg))


def esfera(n: int = 101, pixel_m: float = 60.0, x0: float = 0.0, y0: float = 0.0) -> dict:
    """Esfera perfecta: en una grilla de altura sobre la esfera de referencia, z ≡ 0 (F2)."""
    return {"z": np.zeros((n, n), dtype=np.float32), "pixel_m": pixel_m, "x0": x0, "y0": y0}


def capa_lejana_esfera(radio_km: float = 300.0, pixel_m: float = 600.0) -> dict:
    """Capa de margen de la esfera, centrada en el mismo origen que `esfera` (relieve hasta 300 km)."""
    n = int(round(2 * radio_km * 1000 / pixel_m)) + 1
    mitad = (n - 1) / 2 * pixel_m
    return {"z": np.zeros((n, n), dtype=np.float32), "pixel_m": pixel_m, "x0": -mitad, "y0": mitad}


def depresion_horizonte_teorica_deg(alto_m: float, radio_m: float) -> float:
    """Torre de altura h sobre una esfera lisa: max_d atan((−h − d²/2R)/d) = −sqrt(2h/R) (rad).

    Derivación: f(d) = −h/d − d/(2R) es una tangente; f'(d) = h/d² − 1/(2R) = 0 → d* = sqrt(2Rh);
    f(d*) = −2·sqrt(h/(2R)) = −sqrt(2h/R). El ángulo es atan(f(d*)): con h = 5 km y
    R = 1.737,4 km, atan(0,07587) = −4,3385° (el documento 02 dice "unos 4,3°").
    """
    return -math.degrees(math.atan(math.sqrt(2 * alto_m / radio_m)))


def cuenco(n: int = 121, pixel_m: float = 1.0, radio_borde_m: float = 40.0, profundidad_m: float = 10.0) -> dict:
    """Cráter en cuenco: casquete esférico hundido en un plano z = 0."""
    c = n // 2
    f, k = np.mgrid[0:n, 0:n]
    x = (k - c) * pixel_m
    y = (c - f) * pixel_m
    r2 = x * x + y * y
    rho = (radio_borde_m ** 2 + profundidad_m ** 2) / (2 * profundidad_m)
    zc = rho - profundidad_m
    z = np.zeros((n, n), dtype=np.float64)
    dentro = r2 < radio_borde_m ** 2
    z[dentro] = zc - np.sqrt(rho * rho - r2[dentro])
    return {"z": z.astype(np.float32), "pixel_m": pixel_m, "x0": float(-c * pixel_m), "y0": float(c * pixel_m),
            "centro": (c, c), "radio_borde_m": radio_borde_m, "profundidad_m": profundidad_m, "rho_m": rho, "zc_m": zc}


def sombra_cuenco_teorica_m(radio_borde_m: float, profundidad_m: float, e_deg: float) -> float:
    """Largo de la sombra interna sobre la línea central, medido desde el borde que da al Sol.

    Rayo desde el borde (x = Rc, z = 0) hacia el interior con pendiente −tan(e); casquete
    (x² + (z − zc)² = ρ²). Con v = Rc − x la ecuación queda v·[(1 + t²)·v + 2·t·zc − 2·Rc] = 0
    (el término constante se anula porque zc² + Rc² − ρ² = 0), y la raíz no nula es
    v = 2·(Rc − t·zc)/(1 + t²). Si es negativa, el Sol está más alto que la pared y no hay sombra.
    """
    rho = (radio_borde_m ** 2 + profundidad_m ** 2) / (2 * profundidad_m)
    zc = rho - profundidad_m
    t = math.tan(math.radians(e_deg))
    return max(0.0, 2 * (radio_borde_m - t * zc) / (1 + t * t))


def gaussiana(n: int = 512, pixel_m: float = 1.0, pendiente_rms_deg: float = 10.0, largo_correlacion_px: float = 8.0,
              semilla: int = 1967) -> dict:
    """Superficie gaussiana periódica con correlación gaussiana (para comparar con Smith, F17).

    Con C(r) = σ²·exp(−r²/ℓ²), la pendiente direccional tiene varianza 2σ²/ℓ², así que
    σ = w·ℓ/√2 para una pendiente RMS w = tan(pendiente_rms). La pendiente RMS que usan las
    pruebas se mide sobre la superficie generada (diferencias finitas), no se supone.
    """
    rng = np.random.default_rng(semilla)
    ruido = rng.standard_normal((n, n))
    kx = np.fft.fftfreq(n)
    ky = np.fft.fftfreq(n)
    k2 = kx[None, :] ** 2 + ky[:, None] ** 2
    # Espectro de la correlación gaussiana exp(−r²/ℓ²): ∝ exp(−π²·ℓ²·k²); amplitud = raíz.
    filtro = np.exp(-0.5 * (math.pi ** 2) * (largo_correlacion_px ** 2) * k2)
    z = np.real(np.fft.ifft2(np.fft.fft2(ruido) * filtro))
    z -= z.mean()
    w = math.tan(math.radians(pendiente_rms_deg))
    sigma_obj = w * largo_correlacion_px * pixel_m / math.sqrt(2.0)
    z *= sigma_obj / z.std()
    zx = (np.roll(z, -1, axis=1) - z) / pixel_m
    zy = (np.roll(z, -1, axis=0) - z) / pixel_m
    w_medida = float(np.sqrt(0.5 * (np.mean(zx ** 2) + np.mean(zy ** 2))))
    return {"z": z.astype(np.float32), "pixel_m": pixel_m, "x0": 0.0, "y0": 0.0, "w": w_medida,
            "w_nominal": w, "largo_correlacion_px": largo_correlacion_px}


def smith_fraccion_sombra(e_deg: float, w: float) -> float:
    """F17 (Smith, 1967): fracción en sombra esperada, con μ = tan(e) y pendiente RMS w (tangente)."""
    mu = math.tan(math.radians(e_deg))
    x = mu / (math.sqrt(2.0) * w)
    lam = 0.5 * (math.sqrt(2.0 / math.pi) * (w / mu) * math.exp(-mu * mu / (2 * w * w)) - math.erfc(x))
    s = (1.0 - 0.5 * math.erfc(x)) / (1.0 + lam)
    return 1.0 - s


def luna_sintetica(n: int = 160, pixel_m: float = 60.0, semilla: int = 84) -> dict:
    """Terreno lunar de MAQUETA para corridas de punta a punta (no es dato real).

    Meseta suave con cráteres en cuenco y una loma, en una grilla polar estereográfica centrada en
    el centro oficial de Mons Mouton (84,60°S, 31,00°E), para que la geometría del Sol sea la real.
    Todo lo que se calcule con este terreno sale con "maqueta": true.
    """
    rng = np.random.default_rng(semilla)
    radio_m = 1737400.0
    lat, lon = math.radians(-84.60), math.radians(31.00)
    rho = 2 * radio_m * math.tan(math.pi / 4 + lat / 2)
    xc, yc = rho * math.sin(lon), rho * math.cos(lon)
    c = (n - 1) / 2
    f, k = np.mgrid[0:n, 0:n]
    x = (k - c) * pixel_m
    y = (c - f) * pixel_m
    z = 40.0 * np.sin(x / 3100.0) * np.cos(y / 2700.0) + 0.004 * x
    for _ in range(14):
        cx, cy = rng.uniform(-0.45, 0.45, 2) * n * pixel_m
        rb = rng.uniform(250, 1400)
        d = rb * rng.uniform(0.12, 0.2)
        r2 = (x - cx) ** 2 + (y - cy) ** 2
        rr = (rb * rb + d * d) / (2 * d)
        dentro = r2 < rb * rb
        z[dentro] += (rr - d) - np.sqrt(rr * rr - r2[dentro])
    z += 350.0 * np.exp(-(((x - 2500) ** 2) + ((y + 1500) ** 2)) / (2 * 1200.0 ** 2))
    # Un macizo alto cerca de un borde: en la meseta real los refugios son los puntos que sobresalen.
    z += 3800.0 * np.exp(-(((x + 0.3 * n * pixel_m) ** 2) + ((y - 0.25 * n * pixel_m) ** 2)) / (2 * 1700.0 ** 2))
    x0 = xc - c * pixel_m
    y0 = yc + c * pixel_m
    return {"z": z.astype(np.float32), "pixel_m": pixel_m, "x0": float(x0), "y0": float(y0),
            "proyeccion": {"tipo": "polar_estereografica_sur", "radio_m": radio_m, "lon0_deg": 0.0},
            "cuerpo": "luna", "maqueta": True}


E_LUZ = [round(1.5 + 0.5 * i, 1) for i in range(18)]   # 1,5° a 10° cada 0,5° (parametros: luz_rasante)


def _terreno_maqueta(rng, id_, nombre, lat, lon, forma, escala, rug_medianas, ndvi, sesgo_luz=0.0, control=None, ruido=0,
                     alt_m=0.0) -> dict:
    """Una parcela de MAQUETA con la forma de esquemas/distribuciones.schema.json."""
    pend = np.clip(rng.gamma(forma, escala, 2500), 0.0, 60.0)
    w = math.sqrt(np.mean(np.tan(np.radians(pend)) ** 2) / 2.0)          # pendiente RMS direccional
    f = np.array([smith_fraccion_sombra(e, w) for e in E_LUZ])
    f = np.clip(f * (1.0 + sesgo_luz * (np.array(E_LUZ) - 5.0) / 10.0), 0.0, 1.0)
    rug = {str(s): {"valores": np.round(rng.lognormal(math.log(m), 0.45, 600), 3).tolist()}
           for s, m in zip((200, 400, 800, 1600), rug_medianas)}
    return {
        "id": id_, "nombre": nombre, "lugar": {"lat": lat, "lon": lon}, "control": control, "ruido_nivel": ruido,
        "pendiente_deg": {"valores": np.round(pend, 3).tolist()}, "rugosidad_m": rug,
        "luz_rasante": {"e_deg": E_LUZ, "f_media": np.round(f, 4).tolist()},
        "ndvi_p90": ndvi, "pendiente_mediana_deg": round(float(np.median(pend)), 3),
        "material": None, "transitabilidad_fina": None, "alt_m": alt_m,
        "fuentes": [{"id": "maqueta_terra_x", "sha256": None}],
    }


def distribuciones_maqueta(semilla: int = 2026) -> dict:
    """Distribuciones de huella de MAQUETA (no son datos reales): referencia, 8 parcelas y controles.

    Sirven para probar el puntaje y para que la web tenga datos con la forma del contrato mientras
    llegan los reales de motor/huella. Todo sale con "maqueta": true.
    """
    rng = np.random.default_rng(semilla)
    ref = _terreno_maqueta(rng, "MM-REF", "Mons Mouton (recorte, maqueta)", -84.60, 31.00, 2.2, 2.8, (1.8, 4.0, 8.5, 17.0), 0.0)
    ref["control"] = None
    parcelas = []
    sitios = [("P-01", -36.22, -69.48, 1.6, 2.2, (1.2, 2.6, 5.5, 11.0), 0.08, 0.10),
              ("P-03", -36.27, -69.31, 3.0, 3.6, (2.6, 5.9, 12.5, 25.0), 0.06, -0.05),
              ("P-07", -36.41, -69.20, 2.1, 2.9, (1.9, 4.3, 9.1, 18.0), 0.07, 0.04),
              ("P-09", -36.36, -68.98, 2.4, 2.4, (1.6, 3.8, 7.6, 15.5), 0.11, 0.00),
              ("P-12", -36.30, -68.92, 1.2, 1.6, (0.8, 1.7, 3.6, 7.0), 0.05, 0.02),
              ("P-15", -36.49, -69.37, 2.6, 3.9, (2.9, 6.4, 13.8, 27.0), 0.09, 0.06),
              ("P-19", -36.62, -69.12, 2.0, 2.6, (1.7, 3.9, 8.2, 16.4), 0.13, -0.08),
              ("P-23", -36.58, -69.05, 2.3, 3.0, (2.0, 4.4, 9.4, 19.0), 0.12, 0.03)]
    for id_, lat, lon, forma, escala, rug, ndvi, sesgo in sitios:
        parcelas.append(_terreno_maqueta(rng, id_, f"Payunia {id_} (maqueta)", lat, lon, forma, escala, rug, ndvi, sesgo,
                                         alt_m=float(rng.uniform(1500, 2200))))
    recorte = json_copia(ref)
    recorte.update({"id": "CTRL-MM", "nombre": "Recorte de Mons Mouton (control positivo)", "control": "positivo", "ndvi_p90": 0.0})
    parcelas.append(recorte)
    for k in (1, 2, 3):
        c = json_copia(ref)
        pend = np.array(c["pendiente_deg"]["valores"]) * (1.0 + 0.06 * k) + rng.normal(0, 0.15 * k, 2500)
        c["pendiente_deg"] = {"valores": np.round(np.clip(pend, 0, 60), 3).tolist()}
        for s in c["rugosidad_m"]:
            v = np.array(c["rugosidad_m"][s]["valores"]) * (1.0 + 0.07 * k) * rng.lognormal(0, 0.03 * k, 600)
            c["rugosidad_m"][s] = {"valores": np.round(v, 3).tolist()}
        f = np.clip(np.array(c["luz_rasante"]["f_media"]) + 0.015 * k, 0, 1)
        c["luz_rasante"]["f_media"] = np.round(f, 4).tolist()
        c.update({"id": f"CTRL-MM-R{k}", "nombre": f"Recorte de Mons Mouton con ruido {k} (control)", "control": "positivo_ruido",
                  "ruido_nivel": k, "ndvi_p90": 0.0, "pendiente_mediana_deg": round(float(np.median(pend)), 3)})
        parcelas.append(c)
    medanos = _terreno_maqueta(rng, "CTRL-MEDANOS", "Médanos del Chaco (control negativo)", -20.15, -61.60, 2.2, 2.8,
                               (1.8, 4.0, 8.5, 17.0), 0.45, control="negativo", alt_m=250.0)
    parcelas.append(medanos)
    return {"region": "payunia", "referencia": ref, "parcelas": parcelas, "fuentes": [{"id": "maqueta_terra_x", "sha256": None}],
            "maqueta": True}


def json_copia(obj):
    import json as _json
    return _json.loads(_json.dumps(obj))


def luna_sintetica_lejana(base: dict, radio_km: float = 120.0, pixel_m: float = 480.0, semilla: int = 85) -> dict:
    """Capa de margen de MAQUETA alrededor de `luna_sintetica` (relieve lejano)."""
    rng = np.random.default_rng(semilla)
    n = int(round(2 * radio_km * 1000 / pixel_m)) + 1
    c = (n - 1) / 2
    nb = base["z"].shape[0]
    xc = base["x0"] + (nb - 1) / 2 * base["pixel_m"]
    yc = base["y0"] - (nb - 1) / 2 * base["pixel_m"]
    f, k = np.mgrid[0:n, 0:n]
    x = (k - c) * pixel_m
    y = (c - f) * pixel_m
    z = 300.0 * np.sin(x / 21000.0 + 0.4) * np.cos(y / 17000.0)
    for _ in range(25):
        cx, cy = rng.uniform(-0.5, 0.5, 2) * n * pixel_m
        z += rng.uniform(150, 900) * np.exp(-(((x - cx) ** 2) + ((y - cy) ** 2)) / (2 * rng.uniform(3000, 9000) ** 2))
    # Mons Mouton es una meseta de ~100 km que se eleva ~6.000 m sobre lo que la rodea (doc02 §2.6):
    # el terreno cae 6 km entre 45 y 75 km del centro.
    r = np.hypot(x, y)
    s = np.clip((r - 45000.0) / 30000.0, 0.0, 1.0)
    z -= 6000.0 * s * s * (3.0 - 2.0 * s)
    return {"z": z.astype(np.float32), "pixel_m": pixel_m, "x0": float(xc - c * pixel_m), "y0": float(yc + c * pixel_m),
            "proyeccion": base["proyeccion"], "cuerpo": "luna", "maqueta": True}
