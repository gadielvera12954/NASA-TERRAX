"""Corre el plan de validación del documento 02 (§6) y escribe pruebas.json para la pantalla Tests.

    python -m motor.tests.validacion

Reglas (Método de trabajo y documento 02):
  * Cada meta se escribió antes de ver el resultado y se publica aunque no se cumpla.
  * pruebas.json lleva TODAS las pruebas, también las que fallan y las que todavía no se pueden correr.
  * Una prueba sin comprobar figura como "pendiente", nunca como aprobada. Una prueba "contra el
    mundo real" corrida con datos de maqueta también queda pendiente (con el resultado de la maqueta
    en el detalle).

Las pruebas de otros dueños (rugosidad contra NASA, paridad en el navegador, verificador de la SI,
prueba con personas) se cargan desde informe/datos/externos/<id>.json cuando su dueño las corre:
    {"estado": "pasa" | "falla", "valor": <número o booleano>, "texto": "...", "evidencia": "...",
     "ejecutada_utc": "2026-11-15T12:00:00Z"}

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import pathlib

import numpy as np

import parametros
from esquemas.validar import validar
from motor import __version__
from motor.destino import energia
from motor.horizonte import Capa, calcular_horizontes, calcular_horizontes_puntos, formato, sombra_mapa
from motor.puntaje import compatibilidad, fichas
from motor.tests import campo, sinteticos

RAIZ = pathlib.Path(__file__).resolve().parents[2]
DATOS = RAIZ / "informe" / "datos"
AHORA = lambda: dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def prueba(id_, grupo, en, es, formula, demuestra, meta_texto, meta_valor, unidad, comparacion, dueno, evidencia):
    return {"id": id_, "grupo": grupo, "nombre_en": en, "nombre_es": es, "formula": formula, "demuestra": demuestra,
            "meta": {"texto": meta_texto, "valor": meta_valor, "unidad": unidad, "comparacion": comparacion},
            "resultado": {"valor": None, "texto": "Todavía no se corrió"}, "estado": "pendiente", "motivo_pendiente": None,
            "datos": "ninguno", "dueno": dueno, "evidencia": evidencia, "ejecutada_utc": None}


def cerrar(p, valor, texto, pasa: bool, datos: str, detalle=None):
    p["resultado"] = {"valor": valor, "texto": texto, **({"detalle": detalle} if detalle else {})}
    p["estado"] = "pasa" if pasa else "falla"
    p["datos"] = datos
    p["ejecutada_utc"] = AHORA()
    return p


def pendiente(p, motivo, datos="ninguno", detalle=None, texto=None):
    p["estado"] = "pendiente"
    p["motivo_pendiente"] = motivo
    p["datos"] = datos
    if detalle or texto:
        p["resultado"] = {"valor": None, "texto": texto or "Pendiente", **({"detalle": detalle} if detalle else {})}
    return p


def _leer(ruta: pathlib.Path):
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None


# ------------------------------------------------------------------ respuesta conocida ----------
def p_poste(prm):
    p = prueba("poste_plano", "respuesta_conocida", "Post on a plane", "Poste en plano", "F1", "El cálculo de sombras es correcto",
               "Error de 1 píxel o menos", prm["validacion"]["poste_error_max_px"], "px", "<=", "Jean", "motor/tests/test_horizonte_poste.py")
    t = sinteticos.plano_con_poste(201, 1.0, 5.0)
    h = calcular_horizontes([Capa(t["z"], 1.0, t["x0"], t["y0"])], n_az=72, altura_obs_m=0.0, radio_m=None)
    from motor.tests.test_horizonte_poste import error_poste
    peor, casos = 0.0, 0
    for az in range(0, 360, 45):
        for e in (5.0, 7.0, 10.0, 15.0):
            err = error_poste(t, h, float(az), e)[0]
            peor = max(peor, err)
            casos += 1
    return cerrar(p, round(peor, 3), f"{peor:.2f} px en {casos} casos (8 azimutes × 4 alturas de Sol)", peor <= 1.0, "sinteticos")


def p_esfera(prm):
    p = prueba("esfera_perfecta", "respuesta_conocida", "Perfect sphere", "Esfera perfecta", "F2", "La curvatura está bien corregida",
               "0 píxeles en sombra por relieve", 0, "px", "==", "Jean", "motor/tests/test_horizonte_esfera.py")
    obj = sinteticos.esfera(101, 60.0, -3000.0, 3000.0)
    lej = sinteticos.capa_lejana_esfera(300.0, 600.0)
    capas = [Capa(obj["z"], 60.0, obj["x0"], obj["y0"]), Capa(lej["z"], 600.0, lej["x0"], lej["y0"])]
    R = prm["cuerpos"]["luna"]["radio_km"] * 1000.0
    h = calcular_horizontes(capas, 72, 1.0, R, 0.0)
    total = sum(int(sombra_mapa(h, float(az), e).sum()) for az in range(0, 360, 5) for e in (0.1, 1.5, 3.0, 7.0))
    obj["z"][50, 50] = 5000.0
    torre = calcular_horizontes_puntos([Capa(obj["z"], 60.0, obj["x0"], obj["y0"]), capas[1]], [(50, 50)], 360, 0.0, R)[0]
    teo = sinteticos.depresion_horizonte_teorica_deg(5000.0, R)
    return cerrar(p, total, f"{total} píxeles en sombra (101 × 101 píxeles, 72 azimutes, Sol de 0,1° a 7°)", total == 0, "sinteticos",
                  {"torre_5km_horizonte_deg": round(float(torre.mean()), 4), "torre_5km_teorico_deg": round(teo, 4)})


def p_gaussiana(prm):
    v = prm["validacion"]
    p = prueba("superficie_gaussiana", "respuesta_conocida", "Gaussian surface vs Smith", "Superficie gaussiana contra Smith", "F17",
               "El horizonte da la estadística correcta", "f dentro de 3 puntos de la curva teórica, de 2° a 15°", v["gaussiana_error_max_puntos"],
               "puntos", "<=", "Jean", "motor/tests/test_horizonte_cuenco_gaussiana.py")
    from motor.tests.test_horizonte_cuenco_gaussiana import fraccion_en_sombra_gaussiana
    alturas = np.arange(v["gaussiana_e_min_deg"], v["gaussiana_e_max_deg"] + 0.01, 1.0)
    detalle, peor = {}, 0.0
    for rms in (5.0, 10.0, 20.0):
        fs, ft = fraccion_en_sombra_gaussiana(rms, alturas)
        d = float(np.max(np.abs(fs - ft)) * 100)
        detalle[f"rms_{int(rms)}"] = round(d, 2)
        peor = max(peor, d)
    return cerrar(p, round(peor, 2), f"{peor:.1f} puntos de diferencia máxima (pendiente RMS de 5°, 10° y 20°)", peor <= 3.0, "sinteticos", detalle)


def p_cuenco(prm):
    p = prueba("cuenco_sintetico", "respuesta_conocida", "Synthetic bowl crater", "Cuenco sintético", None, "Sombra de un cráter con resultado conocido",
               "Largo de sombra interna dentro de 1 píxel", prm["validacion"]["cuenco_error_max_px"], "px", "<=", "Jean",
               "motor/tests/test_horizonte_cuenco_gaussiana.py")
    t = sinteticos.cuenco(121, 1.0, 40.0, 10.0)
    h = calcular_horizontes([Capa(t["z"], 1.0, t["x0"], t["y0"])], 72, 0.0, None)
    fc, cc = t["centro"]
    peor = 0.0
    for e in (5.0, 10.0, 20.0):
        fila = sombra_mapa(h, 90.0, e)[fc]
        xs = (np.arange(fila.size) - cc) * 1.0
        s = xs[(np.abs(xs) < 40.0) & fila]
        calc = (40.0 - s.min()) if s.size else 0.0
        peor = max(peor, abs(calc - sinteticos.sombra_cuenco_teorica_m(40.0, 10.0, e)))
    return cerrar(p, round(peor, 3), f"{peor:.2f} px de diferencia máxima (Sol a 5°, 10° y 20°)", peor <= 1.0, "sinteticos")


def p_esquina(prm):
    v = prm["vehiculo"]
    p = prueba("esquina_viper", "respuesta_conocida", "VIPER corner, 450 W", "Esquina de VIPER", "F4", "El modelo de paneles es razonable",
               "Dentro del 1 % de 450 W", 100 * prm["validacion"]["esquina_viper_error_frac"], "%", "<=", "Jean", "motor/tests/test_destino.py")
    pw = energia.potencia_total(5.0, 45.0, 0.0, v["lados_deg"], v["panel_w"])
    err = abs(pw - v["esquina_publicada_w"]) / v["esquina_publicada_w"]
    return cerrar(p, round(100 * err, 3), f"{pw:.1f} W con el Sol a 5° en una esquina: {100 * err:.2f} % de diferencia", err <= 0.01, "sinteticos")


def p_caso_a_mano(prm):
    c = prm["validacion"]["caso_a_mano"]
    p = prueba("caso_a_mano", "respuesta_conocida", "Hand-worked case", "Caso a mano", "F11", "Las fórmulas están bien programadas",
               "0,705 y 0,955", None, "", "==", "Jean", "motor/tests/test_puntaje.py")
    L, U = compatibilidad.limites(c["C"], c["E"])
    ok = math.isclose(L, c["L"], abs_tol=5e-4) and math.isclose(U, c["U"], abs_tol=5e-4)
    return cerrar(p, None, f"L = {L:.3f} y U = {U:.3f}", ok, "sinteticos")


def p_sol_horizons(prm):
    p = prueba("sol_luna_horizons", "respuesta_conocida", "Sun vs JPL Horizons", "Sol contra JPL Horizons", None, "La geometría solar es correcta",
               "Menos de 0,1° frente a Horizons", prm["validacion"]["sol_horizons_max_deg"], "°", "<", "Jean", "informe/datos/control_sol_horizons.json")
    ctrl = _leer(DATOS / "control_sol_horizons.json")
    if not ctrl:
        return pendiente(p, "Correr: python -m motor.sol control --consultar")
    peor = max(c["peor_dif_deg"] for c in ctrl["controles"])
    luna = max(c["peor_dif_luna_deg"] for c in ctrl["controles"])
    carpetas = ", ".join(c["carpeta"] for c in ctrl["controles"])
    return cerrar(p, round(peor, 6), f"{luna:.5f}° en la Luna y {peor:.4f}° en total (consultas de Horizons: {carpetas})",
                  peor < prm["validacion"]["sol_horizons_max_deg"], "reales", {"consultas": carpetas})


def p_reproducibilidad(prm):
    p = prueba("reproducibilidad", "respuesta_conocida", "Reproducibility hash", "Reproducibilidad", None, "Otro equipo obtiene lo mismo",
               "Mismos archivos, mismo código de verificación", None, "", "==", "Jean", "motor/tests/validacion.py")
    t = sinteticos.cuenco(61, 1.0, 20.0, 5.0)
    hashes = []
    for _ in range(2):
        h = calcular_horizontes([Capa(t["z"], 1.0, t["x0"], t["y0"])], 72, 1.0, None)
        b = formato.codificar(h).tobytes()
        out = fichas.puntuar(sinteticos.distribuciones_maqueta(), prm, con_horario=False)
        s = json.dumps([{k: f[k] for k in ("id", "C", "E", "L", "U", "etiqueta", "orden", "robustez")} for f in out["fichas"]], sort_keys=True)
        hashes.append(hashlib.sha256(b + s.encode()).hexdigest())
    return cerrar(p, hashes[0] == hashes[1], f"Dos corridas dan el mismo SHA-256 ({hashes[0][:12]}…)", hashes[0] == hashes[1], "sinteticos")


# ------------------------------------------------------------------ mundo real ---------------
def p_iluminacion(prm):
    v = prm["validacion"]
    p = prueba("iluminacion_nasa", "mundo_real", "NASA illumination map, ρ", "Iluminación promedio contra NASA", "F13",
               "Las sombras con relieve real se parecen a las de NASA", "ρ de 0,8 o más, en el mismo período de 18,6 años",
               v["iluminacion_nasa_rho_min"], "ρ", ">=", "Jean", "informe/datos/iluminacion_nasa.json")
    r = _leer(DATOS / "iluminacion_nasa.json")
    if not r:
        return pendiente(p, "Faltan la grilla real de Mons Mouton y el mapa AVGVISIB de PGDA 69 (motor/ingest y motor/escala, Mathias). "
                            "Con ellos: python -m motor.destino iluminacion")
    return cerrar(p, round(r["rho"], 3), f"ρ = {r['rho']:.2f}, error cuadrático medio {r['rmse_puntos']:.1f} puntos ({r['n']} puntos)",
                  r["rho"] >= v["iluminacion_nasa_rho_min"], "maqueta" if r.get("maqueta") else "reales")


def _externa(p, archivo, motivo):
    r = _leer(DATOS / "externos" / archivo)
    if not r:
        return pendiente(p, motivo)
    p["evidencia"] = r.get("evidencia", p["evidencia"])
    return cerrar(p, r.get("valor"), r.get("texto", ""), r.get("estado") == "pasa", r.get("datos", "reales"))


def p_puntaje(prm):
    c = _leer(DATOS / "puntaje_controles.json")
    pos = prueba("control_positivo", "mundo_real", "Mons Mouton crop ranks first", "El recorte de Mons Mouton queda primero", None,
                 "La búsqueda encuentra lo que debe encontrar", "Recorte lunar primero; copias con ruido en orden", None, "", "orden", "Jean",
                 "salida/fichas/indice.json")
    neg = prueba("control_negativo", "mundo_real", "Vegetated parcel rejected", "La parcela con vegetación sale Incompatible", None,
                 "Un requisito incumplido no se compensa", "Médanos del Chaco sale \"Incompatible\"", None, "", "etiqueta", "Jean",
                 "salida/fichas/indice.json")
    red = prueba("redundancia_h1b", "mundo_real", "Grazing light adds information (H1b)", "La luz rasante aporta algo propio (H1b)", "F16, F17",
                 "La luz rasante aporta algo propio", "ρ menor a 0,9; si no, se baja su peso y se dice", prm["validacion"]["redundancia_rho_max"],
                 "ρ", "<", "Jean", "informe/datos/puntaje_controles.json")
    if not c:
        return [pendiente(x, "Correr python -m motor.puntaje con las distribuciones de huella") for x in (pos, neg, red)]
    ctl, h1b = c["controles"], c["redundancia_h1b"]
    if c.get("maqueta"):
        motivo = "Faltan las distribuciones reales de huella (Mathias, domingo 8:00). El resultado con la maqueta está en el detalle."
        det = {"maqueta_recorte_primero": ctl["recorte_primero"], "maqueta_copias_en_orden": ctl["copias_en_orden"],
               "maqueta_vegetacion_rechazada": ctl["vegetacion_rechazada"], "maqueta_rho_h1b": h1b["rho"]}
        return [pendiente(pos, motivo, "maqueta", det), pendiente(neg, motivo, "maqueta", det), pendiente(red, motivo, "maqueta", det)]
    ok_pos = bool(ctl["recorte_primero"] and ctl["copias_en_orden"])
    cerrar(pos, ok_pos, "; ".join(ctl["detalle"][:2]), ok_pos, "reales")
    cerrar(neg, bool(ctl["vegetacion_rechazada"]), ctl["detalle"][-1] if ctl["detalle"] else "", bool(ctl["vegetacion_rechazada"]), "reales")
    if h1b["rho"] is None:
        pendiente(red, "Hacen falta al menos 4 parcelas con pendiente y luz rasante")
    else:
        cerrar(red, round(h1b["rho"], 3), f"ρ = {h1b['rho']:.2f} entre {h1b['n']} parcelas", h1b["rho"] < prm["validacion"]["redundancia_rho_max"], "reales")
    return [pos, neg, red]


def p_campo(prm):
    c = prm["campo"]
    p = prueba("medicion_atardecer", "mundo_real", "Sunset shadows, Ciudad del Este", "Sombras al atardecer en Ciudad del Este", "F14",
               "La geometría se transfiere a la Tierra", "Error de 5 % o menos, de 5° a 15°", 100 * c["meta_error_frac"], "%", "<=", "Jean",
               "campo/medicion_2026-11-14.csv")
    ruta = campo.buscar_medicion(RAIZ, c["fecha"])
    if not ruta:
        return pendiente(p, "La medición se hace el sábado 14/11 de 17:50 a 18:36 (si llueve, el domingo). Cargarla en campo/medicion_2026-11-14.csv "
                            "con el formato de informe/plantilla_medicion_campo.csv")
    r = campo.comparar(campo.leer_csv(ruta), c["lugar"], c["fecha"], prm)
    (DATOS / f"campo_{c['fecha']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if r["n_en_rango"] == 0:
        return pendiente(p, "No hay mediciones con el Sol entre 5° y 15°", "reales")
    return cerrar(p, round(100 * r["error_max_en_rango"], 2), f"{100 * r['error_max_en_rango']:.1f} % de error máximo en {r['n_en_rango']} mediciones",
                  r["pasa"], "reales")


def p_paridad(prm):
    p = prueba("paridad_python_navegador", "respuesta_conocida", "Python and browser give the same shadow", "Paridad Python y navegador", None,
               "Lo que se ve es lo que se calculó", "Misma sombra en 1.000 casos de prueba", prm["validacion"]["paridad_casos"], "casos", "==",
               "Erwan (navegador) · Jean (archivo)", "salida/destino/paridad.json")
    par = _leer(RAIZ / "salida" / "destino" / "paridad.json")
    det = {"casos_en_el_archivo": len(par["casos"]) if par else 0, "sha256_horizontes": par["sha256_horizontes"] if par else None}
    r = _leer(DATOS / "externos" / "paridad_navegador.json")
    if not r:
        return pendiente(p, "El archivo de paridad está listo; falta que la prueba de Vitest de Erwan lo corra en el navegador", "maqueta" if (par or {}).get("maqueta") else "ninguno", det)
    return cerrar(p, r.get("valor"), r.get("texto", ""), r.get("estado") == "pasa", r.get("datos", "reales"), det)


INGLES = {
    "poste_plano": ("Shadow calculation is correct", "Error of 1 pixel or less"),
    "esfera_perfecta": ("Curvature is corrected", "0 pixels shadowed by relief"),
    "superficie_gaussiana": ("Horizon gives the right statistics", "Within 3 points of the theoretical curve, 2° to 15°"),
    "cuenco_sintetico": ("Crater shadow with a known answer", "Inner shadow length within 1 pixel"),
    "esquina_viper": ("Panel model is reasonable", "Within 1 % of 450 W"),
    "sol_luna_horizons": ("Solar geometry is correct", "Less than 0.1° from JPL Horizons"),
    "caso_a_mano": ("Formulas are coded correctly", "0.705 and 0.955"),
    "paridad_python_navegador": ("What you see is what was computed", "Same shadow in 1,000 test cases"),
    "reproducibilidad": ("Another team gets the same result", "Same files, same verification code"),
    "iluminacion_nasa": ("Real-relief shadows match NASA's map", "ρ of 0.8 or more over the same 18.6 years"),
    "rugosidad_nasa": ("Footprint orders terrain like NASA", "ρ of 0.6 or more"),
    "control_positivo": ("Search finds what it must find", "Lunar crop first; noisy copies in order"),
    "control_negativo": ("A failed requirement is never compensated", "Médanos del Chaco is Incompatible"),
    "redundancia_h1b": ("Grazing light adds its own information", "ρ below 0.9; otherwise its weight drops"),
    "medicion_atardecer": ("Geometry transfers to Earth", "Error of 5 % or less, Sun 5° to 15°"),
    "verificador_si": ("The SI function invents no numbers", "9 of 10 clean answers"),
    "prueba_con_personas": ("The cards are understood", "3 outside people say what is missing and what they would do next"),
}


def correr() -> dict:
    prm = parametros.cargar()
    v = prm["validacion"]
    pruebas = [p_poste(prm), p_esfera(prm), p_gaussiana(prm), p_cuenco(prm), p_esquina(prm), p_sol_horizons(prm), p_caso_a_mano(prm),
               p_paridad(prm), p_reproducibilidad(prm), p_iluminacion(prm)]
    pruebas.append(_externa(prueba("rugosidad_nasa", "mundo_real", "Roughness vs NASA, ρ", "Rugosidad contra NASA", "F9",
                                   "La huella ordena el terreno como NASA", "ρ de 0,6 o más (mide otra cosa, ver 3.4)", v["rugosidad_nasa_rho_min"],
                                   "ρ", ">=", "Mathias", "motor/huella"), "rugosidad_nasa.json",
                            "La corre motor/huella (Mathias) con el mapa de rugosidad de PGDA 90"))
    pruebas += p_puntaje(prm)
    pruebas.append(p_campo(prm))
    pruebas.append(_externa(prueba("verificador_si", "mundo_real", "SI verifier: no invented numbers", "Verificador de la función SI", None,
                                   "La SI no inventa cifras", "9 de 10 respuestas limpias", v["ia_respuestas_limpias_min"], "de 10", ">=",
                                   "Mathias", "api/"), "verificador_si.json", "La corre Mathias con el banco de 10 preguntas (domingo 15:00)"))
    pruebas.append(_externa(prueba("prueba_con_personas", "mundo_real", "People understand the cards", "Prueba con personas", None,
                                   "Las fichas se entienden", "3 personas ajenas dicen qué falta y qué harían después", 3, "personas", ">=",
                                   "Quien lidera", "informe/"), "prueba_con_personas.json", "La hace quien lidera el equipo con 3 personas ajenas"))
    for p in pruebas:                                   # la app abre en inglés: texto corto armado con los mismos datos
        m, r = p["meta"], p["resultado"]
        p["demuestra_en"], m["texto_en"] = INGLES.get(p["id"], (p["demuestra"], m["texto"]))
        if p["estado"] == "pendiente":
            r["texto_en"] = "Waiting for real input data." + (" Tested only with mock data so far." if p["datos"] == "maqueta" else "")
        else:
            v = r["valor"]
            unidad = {"puntos": "points", "casos": "cases", "de 10": "of 10", "personas": "people"}.get(m["unidad"], m["unidad"])
            v = ("yes" if v else "no") if isinstance(v, bool) else ("" if v is None else f"{v} {unidad}".strip())
            r["texto_en"] = f"Result: {v}" if v else "Result matches the target"
        p["dueno_en"] = {"Quien lidera": "Team lead", "Erwan (navegador) · Jean (archivo)": "Erwan (browser) · Jean (file)"}.get(p["dueno"], p["dueno"])
    resumen = {"total": len(pruebas), "pasa": sum(p["estado"] == "pasa" for p in pruebas),
               "falla": sum(p["estado"] == "falla" for p in pruebas), "pendiente": sum(p["estado"] == "pendiente" for p in pruebas)}
    salida = {"resumen": resumen, "pruebas": pruebas, "maqueta": False,
              "meta": parametros.bloque_meta("pruebas", __version__, notas=[
                  "Incluye todas las pruebas del plan de validación, también las que fallan y las pendientes.",
                  "Una prueba contra el mundo real corrida con datos de maqueta figura como pendiente."])}
    validar(salida, "pruebas")
    return salida


def principal():
    salida = correr()
    ruta = RAIZ / "salida" / "pruebas.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(salida, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    r = salida["resumen"]
    print(f"pruebas.json: {r['total']} pruebas · pasan {r['pasa']} · fallan {r['falla']} · pendientes {r['pendiente']}")
    for p in salida["pruebas"]:
        print(f"  [{p['estado']:>9}] {p['nombre_es']}: {p['resultado']['texto'] if p['estado'] != 'pendiente' else p['motivo_pendiente']}")


if __name__ == "__main__":
    principal()
