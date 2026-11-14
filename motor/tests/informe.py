"""Genera el informe de validación, la planilla de campo y el manifiesto parcial de la Parte 3.

    python -m motor.tests.informe

Escribe:
  informe/informe_validacion.md            a partir de salida/pruebas.json e informe/datos/*.json
  informe/planilla_medicion_2026-11-14.md  predicción minuto a minuto para la tablita (imprimible)
  salida/manifest_parte3.json              SHA-256 de cada archivo de salida/ (lo integra motor/exportar)

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import hashlib
import json
import pathlib

import parametros
from motor import __version__
from motor.sol import efemerides

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "salida"
DATOS = RAIZ / "informe" / "datos"
ICONO = {"pasa": "PASA", "falla": "FALLA", "pendiente": "PENDIENTE"}


def _leer(p):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def num(x, d=2):
    return "—" if x is None else f"{x:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def informe_validacion() -> str:
    pr = _leer(SALIDA / "pruebas.json")
    ctrl = _leer(DATOS / "control_sol_horizons.json")
    fl = {n: _leer(SALIDA / "destino" / f"ficha_liso_{n}.json") for n in ("verano", "invierno")}
    pc = _leer(DATOS / "puntaje_controles.json")
    campo = next(iter(sorted(DATOS.glob("campo_*.json"))), None)
    L = ["# Informe de validación · Parte 3 (motor físico)", "",
         f"Generado por `python -m motor.tests.informe` · motor {__version__} · parámetros `{parametros.huella()[:16]}…`", "",
         "Cada meta se escribió antes de ver el resultado (documento 02, §6) y se publica aunque no se cumpla. "
         "Una prueba sin comprobar figura como pendiente, nunca como aprobada.", ""]
    if pr:
        r = pr["resumen"]
        L += [f"**{r['total']} pruebas: {r['pasa']} pasan, {r['falla']} fallan, {r['pendiente']} pendientes.**", "",
              "| Prueba | Fórmula | Meta | Resultado | Estado | Datos | Dueño |", "|---|---|---|---|---|---|---|"]
        for p in pr["pruebas"]:
            res = p["resultado"]["texto"] if p["estado"] != "pendiente" else (p["motivo_pendiente"] or "")
            L.append(f"| {p['nombre_es']} | {p['formula'] or '—'} | {p['meta']['texto']} | {res} | {ICONO[p['estado']]} | {p['datos']} | {p['dueno']} |")
        L.append("")
    if ctrl:
        L += ["## Sol contra JPL Horizons", "", "| Consulta | Archivo | Puntos | Peor diferencia en elevación | Peor diferencia en azimut (× cos e) |",
              "|---|---|---:|---:|---:|"]
        for c in ctrl["controles"]:
            for a in c["archivos"]:
                L.append(f"| {c['carpeta']} | {a['archivo']} | {a['n']} | {a['max_dif_elevacion_deg']:.6f}° | {a['max_dif_azimut_deg']:.6f}° |")
        L += ["", "Skyfield con DE421 en el marco MOON_ME_DE421 (el de LOLA). La consulta del 14/11 se hizo el mismo día del hackatón, "
              "como pide el Método de trabajo. Meta: menos de 0,1°.", ""]
    if fl["verano"]:
        L += ["## El destino sin relieve (Sol real, horizonte liso)", "",
              "| Lunación | Sol máximo | Noche (centro del Sol bajo el horizonte) | Tramo con menos de 108,4 W | Batería mínima | En riesgo |",
              "|---|---:|---:|---:|---:|---|"]
        for n, f in fl.items():
            if f:
                r = f["resultado"]
                L.append(f"| {n} ({f['lunacion']['desde']} a {f['lunacion']['hasta']}) | {num(f['lunacion']['sol_max_deg'])}° | "
                         f"{num(r['noche_geometrica_h'], 0)} h | {num(r['tramo_oscuro_mas_largo_h'], 0)} h | {num(100 * r['bateria_minima_frac'], 0)} % | "
                         f"{'sí' if r['en_riesgo'] else 'no'} |")
        L += ["", "Sobre terreno liso un rover estacionado no sobrevive: la noche dura de 6 a 8 veces las 50 h de VIPER. "
              "Ver `informe/hallazgos_para_el_equipo.md`, hallazgo 1: los documentos decían 148 a 210 h.", ""]
    if pc:
        c = pc["controles"]
        L += ["## Controles de la búsqueda", "", f"Datos: {'MAQUETA (distribuciones inventadas para probar el código)' if pc['maqueta'] else 'reales'}.", ""]
        L += [f"- {d}" for d in c["detalle"]]
        L += [f"- Confiable: {c['confiable']}", f"- Redundancia pendiente y luz (H1b): ρ = {num(pc['redundancia_h1b']['rho'], 3)} "
              f"con {pc['redundancia_h1b']['n']} parcelas (meta ρ < 0,9)", ""]
    if campo:
        cp = _leer(campo)
        L += ["## Medición de sombras", "", f"{cp['n_en_rango']} mediciones con el Sol entre 5° y 15°; error máximo "
              f"{num(100 * cp['error_max_en_rango'] if cp['error_max_en_rango'] is not None else None, 1)} % (meta 5 %).", "",
              "| Hora | Sol aparente | Sombra medida | Calculada | Corregida por inclinación | Error | Avisos |", "|---|---:|---:|---:|---:|---:|---|"]
        for m in cp["mediciones"]:
            L.append(f"| {m['hora_local']} | {num(m['e_aparente_deg'])}° | {num(m['sombra_medida_m'])} m | {num(m['sombra_calculada_m'])} m | "
                     f"{num(m['sombra_corregida_m'])} m | {num(100 * m['error_corregido_frac'], 1)} % | {'; '.join(m['avisos'])} |")
        L.append("")
    L += ["## Fuentes de los cálculos", "", "- Efemérides y kernels (NAIF, JPL):"]
    L += [f"  - `{k['id']}` · SHA-256 `{k['sha256']}`" for k in efemerides.huellas()]
    L += ["- JPL Horizons API, consultas del 7/11/2026 y del 14/11/2026 en `motor/sol/referencia_horizons/`.", ""]
    return "\n".join(L) + "\n"


def planilla_campo() -> str:
    prm = parametros.cargar()
    c = prm["campo"]
    d = _leer(DATOS / f"prediccion_campo_{c['fecha']}.json")
    if not d:
        return ""
    L = [f"# Planilla de medición de sombras · {c['lugar']['nombre']} · {c['fecha']}", "",
         f"Tablita de {num(100 * c['tablita_alto_m'], 0)} cm de alto y al menos {num(100 * c['tablita_ancho_min_m'], 0)} cm de ancho. "
         f"Lugar: {c['lugar']['lat']}°, {c['lugar']['lon']}° ({c['lugar']['alt_m']} m). Hora de Paraguay (UTC−3).", "",
         "Protocolo (documento 02, §3.7): tablita vertical; suelo nivelado con 6 m libres hacia el este; medir la inclinación del suelo "
         "con el celular y anotarla; medir hasta el **centro de la zona difusa** de la punta; sincronizar la hora con la red y "
         "fotografiar cada medición con la hora a la vista (sin personas menores en las fotos).", "",
         "| Hora | Sol aparente | Azimut | Sombra esperada | Punta difusa | Ancho mínimo | Inclinación tolerada (5 %) |",
         "|---|---:|---:|---:|---:|---:|---:|"]
    for f in d["filas"]:
        if "sombra_m" in f and f["hora_local"] >= "17:45":
            L.append(f"| {f['hora_local']} | {num(f['e_aparente_deg'])}° | {num(f['azimut_deg'], 1)}° | **{num(f['sombra_m'])} m** | "
                     f"{num(100 * f['punta_difusa_m'], 0)} cm ({num(f['punta_difusa_pct'], 1)} %) | {num(f['ancho_minimo_cm'], 1)} cm | "
                     f"{num(f['tolerancia_nivel_deg'])}° |")
    L += ["", "La ventana de la prueba H2 (error ≤ 5 %) es con el Sol entre 15° y 5°: de 17:50 a 18:36. Después de 18:36 se puede "
          "seguir midiendo, pero la punta difusa crece rápido. Cargar las mediciones en `campo/medicion_2026-11-14.csv` con el "
          "formato de `informe/plantilla_medicion_campo.csv` y correr `python -m motor.tests.validacion`.", ""]
    return "\n".join(L) + "\n"


def manifiesto() -> dict:
    archivos = []
    for p in sorted(SALIDA.rglob("*")):
        if p.is_file() and p.name != "manifest_parte3.json" and not p.name.startswith("_") and "maqueta" not in p.relative_to(SALIDA).parts[:1]:
            obj = None
            if p.suffix == ".json":
                obj = json.loads(p.read_text(encoding="utf-8"))
            meta_bin = _leer(p.with_suffix(".json")) if p.suffix == ".bin" else None
            if p.suffix == ".png":                                   # los mapas heredan la marca del horizonte que los generó
                meta_bin = _leer(p.parent / "horizontes.json")
            maq = obj.get("maqueta") if isinstance(obj, dict) else (meta_bin or {}).get("maqueta")
            archivos.append({"archivo": str(p.relative_to(SALIDA)).replace("\\", "/"), "bytes": p.stat().st_size,
                             "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "maqueta": maq})
    return {"parte": 3, "dueno": "Jean", "archivos": archivos, "kernels": efemerides.huellas(),
            "meta": parametros.bloque_meta("manifest_parte3", __version__,
                                           notas=["motor/exportar copia estos archivos a web/public/data y verifica cada SHA-256."])}


def principal():
    (RAIZ / "informe" / "informe_validacion.md").write_text(informe_validacion(), encoding="utf-8")
    pl = planilla_campo()
    if pl:
        (RAIZ / "informe" / f"planilla_medicion_{parametros.obtener('campo.fecha')}.md").write_text(pl, encoding="utf-8")
    m = manifiesto()
    (SALIDA / "manifest_parte3.json").write_text(json.dumps(m, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"informe_validacion.md, planilla de campo y manifest_parte3.json ({len(m['archivos'])} archivos) escritos")


if __name__ == "__main__":
    principal()
