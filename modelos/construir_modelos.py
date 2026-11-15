"""TERRA-X · modelos 3D construidos en Blender (sin interfaz, reproducible).

    blender --background --factory-startup --python modelos/construir_modelos.py
    blender --background --factory-startup --python modelos/construir_modelos.py -- --solo-tierra

(El segundo arma solo el terreno terrestre `payunia.glb` y lo suma a modelos.json sin tocar lo demás.)

Produce, a partir de los parámetros congelados y de la grilla real de LOLA:

    modelos/terra_x_modelos.blend              escena editable (colecciones Rover, Tablita, Terreno)
    modelos/vista_previa_rover.png             render de control
    modelos/vista_previa_terreno.png           render de control
    web/public/modelos/rover.glb               rover solar genérico (plantilla pública tipo VIPER)
    web/public/modelos/tablita.glb             tablita de calibración de sombras (0,50 × 0,10 m)
    web/public/modelos/mons_mouton.glb         relieve real de Mons Mouton (malla de exhibición)
    web/public/modelos/mons_mouton_normales.png  normales de la grilla completa de 60 m
    web/public/modelos/modelos.json            procedencia, medidas y huellas SHA-256

De dónde sale cada medida (regla del proyecto: no se inventan datos):

- Rover: 1,5 × 1,5 × 2,5 m son las medidas públicas de VIPER (NASA). Tres paneles verticales con
  normales a 0°, 90° y 180° del frente: es la convención `vehiculo.lados_deg` de parametros.yaml,
  la misma que usa F4 en motor/destino/energia.py. La forma es genérica: NO es un modelo oficial.
- Tablita: 0,50 m de alto y 0,10 m de ancho mínimo (`campo.tablita_*` de parametros.yaml).
- Terreno: datos/grillas/mons_mouton_60m.npy (LOLA LDEM_80S_20MPP_ADJ, PGDA 90, promediado a 60 m).
  La MALLA se muestra a 120 m (promedio de bloques de 2 × 2 píxeles de 60 m) para que el archivo
  pese poco; es solo para mirar. Las normales se calculan con la grilla completa de 60 m y todos
  los números de la app salen del motor sobre la grilla de 60 m, nunca de esta malla.
  1 unidad de Blender = 1 km, sin exageración vertical.

Uso de SI: redactado con Claude Code.
"""
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import struct
import sys
import zlib

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

RAIZ = pathlib.Path(__file__).resolve().parents[1]
AQUI = RAIZ / "modelos"
SALIDA = RAIZ / "web" / "public" / "modelos"
GRILLA = RAIZ / "datos" / "grillas" / "mons_mouton_60m"
# Terreno terrestre de "Dos mundos": Copernicus GLO-30 -> UTM 19S a 60 m alrededor de P-27, la misma
# extensión que Mons Mouton (500 × 500). Se arma con `python -m modelos.grilla_tierra`.
GRILLA_TIERRA = RAIZ / "datos" / "grillas" / "payunia_p27_60m"

# Medidas con fuente (ver el encabezado)
ROVER_LADO_M = 1.5
ROVER_ALTO_M = 2.5
LADOS_DEG = (0.0, 90.0, 180.0)
TABLITA_ALTO_M = 0.50
TABLITA_ANCHO_M = 0.10
BLOQUE = 2                      # malla de exhibición: 2 × 2 píxeles de 60 m → 120 m


