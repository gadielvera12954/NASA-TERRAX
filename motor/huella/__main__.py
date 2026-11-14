"""Distribuciones de huella para motor/puntaje (F8, F9, F16) con datos reales.

    python -m motor.huella                          # todas las etapas -> datos/distribuciones_payunia.json
    python -m motor.huella --etapas payunia medanos # solo lo que no necesita red
    python -m motor.huella --sin-ndvi               # sin Sentinel-2: ndvi_p90 = null ("No podemos concluir")

Cada etapa se guarda en datos/huella_etapas/ y se reutiliza (la conexión se corta): payunia y
medanos solo necesitan las teselas de Copernicus ya bajadas; luna, las grillas de LOLA del puente;
ndvi, conexión con Earth Search.

Qué arma (hallazgos_para_el_equipo.md, sección 3, y esquemas/distribuciones.schema.json):
* referencia: Mons Mouton, 30 x 30 km a 60 m (grillas de LOLA del puente; horizonte con capas hasta 300 km);
* 40 parcelas de 3 x 3 km en Payunia (Copernicus GLO-30 -> UTM 19S a 60 m), con 30 km de margen
  de relieve alrededor y preseleccionadas por el requisito de pendiente (mediana < 15°). El de
  vegetación (NDVI p90 < 0,20) lo evalúa motor/puntaje: una parcela que lo incumpla sale Incompatible;
* control positivo: recorte de 3 x 3 km del centro de Mons Mouton, más tres copias con ruido creciente
  en las alturas (σ = 2, 5 y 10 m, mismo código para todo);
* control negativo: una parcela de Médanos del Chaco (Paraguay), con vegetación.

Cada terreno lleva pendiente (F8), rugosidad a 200/400/800/1.600 m (F9), f̄(e) de 1,5° a 10° (F16),
NDVI p90, pendiente mediana y altura media (para la refracción del horario).

Decisiones que no fijaban los documentos (propuestas de SI, a confirmar por una persona):
* resumen de NDVI de una parcela = mediana de los NDVI p90 de sus píxeles;
* elección de las 40 parcelas: entre las que cumplen los requisitos, muestreo parejo a lo largo de la
  pendiente mediana (que haya terrenos suaves y abruptos), sin mirar la referencia lunar;
* f̄(e) de la referencia con 1 de cada 5 píxeles en filas y columnas (10.000 puntos);
* σ del ruido de los controles: 2, 5 y 10 m.

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import time

import numpy as np

import parametros
from esquemas.validar import validar
from motor.escala import reproyectar
from motor.horizonte.grilla import escribir_grilla, leer_grilla
from motor.horizonte.nucleo import Capa, calcular_horizontes_puntos
from motor.ingest import copernicus
from motor.ingest.remoto import DATOS, sha

from . import distribucion, luz, pendiente, rugosidad

PAYUNIA = {"tesela": (-37, -70), "lat": -36.5, "lon": -69.5, "lado_m": 84000.0, "alto_m": 106000.0}
MEDANOS = {"teselas": [(-21, -62), (-20, -62)], "lat": -20.15, "lon": -61.60, "lado_m": 66000.0}
N_PARCELAS = 40
RUIDO_M = (2.0, 5.0, 10.0)
SEMILLA = 20261114
NDVI_DESDE, NDVI_HASTA = "2025-11-01", "2026-10-31"
LUNA_SIN_VEGETACION = {"id": "luna_sin_vegetacion", "sha256": None,
                       "version": "La Luna no tiene vegetación: NDVI se declara 0 (no es una medición)"}


def informar(msg: str) -> None:
    print(f"[{dt.datetime.now():%H:%M:%S}] {msg}", flush=True)


class Mapas:
    """Pendiente y rugosidad de una grilla grande, calculadas una vez y recortadas por parcela."""

    def __init__(self, z: np.ndarray, pixel_m: float, escalas):
        self.z = z
        self.pendiente = pendiente.horn(z, pixel_m)
        self.rugosidad = {str(s): rugosidad.rugosidad(z, pixel_m, s) for s in escalas}

    def huella(self, f0: int, c0: int, alto: int, ancho: int) -> dict:
        v = (slice(f0, f0 + alto), slice(c0, c0 + ancho))
        b = self.pendiente[v]
        return {
            "pendiente_deg": distribucion.cuantiles(b),
            "rugosidad_m": {s: distribucion.cuantiles(r[v]) for s, r in self.rugosidad.items()},
            "pendiente_mediana_deg": round(float(np.nanmedian(b)), 3) if np.isfinite(b).any() else None,
            "alt_m": round(float(np.nanmean(self.z[v])), 1),
        }


def f_media(capas, pts, cuerpo: dict, prm: dict, e_deg) -> list[float]:
    hz = prm["horizonte"]
    h = calcular_horizontes_puntos(capas, pts, n_az=hz["azimutes_mapa"], altura_obs_m=hz["altura_observador_m"],
                                   radio_m=cuerpo["radio_m"], k=cuerpo["k"], d_max_m=cuerpo["d_max_m"],
                                   paso_rel=hz["paso_relativo"])
    return [round(x, 4) for x in luz.f_media(h.T, e_deg)]


def puntos(f0, c0, alto, ancho, paso=1):
    f, c = np.mgrid[f0:f0 + alto:paso, c0:c0 + ancho:paso]
    return np.stack([f.ravel(), c.ravel()], axis=1)


def cuerpo_de(prm, nombre):
    c = prm["cuerpos"][nombre]
    margen = prm["grilla"]["margen_luna_km" if nombre == "luna" else "margen_tierra_km"]
    return {"radio_m": c["radio_km"] * 1000.0, "k": c["k_refraccion"], "d_max_m": margen * 1000.0}


def terreno(id_, nombre, lat, lon, h, luz_f, e_deg, ndvi, fuentes, control=None, ruido=None) -> dict:
    t = {"id": id_, "nombre": nombre, "lugar": {"lat": round(lat, 5), "lon": round(lon, 5), "alt_m": h["alt_m"]},
         "control": control, "pendiente_deg": h["pendiente_deg"], "rugosidad_m": h["rugosidad_m"],
         "luz_rasante": {"e_deg": e_deg, "f_media": luz_f} if luz_f is not None else None,
         "ndvi_p90": ndvi, "pendiente_mediana_deg": h["pendiente_mediana_deg"],
         "material": None, "transitabilidad_fina": None, "horizonte_liso": False, "alt_m": h["alt_m"],
         "acuerdo_agencias": None, "fuentes": fuentes}
    if ruido is not None:
        t["ruido_nivel"] = ruido
    return t


# ------------------------------------------------------------------------------------- Luna
def luna(prm, e_deg) -> tuple[dict, list[dict], list[dict]]:
    g = DATOS / "grillas"
    obj, mo = leer_grilla(g / "mons_mouton_60m")
    mar, mm = leer_grilla(g / "mons_mouton_margen_60m")
    lej, ml = leer_grilla(g / "mons_mouton_lejano_240m")
    fuentes = mo["fuentes"] + mm["fuentes"] + ml["fuentes"]
    cuerpo = cuerpo_de(prm, "luna")
    escalas = prm["escalas_rugosidad_m"]
    n = int(round(prm["grilla"]["parcela_km"] * 1000 / obj.pixel_m))
    informar(f"Luna: referencia {obj.alto} x {obj.ancho} a {obj.pixel_m:.0f} m")
    mapas = Mapas(obj.z, obj.pixel_m, escalas)
    h_ref = mapas.huella(0, 0, obj.alto, obj.ancho)
    t0 = time.time()
    f_ref = f_media([obj, mar, lej], puntos(2, 2, obj.alto - 2, obj.ancho - 2, paso=5), cuerpo, prm, e_deg)
    informar(f"  f̄(e) de la referencia en {time.time() - t0:.0f} s")
    ref = terreno("MM-REF", "Mons Mouton (30 x 30 km, referencia)", -84.60, 31.00, h_ref, f_ref, e_deg, 0.0,
                  fuentes + [LUNA_SIN_VEGETACION])

    f0 = c0 = (obj.alto - n) // 2
    controles = []
    pts = puntos(f0, c0, n, n)
    h = mapas.huella(f0, c0, n, n)
    controles.append(terreno("CTRL-MM", "Mons Mouton, recorte de 3 x 3 km del centro (control positivo)", -84.60, 31.00,
                             h, f_media([obj, mar, lej], pts, cuerpo, prm, e_deg), e_deg, 0.0,
                             fuentes + [LUNA_SIN_VEGETACION], control="positivo"))
    rng = np.random.default_rng(SEMILLA)
    for nivel, sigma in enumerate(RUIDO_M, start=1):
        zr = obj.z.copy()
        zr[f0:f0 + n, c0:c0 + n] += rng.normal(0.0, sigma, (n, n)).astype(np.float32)
        capa_r = Capa(zr, obj.pixel_m, obj.x0, obj.y0, nombre=f"mons_mouton_ruido_{nivel}")
        h = Mapas(zr, obj.pixel_m, escalas).huella(f0, c0, n, n)
        controles.append(terreno(f"CTRL-MM-R{nivel}", f"Mons Mouton con ruido de {sigma:g} m (control)", -84.60, 31.00, h,
                                 f_media([capa_r, mar, lej], pts, cuerpo, prm, e_deg), e_deg, 0.0,
                                 fuentes + [LUNA_SIN_VEGETACION], control="positivo_ruido", ruido=nivel))
    informar("  controles lunares listos")
    return ref, controles, fuentes


# ------------------------------------------------------------------------------------- Tierra
def grilla_tierra(nombre: str, teselas, lat, lon, lado_m, alto_m=None) -> tuple[Capa, dict, list[dict]]:
    datos = [copernicus.bajar(*t) for t in teselas]
    (z, t, m), otras = datos[0], [(d[0], d[1]) for d in datos[1:]]
    g = reproyectar.a_utm(z, t, m["crs"], lat, lon, lado_m, alto_m, otras=otras)
    fuentes = [{"id": d[2]["id"], "sha256": d[2]["sha256"], "url": d[2]["url"], "version": d[2]["version"]} for d in datos]
    meta = {"nombre": nombre, "cuerpo": "tierra", "pixel_m": g["pixel_m"], "x0_m": g["x0_m"], "y0_m": g["y0_m"],
            "proyeccion": g["proyeccion"], "promediado": "Copernicus GLO-30 (1 segundo de arco) -> UTM a 60 m, remuestreo por promedio",
            "fuentes": fuentes, "maqueta": False}
    escribir_grilla(DATOS / "grillas" / nombre, g["z"], meta)
    capa = Capa(g["z"], g["pixel_m"], g["x0_m"], g["y0_m"], nombre=nombre)
    capa.epsg = g["epsg"]
    informar(f"Tierra: {nombre} {capa.alto} x {capa.ancho} a 60 m · {100 * np.isnan(g['z']).mean():.2f} % sin dato")
    return capa, meta, fuentes


def latlon_de(capa: Capa, fila: float, col: float) -> tuple[float, float]:
    from pyproj import Transformer
    x, y = capa.xy(fila, col)
    lon, lat = Transformer.from_crs(f"EPSG:{capa.epsg}", "EPSG:4326", always_xy=True).transform(float(x), float(y))
    return lat, lon


def ndvi_en(capa: Capa, fuentes_extra: list, usar_ndvi: bool):
    if not usar_ndvi:
        return None, None
    from pyproj import Transformer

    from motor.ingest import sentinel2
    tr = Transformer.from_crs(f"EPSG:{capa.epsg}", "EPSG:4326", always_xy=True)
    xs = [capa.x0, capa.x0 + capa.ancho * capa.pixel_m]
    ys = [capa.y0, capa.y0 - capa.alto * capa.pixel_m]
    lons, lats = zip(*[tr.transform(x, y) for x in xs for y in ys])
    grilla = {"epsg": capa.epsg, "x0_m": capa.x0, "y0_m": capa.y0, "pixel_m": capa.pixel_m, "alto": capa.alto, "ancho": capa.ancho}
    p90, prov = sentinel2.ndvi_p90(grilla, (min(lons), min(lats), max(lons), max(lats)), NDVI_DESDE, NDVI_HASTA, informar=informar)
    fuentes_extra.append({"id": prov["id"], "sha256": prov["sha256"],
                          "version": f"{prov['coleccion']}, {prov['desde']} a {prov['hasta']}, {prov['meses']} meses, "
                                     f"{len(prov['escenas'])} escenas con < {prov['nubes_max_pct']:.0f} % de nubes"})
    return p90, prov


def resumen_ndvi(p90, v) -> float | None:
    if p90 is None:
        return None
    w = p90[v]
    return round(float(np.nanmedian(w)), 4) if np.isfinite(w).mean() >= 0.5 else None


def payunia(prm, e_deg) -> dict:
    """Etapa sin red: las 40 parcelas con su huella. El NDVI se completa después (etapa `ndvi`)."""
    capa, meta, fuentes = grilla_tierra("payunia_60m", [PAYUNIA["tesela"]], PAYUNIA["lat"], PAYUNIA["lon"],
                                        PAYUNIA["lado_m"], PAYUNIA["alto_m"])
    p90 = None
    mapas = Mapas(capa.z, capa.pixel_m, prm["escalas_rugosidad_m"])
    n = int(round(prm["grilla"]["parcela_km"] * 1000 / capa.pixel_m))
    m = int(math.ceil(prm["grilla"]["margen_tierra_km"] * 1000 / capa.pixel_m))
    req = prm["requisitos"]
    candidatas = []
    for f0 in range(m, capa.alto - m - n + 1, n):
        for c0 in range(m, capa.ancho - m - n + 1, n):
            v = (slice(f0, f0 + n), slice(c0, c0 + n))
            if not np.isfinite(capa.z[f0 - m:f0 + n + m, c0 - m:c0 + n + m]).all():
                continue                                            # sin margen completo no se calcula el horizonte
            pend = float(np.nanmedian(mapas.pendiente[v]))
            ndvi = resumen_ndvi(p90, v)
            if pend >= req["pendiente_mediana_max_deg"] or (ndvi is not None and ndvi >= req["vegetacion_ndvi_p90_max"]):
                continue
            candidatas.append((pend, f0, c0, ndvi))
    if not candidatas:
        raise SystemExit("ninguna parcela de Payunia cumple los requisitos con margen completo")
    candidatas.sort()
    idx = sorted(set(np.linspace(0, len(candidatas) - 1, min(N_PARCELAS, len(candidatas))).round().astype(int)))
    elegidas = sorted((candidatas[i] for i in idx), key=lambda c: (c[1], c[2]))   # de norte a sur, de oeste a este
    informar(f"  {len(candidatas)} parcelas cumplen los requisitos; se eligen {len(elegidas)}")
    cuerpo = cuerpo_de(prm, "tierra")
    parcelas, t0 = [], time.time()
    for k, (_, f0, c0, ndvi) in enumerate(elegidas, start=1):
        lat, lon = latlon_de(capa, f0 + (n - 1) / 2, c0 + (n - 1) / 2)
        h = mapas.huella(f0, c0, n, n)
        fm = f_media([capa], puntos(f0, c0, n, n), cuerpo, prm, e_deg)
        t = terreno(f"P-{k:02d}", f"Payunia P-{k:02d}", lat, lon, h, fm, e_deg, ndvi, fuentes)
        t["_ventana"] = {"grilla": meta["nombre"], "f0": f0, "c0": c0, "n": n}
        parcelas.append(t)
        if k % 5 == 0:
            informar(f"  {k}/{len(elegidas)} parcelas · {time.time() - t0:.0f} s")
    return {"parcelas": parcelas, "fuentes": fuentes}


def medanos(prm, e_deg) -> dict:
    """Etapa sin red: la parcela de control negativo (el NDVI se completa en la etapa `ndvi`)."""
    capa, meta, fuentes = grilla_tierra("medanos_chaco_60m", MEDANOS["teselas"], MEDANOS["lat"], MEDANOS["lon"], MEDANOS["lado_m"])
    n = int(round(prm["grilla"]["parcela_km"] * 1000 / capa.pixel_m))
    f0, c0 = (capa.alto - n) // 2, (capa.ancho - n) // 2
    mapas = Mapas(capa.z, capa.pixel_m, prm["escalas_rugosidad_m"])
    h = mapas.huella(f0, c0, n, n)
    fm = f_media([capa], puntos(f0, c0, n, n), cuerpo_de(prm, "tierra"), prm, e_deg)
    lat, lon = latlon_de(capa, f0 + (n - 1) / 2, c0 + (n - 1) / 2)
    t = terreno("CTRL-MEDANOS", "Médanos del Chaco (control negativo)", lat, lon, h, fm, e_deg, None, fuentes, control="negativo")
    t["_ventana"] = {"grilla": meta["nombre"], "f0": f0, "c0": c0, "n": n}
    return {"terreno": t}


def ndvi(prm) -> dict:
    """Etapa con red: NDVI p90 anual (Sentinel-2) sobre las grillas de Payunia y Médanos."""
    salida = {}
    for nombre in ("payunia_60m", "medanos_chaco_60m"):
        capa, meta = leer_grilla(DATOS / "grillas" / nombre)
        pr = meta["proyeccion"]
        capa.epsg = (32700 if pr["hemisferio"] == "S" else 32600) + pr["zona"]
        fuentes: list[dict] = []
        p90, prov = ndvi_en(capa, fuentes, True)
        np.save(DATOS / "grillas" / f"{nombre}_ndvi_p90.npy", p90, allow_pickle=False)
        salida[nombre] = {"fuente": fuentes[0], "escenas": prov["escenas"]}
        informar(f"  NDVI {nombre}: {100 * np.isfinite(p90).mean():.0f} % de la grilla con dato")
    return salida


def completar_ndvi(t: dict, info_ndvi: dict | None) -> dict:
    """Pone el NDVI p90 de la parcela (mediana de sus píxeles) y quita la marca interna de ventana."""
    v = t.pop("_ventana", None)
    if v and info_ndvi and v["grilla"] in info_ndvi:
        p90 = np.load(DATOS / "grillas" / f"{v['grilla']}_ndvi_p90.npy")
        t["ndvi_p90"] = resumen_ndvi(p90, (slice(v["f0"], v["f0"] + v["n"]), slice(v["c0"], v["c0"] + v["n"])))
        t["fuentes"] = t["fuentes"] + [info_ndvi[v["grilla"]]["fuente"]]
    return t


def etapa(nombre: str, funcion, rehacer: bool):
    """Corre una etapa o reutiliza su resultado guardado (la red se corta: no se pierde lo calculado)."""
    ruta = DATOS / "huella_etapas" / f"{nombre}.json"
    if ruta.exists() and not rehacer:
        informar(f"etapa {nombre}: se reutiliza {ruta.name}")
        return json.loads(ruta.read_text(encoding="utf-8"))
    informar(f"etapa {nombre}")
    r = funcion()
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(r, ensure_ascii=False) + "\n", encoding="utf-8")
    return r


def principal(argv=None) -> dict:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--etapas", nargs="*", default=["payunia", "medanos", "luna", "ndvi"],
                   help="etapas a correr: payunia, medanos (sin red), luna (necesita las grillas de LOLA), ndvi (red)")
    p.add_argument("--sin-ndvi", action="store_true", help="armar el archivo sin NDVI (ndvi_p90 = null)")
    p.add_argument("--rehacer", action="store_true", help="recalcular aunque la etapa ya esté guardada")
    p.add_argument("--salida", default=str(DATOS / "distribuciones_payunia.json"))
    a = p.parse_args(argv)
    prm = parametros.cargar()
    e_deg = luz.grilla_e(prm)
    t0 = time.time()
    r: dict = {}
    if "payunia" in a.etapas:
        r["payunia"] = etapa("payunia", lambda: payunia(prm, e_deg), a.rehacer)
    if "medanos" in a.etapas:
        r["medanos"] = etapa("medanos", lambda: medanos(prm, e_deg), a.rehacer)
    if "luna" in a.etapas:
        if not (DATOS / "grillas" / "mons_mouton_60m.npy").exists():
            raise SystemExit("faltan las grillas de LOLA: correr python -m puente_lola.bajar")
        def _luna():
            ref, ctrl, fu = luna(prm, e_deg)
            return {"referencia": ref, "controles": ctrl, "fuentes": fu}
        r["luna"] = etapa("luna", _luna, a.rehacer)
    info_ndvi = None
    if "ndvi" in a.etapas and not a.sin_ndvi:
        try:
            info_ndvi = etapa("ndvi", lambda: ndvi(prm), a.rehacer)
        except OSError as err:
            informar(f"NDVI sin red ({err.__class__.__name__}): el archivo sale con ndvi_p90 = null")
    if not {"payunia", "medanos", "luna"} <= set(r):
        informar("etapas guardadas; falta alguna para armar el archivo final")
        return {}
    parcelas = [completar_ndvi(t, info_ndvi) for t in r["payunia"]["parcelas"]]
    neg = completar_ndvi(r["medanos"]["terreno"], info_ndvi)
    ctrl_luna = r["luna"]["controles"]
    datos = {"region": "payunia", "referencia": r["luna"]["referencia"], "parcelas": parcelas + ctrl_luna + [neg],
             "fuentes": r["luna"]["fuentes"] + r["payunia"]["fuentes"] + neg["fuentes"], "maqueta": False}
    validar(datos, "distribuciones")
    import pathlib
    salida = pathlib.Path(a.salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(datos, ensure_ascii=False, indent=1) + "\n"
    salida.write_text(texto, encoding="utf-8")
    resumen = {"archivo": str(salida), "sha256": sha(np.frombuffer(texto.encode("utf-8"), dtype=np.uint8)),
               "parcelas": len(parcelas), "controles": len(ctrl_luna) + 1, "ndvi": info_ndvi is not None,
               "parametros_sha256": parametros.huella(), "minutos": round((time.time() - t0) / 60, 1),
               "generado_utc": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}
    salida.with_name(salida.stem + "_resumen.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    informar(f"escrito {salida} · {resumen['parcelas']} parcelas + {resumen['controles']} controles · {resumen['minutos']} min")
    return resumen


if __name__ == "__main__":
    principal()