# ------------------------------------------------------------------------------------------------
# Utilidades
# ------------------------------------------------------------------------------------------------
def material(nombre, color, metal=0.0, rugosidad=0.6, emision=None, fuerza=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rugosidad
    if emision is not None:
        b.inputs["Emission Color"].default_value = (*emision, 1.0)
        b.inputs["Emission Strength"].default_value = fuerza
    m.diffuse_color = (*color, 1.0)
    return m


class Malla:
    """Junta primitivas en una sola malla con varios materiales."""

    def __init__(self, nombre):
        self.nombre = nombre
        self.bm = bmesh.new()
        self.mats = []

    def _indice(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _sumar(self, tmp, mat, matriz, liso=None):
        bmesh.ops.transform(tmp, matrix=matriz, verts=tmp.verts)
        bmesh.ops.recalc_face_normals(tmp, faces=tmp.faces)
        i = self._indice(mat)
        for f in tmp.faces:
            f.material_index = i
            f.smooth = bool(liso(f)) if liso else False
        me = bpy.data.meshes.new("_tmp")
        tmp.to_mesh(me)
        tmp.free()
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)

    @staticmethod
    def _matriz(loc, rot):
        return Matrix.Translation(Vector(loc)) @ Euler(rot or (0, 0, 0)).to_matrix().to_4x4()

    def caja(self, tam, loc, mat, rot=None, bisel=0.0):
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.scale(tmp, vec=Vector(tam), verts=tmp.verts)
        if bisel:
            bmesh.ops.bevel(tmp, geom=tmp.edges[:], offset=bisel, segments=2, affect="EDGES", profile=0.5)
        self._sumar(tmp, mat, self._matriz(loc, rot))

    def cilindro(self, radio, largo, loc, mat, rot=None, lados=32, radio2=None):
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=True, cap_tris=False, segments=lados, radius1=radio,
                              radius2=radio if radio2 is None else radio2, depth=largo)
        self._sumar(tmp, mat, self._matriz(loc, rot), liso=lambda f: len(f.verts) == 4)

    def esfera(self, radio, loc, mat, escala=(1, 1, 1)):
        tmp = bmesh.new()
        bmesh.ops.create_uvsphere(tmp, u_segments=24, v_segments=12, radius=radio)
        bmesh.ops.scale(tmp, vec=Vector(escala), verts=tmp.verts)
        self._sumar(tmp, mat, self._matriz(loc, None), liso=lambda f: True)

    def objeto(self, coleccion, loc=(0, 0, 0), rot=(0, 0, 0), padre=None):
        me = bpy.data.meshes.new(self.nombre)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.nombre, me)
        ob.location = loc
        ob.rotation_euler = rot
        coleccion.objects.link(ob)
        if padre is not None:
            ob.parent = padre
        return ob


def coleccion(nombre):
    c = bpy.data.collections.new(nombre)
    bpy.context.scene.collection.children.link(c)
    return c


def vacio(nombre, col):
    e = bpy.data.objects.new(nombre, None)
    e.empty_display_size = 0.5
    col.objects.link(e)
    return e


def png_rgb(ruta: pathlib.Path, rgb: np.ndarray) -> None:
    """PNG RGB de 8 bits escrito con zlib (el mismo escritor mínimo de motor/destino/vista.py)."""
    alto, ancho, _ = rgb.shape
    crudo = b"".join(b"\x00" + np.ascontiguousarray(rgb[f], dtype=np.uint8).tobytes() for f in range(alto))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    ruta.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(crudo, 9)) + chunk(b"IEND", b""))


def sha256(ruta: pathlib.Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


# ------------------------------------------------------------------------------------------------
# Rover solar genérico
# ------------------------------------------------------------------------------------------------
def construir_rover(col, M):
    raiz = vacio("rover", col)
    raiz["plantilla"] = "viper-publico"
    raiz["medidas_m"] = [ROVER_LADO_M, ROVER_LADO_M, ROVER_ALTO_M]
    raiz["lados_deg"] = list(LADOS_DEG)
    raiz["nota"] = "Forma genérica con medidas públicas de VIPER (NASA). No es un modelo oficial."

    # Cuerpo: Y es el frente, X la derecha, Z arriba. El suelo está en z = 0.
    c = Malla("chasis")
    c.caja((1.00, 1.30, 0.50), (0, 0, 0.75), M["manta"], bisel=0.035)          # caja térmica
    c.caja((1.08, 1.38, 0.05), (0, 0, 1.025), M["blanco"], bisel=0.012)        # tapa
    c.caja((0.70, 0.80, 0.025), (0, -0.10, 1.062), M["radiador"])             # radiador superior
    c.caja((0.05, 0.95, 0.55), (-0.525, 0, 0.80), M["blanco"], bisel=0.01)     # lado izquierdo: instrumentos
    for y in (-0.30, 0.0, 0.30):                                              # persianas del lado izquierdo
        c.caja((0.02, 0.20, 0.36), (-0.56, y, 0.82), M["oscuro"])
    c.caja((0.86, 0.10, 0.10), (0, 0.52, 0.42), M["metal"])                    # eje delantero
    c.caja((0.86, 0.10, 0.10), (0, -0.52, 0.42), M["metal"])                   # eje trasero
    for sx in (-1, 1):
        for sy in (-1, 1):                                                    # brazos de suspensión
            c.caja((0.07, 0.07, 0.34), (sx * 0.47, sy * 0.52, 0.36), M["metal"], rot=(0, sx * 0.35, 0))
    c.cilindro(0.055, 0.42, (0.0, 0.10, 0.31), M["metal"], lados=20)           # taladro (carcasa)
    c.cilindro(0.018, 0.16, (0.0, 0.10, 0.08), M["oscuro"], lados=12)          # broca
    c.cilindro(0.04, 1.30, (0.0, 0.42, 1.70), M["metal"], lados=20)            # mástil
    c.cilindro(0.06, 0.06, (0.0, 0.42, 1.08), M["oscuro"], lados=20)           # base del mástil
    c.cilindro(0.022, 0.42, (-0.36, -0.45, 1.26), M["metal"], lados=12)        # soporte de antena
    c.cilindro(0.20, 0.07, (-0.36, -0.45, 1.50), M["blanco"], rot=(math.radians(-38), 0, 0), lados=32, radio2=0.06)
    c.cilindro(0.012, 0.16, (-0.36, -0.47, 1.56), M["oscuro"], rot=(math.radians(-38), 0, 0), lados=8)
    c.cilindro(0.015, 0.30, (0.38, -0.50, 1.20), M["metal"], lados=8)          # antena de baja ganancia
    c.objeto(col, padre=raiz)

    cab = Malla("cabeza")                                                      # cámaras y luces en el mástil
    cab.caja((0.34, 0.15, 0.15), (0, 0, 0), M["blanco"], bisel=0.015)
    for x in (-0.10, 0.10):
        cab.cilindro(0.038, 0.05, (x, 0.09, 0.0), M["oscuro"], rot=(math.radians(90), 0, 0), lados=20)
        cab.cilindro(0.026, 0.012, (x, 0.118, 0.0), M["lente"], rot=(math.radians(90), 0, 0), lados=20)
    for x in (-0.19, 0.19):
        cab.caja((0.045, 0.05, 0.10), (x, 0.03, 0.0), M["luz"])
    cab.objeto(col, loc=(0.0, 0.42, ROVER_ALTO_M - 0.075), padre=raiz)

    # Ruedas: origen en el eje, para poder girarlas en la web.
    for nombre, sx, sy in (("rueda_di", -1, 1), ("rueda_dd", 1, 1), ("rueda_ti", -1, -1), ("rueda_td", 1, -1)):
        r = Malla(nombre)
        eje = (0, math.radians(90), 0)
        r.cilindro(0.235, 0.20, (0, 0, 0), M["rueda"], rot=eje, lados=36)
        r.cilindro(0.15, 0.215, (0, 0, 0), M["metal"], rot=eje, lados=24)
        r.cilindro(0.06, 0.24, (0, 0, 0), M["manta"], rot=eje, lados=16)
        for k in range(18):                                                   # garras
            a = 2 * math.pi * k / 18
            r.caja((0.21, 0.035, 0.022), (0, 0.243 * math.sin(a), 0.243 * math.cos(a)), M["oscuro"], rot=(-a, 0, 0))
        r.objeto(col, loc=(sx * 0.64, sy * 0.52, 0.255), padre=raiz)

    # Paneles verticales. Normal local +Y; se giran al azimut de `lados_deg` (horario desde el frente).
    lugares = {0.0: ((0.0, 0.715, 1.0), 0.98), 90.0: ((0.575, 0.0, 1.0), 1.20), 180.0: ((0.0, -0.715, 1.0), 0.98)}
    for lado in LADOS_DEG:
        loc, ancho = lugares[lado]
        alto = 0.86
        p = Malla(f"panel_{int(lado)}")
        p.caja((ancho, 0.028, alto), (0, 0, 0), M["marco"], bisel=0.006)
        nx, nz = (6 if ancho > 1.0 else 5), 4
        cw, ch = (ancho - 0.06) / nx, (alto - 0.06) / nz
        for i in range(nx):
            for j in range(nz):
                x = -ancho / 2 + 0.03 + cw * (i + 0.5)
                z = -alto / 2 + 0.03 + ch * (j + 0.5)
                p.caja((cw - 0.012, 0.006, ch - 0.012), (x, 0.017, z), M["celda"])
        ob = p.objeto(col, loc=loc, rot=(0, 0, -math.radians(lado)), padre=raiz)
        ob["lado_deg"] = lado
    return raiz


# ------------------------------------------------------------------------------------------------
# Tablita de calibración (kit de campo)
# ------------------------------------------------------------------------------------------------
def construir_tablita(col, M):
    raiz = vacio("tablita", col)
    raiz["alto_m"] = TABLITA_ALTO_M
    raiz["ancho_m"] = TABLITA_ANCHO_M
    raiz["nota"] = "Tablita vertical del protocolo de medición de sombras (F14, F19)."
    t = Malla("tablita_cuerpo")
    franjas = 5
    alto = TABLITA_ALTO_M / franjas
    for k in range(franjas):                                                  # franjas de 10 cm
        t.caja((TABLITA_ANCHO_M, 0.012, alto), (0, 0, alto * (k + 0.5)), M["blanco"] if k % 2 else M["sol"])
    t.caja((0.22, 0.14, 0.012), (0, 0, 0.006), M["oscuro"], bisel=0.003)       # base
    t.cilindro(0.012, 0.012, (0.075, 0.0, 0.018), M["lente"], lados=16)        # nivel de burbuja
    t.objeto(col, padre=raiz)
    return raiz


# ------------------------------------------------------------------------------------------------
# Terreno real de Mons Mouton
# ------------------------------------------------------------------------------------------------
def construir_terreno(col, M, grilla=GRILLA, nombre="mons_mouton", mat="regolito"):
    z = np.load(str(grilla) + ".npy").astype(np.float64)
    meta = json.loads(pathlib.Path(str(grilla) + ".json").read_text(encoding="utf-8"))
    if not np.isfinite(z).all():
        raise ValueError(f"{meta['nombre']} tiene celdas sin dato: la malla de exhibición no las rellena")
    alto, ancho = z.shape
    px = float(meta["pixel_m"])
    z_min = float(np.nanmin(z))

    # Normales con la grilla completa de 60 m (espacio del objeto, ya en ejes de glTF: X este, Y arriba, Z sur).
    dzdx = np.gradient(z, px, axis=1)
    dzdy = -np.gradient(z, px, axis=0)             # la fila crece hacia el sur
    n = np.stack([-dzdx, -dzdy, np.ones_like(z)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    gl = np.stack([n[..., 0], n[..., 2], -n[..., 1]], axis=-1)
    png_rgb(SALIDA / f"{nombre}_normales.png", np.clip(np.rint((gl * 0.5 + 0.5) * 255.0), 0, 255).astype(np.uint8))

    # Malla de exhibición: promedio de bloques de 2 × 2 (120 m). Cada vértice queda en el centro de su bloque.
    H, W = alto // BLOQUE, ancho // BLOQUE
    zb = z[:H * BLOQUE, :W * BLOQUE].reshape(H, BLOQUE, W, BLOQUE).mean(axis=(1, 3))
    filas, cols = np.mgrid[0:H, 0:W]
    pf = filas * BLOQUE + (BLOQUE - 1) / 2.0        # coordenada de píxel de 60 m (centro del bloque)
    pc = cols * BLOQUE + (BLOQUE - 1) / 2.0
    x_km = (pc - (ancho - 1) / 2.0) * px / 1000.0
    y_km = ((alto - 1) / 2.0 - pf) * px / 1000.0
    z_km = (zb - z_min) / 1000.0
    verts = np.stack([x_km, y_km, z_km], axis=-1).reshape(-1, 3)
    a = (filas[:-1, :-1] * W + cols[:-1, :-1]).reshape(-1)
    caras = np.stack([a + W, a + W + 1, a + 1, a], axis=-1)

    me = bpy.data.meshes.new(nombre)
    me.from_pydata(verts.tolist(), [], caras.tolist())
    me.update()
    uv = me.uv_layers.new(name="UVMap")
    u = (pc + 0.5) / ancho
    v = 1.0 - (pf + 0.5) / alto
    uvs = np.stack([u, v], axis=-1).reshape(-1, 2)
    idx = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get("vertex_index", idx)
    uv.data.foreach_set("uv", uvs[idx].reshape(-1))
    me.polygons.foreach_set("use_smooth", np.ones(len(me.polygons), dtype=bool))
    me.materials.append(M[mat])
    me.update()

    ob = bpy.data.objects.new(nombre, me)
    col.objects.link(ob)
    fuente = meta["fuentes"][0]
    ob["grilla"] = meta["nombre"]
    ob["pixel_m"] = px
    ob["pixel_malla_m"] = px * BLOQUE
    ob["filas"] = alto
    ob["columnas"] = ancho
    ob["z_min_m"] = z_min
    ob["z_max_m"] = float(np.nanmax(z))
    ob["x0_m"] = float(meta["x0_m"])
    ob["y0_m"] = float(meta["y0_m"])
    ob["unidad"] = "km"
    ob["fuente"] = fuente["id"]
    ob["fuente_sha256"] = fuente["sha256"]
    ob["nota"] = "Malla de exhibición a 120 m (promedio de 2 × 2 píxeles de 60 m). Los números salen de la grilla de 60 m."
    info = {"grilla": meta["nombre"], "pixel_m": px, "pixel_malla_m": px * BLOQUE, "filas": alto, "columnas": ancho,
            "z_min_m": z_min, "z_max_m": float(np.nanmax(z)), "x0_m": float(meta["x0_m"]), "y0_m": float(meta["y0_m"]),
            "proyeccion": meta["proyeccion"], "unidad_malla": "km", "exageracion_vertical": 1.0,
            "vertices": int(len(verts)), "fuentes": meta["fuentes"], "cuerpo": meta["cuerpo"]}
    if "candidata" in meta:
        info["candidata"] = meta["candidata"]
    return ob, info


def registro_terreno(nombre: str, info: dict) -> dict:
    return {"archivo": f"{nombre}.glb", "sha256": sha256(SALIDA / f"{nombre}.glb"),
            "normales": f"{nombre}_normales.png", "normales_sha256": sha256(SALIDA / f"{nombre}_normales.png"), **info}


def materiales_terreno():
    return {"regolito": material("regolito", (0.46, 0.46, 0.47), rugosidad=1.0),
            # Color de exhibición (basalto); la web pinta su propio material: no es una medición.
            "basalto": material("basalto", (0.30, 0.26, 0.23), rugosidad=1.0)}


def principal_tierra():
    """Solo el terreno terrestre: no vuelve a exportar rover, tablita ni Mons Mouton (sus huellas no cambian)."""
    SALIDA.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    M = materiales_terreno()
    M["piso"] = material("piso_vista", (0.33, 0.33, 0.34), rugosidad=1.0)
    c_terr = coleccion("TerrenoTierra")
    terreno, info = construir_terreno(c_terr, M, GRILLA_TIERRA, "payunia", "basalto")
    bpy.context.view_layer.update()
    exportar([terreno], SALIDA / "payunia.glb")
    ok = render(AQUI / "vista_previa_payunia.png", (22, -30, 16), (0, 0, 1.2),
                (math.radians(83), 0, math.radians(60)), energia=5.0, lente=40)
    ruta = SALIDA / "modelos.json"
    registro = json.loads(ruta.read_text(encoding="utf-8"))
    terrenos = registro.get("terrenos") or {"mons_mouton": dict(registro["terreno"])}
    terrenos["payunia"] = registro_terreno("payunia", info)
    registro["terrenos"] = terrenos
    registro.setdefault("vistas_previas", {})["payunia"] = ok
    ruta.write_text(json.dumps(registro, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("TERRENO TIERRA LISTO:", terrenos["payunia"]["sha256"][:12])


# ------------------------------------------------------------------------------------------------
# Exportación y vistas previas
# ------------------------------------------------------------------------------------------------
def exportar(objetos, ruta: pathlib.Path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objetos:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objetos[0]
    bpy.ops.export_scene.gltf(filepath=str(ruta), export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_extras=True, export_cameras=False, export_lights=False,
                              export_animations=False)


def descendientes(raiz):
    return [raiz] + [h for h in bpy.data.objects if h.parent is not None and _es_hijo(h, raiz)]


def _es_hijo(o, raiz):
    while o is not None:
        if o == raiz:
            return True
        o = o.parent
    return False


def render(ruta: pathlib.Path, camara_loc, mira, sol_rot, energia=4.0, lente=50.0, mundo=(0.01, 0.012, 0.02)):
    sc = bpy.context.scene
    cam_d = bpy.data.cameras.new("cam_vista")
    cam_d.lens = lente
    cam_d.clip_end = 500.0
    cam = bpy.data.objects.new("cam_vista", cam_d)
    sc.collection.objects.link(cam)
    cam.location = camara_loc
    cam.rotation_euler = (Vector(mira) - Vector(camara_loc)).to_track_quat("-Z", "Y").to_euler()
    luz_d = bpy.data.lights.new("sol_vista", "SUN")
    luz_d.energy = energia
    luz_d.angle = math.radians(0.53)
    luz = bpy.data.objects.new("sol_vista", luz_d)
    luz.rotation_euler = sol_rot
    sc.collection.objects.link(luz)
    sc.camera = cam
    if sc.world is None:
        sc.world = bpy.data.worlds.new("mundo")
    sc.world.use_nodes = True
    fondo = sc.world.node_tree.nodes.get("Background")
    if fondo:
        fondo.inputs[0].default_value = (*mundo, 1.0)
        fondo.inputs[1].default_value = 1.0
    sc.render.resolution_x, sc.render.resolution_y = 1100, 700
    sc.render.filepath = str(ruta)
    sc.render.image_settings.file_format = "PNG"
    ok = False
    for motor in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
        try:
            sc.render.engine = motor
            if motor == "CYCLES":
                sc.cycles.samples = 24
            bpy.ops.render.render(write_still=True)
            ok = True
            break
        except Exception as e:                                               # sin GPU u otro motor
            print("render con", motor, "falló:", e)
    bpy.data.objects.remove(cam)
    bpy.data.objects.remove(luz)
    return ok


def principal():
    SALIDA.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"

    M = {
        "manta": material("manta_termica", (0.78, 0.56, 0.18), metal=0.85, rugosidad=0.38),
        "blanco": material("pintura_blanca", (0.86, 0.87, 0.88), metal=0.05, rugosidad=0.55),
        "radiador": material("radiador", (0.93, 0.94, 0.95), metal=0.2, rugosidad=0.25),
        "metal": material("aluminio", (0.55, 0.57, 0.60), metal=0.9, rugosidad=0.42),
        "oscuro": material("negro_mate", (0.035, 0.038, 0.045), metal=0.3, rugosidad=0.7),
        "rueda": material("rueda", (0.30, 0.31, 0.33), metal=0.85, rugosidad=0.5),
        "marco": material("panel_marco", (0.10, 0.11, 0.13), metal=0.6, rugosidad=0.5),
        "celda": material("panel_celda", (0.018, 0.045, 0.16), metal=0.55, rugosidad=0.22),
        "lente": material("lente", (0.01, 0.02, 0.05), metal=0.9, rugosidad=0.08),
        "luz": material("faro", (0.95, 0.95, 0.85), emision=(1.0, 0.98, 0.85), fuerza=1.5),
        "sol": material("amarillo_sol", (0.906, 0.957, 0.204), rugosidad=0.6),
        **materiales_terreno(),
        "piso": material("piso_vista", (0.33, 0.33, 0.34), rugosidad=1.0),
    }

    c_rover, c_tab, c_terr = coleccion("Rover"), coleccion("Tablita"), coleccion("Terreno")
    rover = construir_rover(c_rover, M)
    tablita = construir_tablita(c_tab, M)
    tablita.location = (1.9, 0.6, 0.0)
    terreno, info_terreno = construir_terreno(c_terr, M)
    terreno.location = (0.0, 0.0, 0.0)

    bpy.context.view_layer.update()
    exportar(descendientes(rover), SALIDA / "rover.glb")
    lugar = tablita.location.copy()
    tablita.location = (0, 0, 0)
    bpy.context.view_layer.update()
    exportar(descendientes(tablita), SALIDA / "tablita.glb")
    tablita.location = lugar
    exportar([terreno], SALIDA / "mons_mouton.glb")
    tierra = None
    if pathlib.Path(str(GRILLA_TIERRA) + ".npy").exists():
        tierra, info_tierra = construir_terreno(c_terr, M, GRILLA_TIERRA, "payunia", "basalto")
        exportar([tierra], SALIDA / "payunia.glb")
        tierra.hide_render = True
        tierra.location = (40.0, 60.0, 0.0)

    # Vistas previas de control
    piso = Malla("piso_vista")
    piso.caja((40, 40, 0.02), (0, 0, -0.01), M["piso"])
    piso_ob = piso.objeto(sc.collection)
    c_terr.hide_render = True
    ok1 = render(AQUI / "vista_previa_rover.png", (4.6, 4.4, 2.1), (0.3, 0.1, 1.0),
                 (math.radians(80), 0, math.radians(215)), energia=6.0, lente=42)
    bpy.data.objects.remove(piso_ob)
    c_terr.hide_render = False
    c_rover.hide_render = c_tab.hide_render = True
    ok2 = render(AQUI / "vista_previa_terreno.png", (22, -30, 16), (0, 0, 1.2),
                 (math.radians(83), 0, math.radians(60)), energia=5.0, lente=40)
    c_rover.hide_render = c_tab.hide_render = False

    # En el .blend el terreno (en km) queda aparte del rover (en m) para que no se encimen.
    terreno.location = (0.0, 60.0, 0.0)
    bpy.ops.wm.save_as_mainfile(filepath=str(AQUI / "terra_x_modelos.blend"), compress=True)

    registro = {
        "generado_con": f"Blender {bpy.app.version_string} · modelos/construir_modelos.py",
        "rover": {"archivo": "rover.glb", "sha256": sha256(SALIDA / "rover.glb"), "plantilla": "viper-publico",
                  "medidas_m": [ROVER_LADO_M, ROVER_LADO_M, ROVER_ALTO_M], "lados_deg": list(LADOS_DEG),
                  "frente": "-Z de glTF (+Y de Blender)", "oficial": False,
                  "nota": "Forma genérica con medidas públicas de VIPER (NASA). No es un modelo oficial."},
        "tablita": {"archivo": "tablita.glb", "sha256": sha256(SALIDA / "tablita.glb"),
                    "alto_m": TABLITA_ALTO_M, "ancho_m": TABLITA_ANCHO_M},
        "terreno": {"archivo": "mons_mouton.glb", "sha256": sha256(SALIDA / "mons_mouton.glb"),
                    "normales": "mons_mouton_normales.png", "normales_sha256": sha256(SALIDA / "mons_mouton_normales.png"),
                    **info_terreno},
        "vistas_previas": {"rover": ok1, "terreno": ok2},
        "maqueta": False,
    }
    registro["terrenos"] = {"mons_mouton": dict(registro["terreno"])}
    if tierra is not None:
        registro["terrenos"]["payunia"] = registro_terreno("payunia", info_tierra)
    (SALIDA / "modelos.json").write_text(json.dumps(registro, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("MODELOS LISTOS:", json.dumps({k: v.get("sha256", "")[:12] for k, v in registro.items() if isinstance(v, dict) and "sha256" in v}))


if __name__ == "__main__":
    try:
        extra = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
        principal_tierra() if "--solo-tierra" in extra else principal()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
