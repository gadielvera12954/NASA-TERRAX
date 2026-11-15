"""TERRA-X · renders del relieve REAL de la Luna y de la Tierra con el mismo Sol rasante (Blender, sin interfaz).

    blender --background --factory-startup --python modelos/renders.py
    blender --background --factory-startup --python modelos/renders.py -- --rapido      # prueba chica

Reemplaza las ilustraciones procedurales de web/public/img (terrenos inventados) por renders de las
grillas reales, con los mismos nombres y tamaños para que ninguna pantalla cambie de código:

    ui_luna3d.png     Mons Mouton (NASA LOLA, 60 m) en vista oblicua con el Sol a 3°
    ui_tierra3d.png   Payunia alrededor de P-27 (Copernicus GLO-30 -> UTM 19S, 60 m), misma cámara y mismo Sol
    ui_luna3d_b.png   la misma vista partida al medio: Luna a la izquierda, Tierra a la derecha
    ui_luna_top.png   Mons Mouton desde arriba, 30 x 30 km
    ui_tierra_top.png Payunia desde arriba, 30 x 30 km

    blender --background --factory-startup --python modelos/renders.py -- --marte

    ui_marte3d.png                  Jezero (Marte, USGS HRSC + MOLA, 200 m), misma cámara y mismo Sol
    mundos_luna_tierra_marte.png    Luna | Tierra | Marte lado a lado (para la presentación)

Qué es física y qué es presentación:
- Física: el relieve (grillas de 60 m, sin exageración vertical), la dirección del Sol (elevación 3°,
  azimut 250° de grilla en los dos cuerpos: el "modo geométrico" de Dos Mundos), el tamaño angular
  del Sol (0,53°) y la curvatura de cada cuerpo (radio lunar 1737,4 km, terrestre 6371 km), por eso
  el horizonte lunar queda mucho más cerca.
- En la Luna no hay aire: cielo negro y sombras negras. En la Tierra el cielo es el modelo físico de
  dispersión múltiple de Blender (altitud 2000 m), que ilumina las sombras.
- Presentación: el color del suelo (uniforme, sin datos de albedo), la exposición y el encuadre.

Uso de SI: redactado con Claude Code para la Parte de Jean.
"""
from __future__ import annotations

import json
import math
import pathlib
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import construir_modelos as cm  # noqa: E402

RAIZ = AQUI.parent
GRILLAS = RAIZ / "datos" / "grillas"
IMG = RAIZ / "web" / "public" / "img"

SOL_EL_DEG = 3.0
SOL_AZ_DEG = 250.0                 # azimut de grilla, horario desde el norte de la grilla
SOL_RADIO_ANGULAR_DEG = 0.53
RADIO_KM = {"luna": 1737.4, "tierra": 6371.0, "marte": 3389.5}
# Luz solar sobre el aire (NSSDCA): Marte recibe 586,2 / 1361 de lo que reciben la Luna y la Tierra.
IRRADIANCIA = {"luna": 1361.0, "tierra": 1361.0, "marte": 586.2}
SOL_DIAMETRO_DEG = {"luna": 0.533, "tierra": 0.533, "marte": 0.533 / 1.524}
MUNDOS = {
    "luna": {"centro": "mons_mouton_60m", "amplia": "mons_mouton_margen_60m", "recorte_amplio": 1200,
             "color": (0.20, 0.20, 0.20)},
    "tierra": {"centro": "payunia_p27_60m", "amplia": "payunia_p27_amplio_60m", "recorte_amplio": None,
               "color": (0.12, 0.09, 0.07)},
    # Jezero (Perseverance), USGS HRSC + MOLA a 200 m nativos: python -m modelos.grilla_marte
    "marte": {"centro": "marte_jezero_200m", "amplia": "marte_jezero_amplio_200m", "recorte_amplio": None,
              "color": (0.34, 0.18, 0.10)},
}


def cargar(nombre: str):
    z = np.load(GRILLAS / f"{nombre}.npy").astype(np.float64)
    meta = json.loads((GRILLAS / f"{nombre}.json").read_text(encoding="utf-8"))
    if not np.isfinite(z).all():
        raise ValueError(f"{nombre} tiene celdas sin dato")
    return z, meta


def recortar_centro(z, meta, n):
    if n is None or n >= z.shape[0]:
        return z, meta
    f0 = (z.shape[0] - n) // 2
    c0 = (z.shape[1] - n) // 2
    m = dict(meta)
    m["x0_m"] = meta["x0_m"] + c0 * meta["pixel_m"]
    m["y0_m"] = meta["y0_m"] - f0 * meta["pixel_m"]
    return z[f0:f0 + n, c0:c0 + n], m


def malla(nombre, z, meta, origen, radio_km, color):
    """Malla en km con el origen en el centro del recorte de 30 km; la caída por curvatura es d²/2R."""
    xc, yc, z0 = origen
    alto, ancho = z.shape
    px = float(meta["pixel_m"])
    filas, cols = np.mgrid[0:alto, 0:ancho]
    x = (meta["x0_m"] + cols * px - xc) / 1000.0
    y = (meta["y0_m"] - filas * px - yc) / 1000.0
    caida = (x * x + y * y) / (2.0 * radio_km)
    zz = (z - z0) / 1000.0 - caida
    verts = np.stack([x, y, zz], axis=-1).reshape(-1, 3).astype(np.float32)
    a = (filas[:-1, :-1] * ancho + cols[:-1, :-1]).reshape(-1)
    caras = np.stack([a + ancho, a + ancho + 1, a + 1, a], axis=-1).astype(np.int32)

    me = bpy.data.meshes.new(nombre)
    try:
        me.vertices.add(len(verts))
        me.vertices.foreach_set("co", verts.ravel())
        me.loops.add(caras.size)
        me.loops.foreach_set("vertex_index", caras.ravel())
        me.polygons.add(len(caras))
        me.polygons.foreach_set("loop_start", np.arange(0, caras.size, 4, dtype=np.int32))
        me.update(calc_edges=True)
    except Exception:                                                    # API vieja: más lento pero seguro
        bpy.data.meshes.remove(me)
        me = bpy.data.meshes.new(nombre)
        me.from_pydata(verts.tolist(), [], caras.tolist())
        me.update()
    me.shade_smooth()
    mat = cm.material(f"suelo_{nombre}", color, rugosidad=1.0)
    me.materials.append(mat)
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def direccion_sol() -> Vector:
    a, e = math.radians(SOL_AZ_DEG), math.radians(SOL_EL_DEG)
    return Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))


def mundo_luna():
    sc = bpy.context.scene
    w = bpy.data.worlds.new("cielo_luna")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.0
    sc.world = w
    d = bpy.data.lights.new("sol", "SUN")
    d.energy = 5.0
    d.angle = math.radians(SOL_RADIO_ANGULAR_DEG)
    d.color = (1.0, 1.0, 1.0)
    sol = bpy.data.objects.new("sol", d)
    sol.rotation_euler = (-direccion_sol()).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(sol)
    # Disco solar visible (0,53°) a 900 km: el Sol de la Luna se ve sin halo.
    dist = 900.0
    r = dist * math.tan(math.radians(SOL_RADIO_ANGULAR_DEG / 2))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=direccion_sol() * dist, segments=32, ring_count=16)
    disco = bpy.context.active_object
    disco.name = "disco_solar"
    disco.data.materials.append(cm.material("disco", (1, 1, 1), emision=(1, 1, 1), fuerza=60.0))
    disco.visible_shadow = False
    return [sol, disco]


def mundo_marte():
    """Sol 0,35° y con el 43 % de la luz; cielo de polvo uniforme como luz de relleno (ilustración:
    Blender no trae un modelo físico de la atmósfera marciana)."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new("cielo_marte")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.50, 0.33, 0.21, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.22
    sc.world = w
    d = bpy.data.lights.new("sol", "SUN")
    d.energy = 5.0 * IRRADIANCIA["marte"] / IRRADIANCIA["luna"]
    d.angle = math.radians(SOL_DIAMETRO_DEG["marte"])
    d.color = (1.0, 0.96, 0.9)
    sol = bpy.data.objects.new("sol", d)
    sol.rotation_euler = (-direccion_sol()).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(sol)
    return [sol]


def mundo_tierra(altitud_m: float):
    sc = bpy.context.scene
    w = bpy.data.worlds.new("cielo_tierra")
    w.use_nodes = True
    nodos = w.node_tree.nodes
    cielo = nodos.new("ShaderNodeTexSky")
    for tipo in ("MULTIPLE_SCATTERING", "SINGLE_SCATTERING", "NISHITA", "HOSEK_WILKIE"):
        try:
            cielo.sky_type = tipo
            break
        except TypeError:
            continue
    cielo.sun_disc = True
    cielo.sun_size = math.radians(SOL_RADIO_ANGULAR_DEG)
    cielo.sun_elevation = math.radians(SOL_EL_DEG)
    # sun_rotation de Blender se mide como el azimut de grilla: desde +Y (norte) hacia +X (este).
    # Comprobado con la prueba rápida: el disco cae en el mismo lugar del cuadro que el de la Luna.
    cielo.sun_rotation = math.radians(SOL_AZ_DEG)
    cielo.altitude = altitud_m
    fondo = nodos["Background"]
    w.node_tree.links.new(cielo.outputs["Color"], fondo.inputs["Color"])
    fondo.inputs["Strength"].default_value = 1.0
    sc.world = w
    print("CIELO", cielo.sky_type, "sun_direction", tuple(round(v, 3) for v in cielo.sun_direction),
          "esperado", tuple(round(v, 3) for v in direccion_sol()))
    return []


def color(exposicion: float):
    v = bpy.context.scene.view_settings
    for vista in ("AgX", "Filmic", "Standard"):
        try:
            v.view_transform = vista
            break
        except TypeError:
            continue
    v.exposure = exposicion


def motor_render(muestras: int):
    sc = bpy.context.scene
    try:
        bpy.ops.preferences.addon_enable(module="cycles")
    except Exception:
        pass
    try:
        sc.render.engine = "CYCLES"
        sc.cycles.samples = muestras
        sc.cycles.use_denoising = True
        sc.cycles.max_bounces = 4
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            for tipo in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
                try:
                    prefs.compute_device_type = tipo
                    prefs.get_devices()
                    if any(d.type == tipo for d in prefs.devices):
                        for d in prefs.devices:
                            d.use = True
                        sc.cycles.device = "GPU"
                        break
                except Exception:
                    continue
        except Exception:
            pass
        return "CYCLES"
    except Exception:
        sc.render.engine = "BLENDER_EEVEE"
        return "BLENDER_EEVEE"


def camara_oblicua(z_centro, meta_c, origen, lente=30.0, rumbo_deg=SOL_AZ_DEG - 115.0, distancia_km=20.0, alto_km=2.6, inclinacion_deg=-8.0):
    """Cámara atrás del centro con el Sol de costado (115° a la derecha): luz rasante sobre el relieve."""
    r = math.radians(rumbo_deg)
    adelante = Vector((math.sin(r), math.cos(r), 0.0))
    pos = -adelante * distancia_km
    # Altura del suelo bajo la cámara, de la grilla central (la cámara queda dentro de ella o cerca del borde).
    px = meta_c["pixel_m"]
    xc, yc, z0 = origen
    col = int(round((pos.x * 1000 + xc - meta_c["x0_m"]) / px))
    fila = int(round((meta_c["y0_m"] - (pos.y * 1000 + yc)) / px))
    col = min(max(col, 0), z_centro.shape[1] - 1)
    fila = min(max(fila, 0), z_centro.shape[0] - 1)
    suelo = (z_centro[fila, col] - z0) / 1000.0
    pos.z = suelo + alto_km
    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = lente
    cam_d.clip_start = 0.05
    cam_d.clip_end = 3000.0
    cam = bpy.data.objects.new("cam", cam_d)
    mira = pos + Vector((adelante.x, adelante.y, math.tan(math.radians(inclinacion_deg))))
    cam.location = pos
    cam.rotation_euler = (mira - pos).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def camara_cenital(lado_km: float):
    cam_d = bpy.data.cameras.new("cam_top")
    cam_d.type = "ORTHO"
    cam_d.ortho_scale = lado_km
    cam_d.clip_end = 3000.0
    cam = bpy.data.objects.new("cam_top", cam_d)
    cam.location = (0, 0, 200.0)
    cam.rotation_euler = (0, 0, 0)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def render(ruta: pathlib.Path, ancho: int, alto: int):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = ancho, alto
    sc.render.resolution_percentage = 100
    sc.render.filepath = str(ruta)
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"RENDER {ruta.name} {ancho}x{alto} en {time.time() - t:.0f} s")


def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"


def escena(mundo: str, amplia: bool):
    """Arma el relieve del mundo pedido. Devuelve (z central, meta central, origen)."""
    cfg = MUNDOS[mundo]
    zc, mc = cargar(cfg["centro"])
    alto, ancho = zc.shape
    px = mc["pixel_m"]
    origen = (mc["x0_m"] + (ancho - 1) / 2 * px, mc["y0_m"] - (alto - 1) / 2 * px, float(zc.min()))
    if amplia:
        za, ma = cargar(cfg["amplia"])
        za, ma = recortar_centro(za, ma, cfg["recorte_amplio"])
        malla(f"{mundo}_amplia", za, ma, origen, RADIO_KM[mundo], cfg["color"])
    else:
        malla(f"{mundo}_centro", zc, mc, origen, RADIO_KM[mundo], cfg["color"])
    return zc, mc, origen


def componer(izq: pathlib.Path, der: pathlib.Path, salida: pathlib.Path):
    """Mitad izquierda de la Luna, mitad derecha de la Tierra, divisor de 2 px."""
    def leer(p):
        im = bpy.data.images.load(str(p))
        w, h = im.size
        a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3]
        bpy.data.images.remove(im)
        return a
    a, b = leer(izq), leer(der)
    h, w, _ = a.shape
    out = a.copy()
    out[:, w // 2:] = b[:, w // 2:]
    out[:, w // 2 - 1:w // 2 + 1] = 1.0
    cm.png_rgb(salida, np.clip(np.rint(out * 255.0), 0, 255).astype(np.uint8))


def tres(rutas, salida: pathlib.Path):
    """Luna | Tierra | Marte, uno al lado del otro, separados por 4 px blancos."""
    imgs = []
    for p in rutas:
        im = bpy.data.images.load(str(p))
        w, h = im.size
        imgs.append(np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3])
        bpy.data.images.remove(im)
    h = imgs[0].shape[0]
    sep = np.ones((h, 4, 3), dtype=np.float32)
    out = np.concatenate([imgs[0], sep, imgs[1], sep, imgs[2]], axis=1)
    cm.png_rgb(salida, np.clip(np.rint(out * 255.0), 0, 255).astype(np.uint8))


def principal_marte(rapido: bool):
    """Marte con la misma cámara y el mismo Sol que ui_luna3d / ui_tierra3d, y la tríada para la presentación."""
    escala = 0.5 if rapido else 1.0
    salida = IMG if not rapido else AQUI / "_prueba_renders"
    salida.mkdir(parents=True, exist_ok=True)
    limpiar()
    motor_render(16 if rapido else 64)
    zc, mc, origen = escena("marte", amplia=True)
    mundo_marte()
    color(1.3)
    camara_oblicua(zc, mc, origen)
    render(salida / "ui_marte3d.png", int(900 * escala), int(520 * escala))
    if not rapido:
        tres([IMG / "ui_luna3d.png", IMG / "ui_tierra3d.png", IMG / "ui_marte3d.png"], IMG / "mundos_luna_tierra_marte.png")
    print("RENDERS LISTOS en", salida)


def principal(rapido: bool):
    escala = 0.5 if rapido else 1.0
    muestras = 16 if rapido else 64
    salida = IMG if not rapido else AQUI / "_prueba_renders"
    salida.mkdir(parents=True, exist_ok=True)
    exp = {"luna": 0.6, "tierra": -2.0}
    hechos = {}
    for mundo in ("luna", "tierra"):
        # Oblicua con horizonte real
        limpiar()
        motor = motor_render(muestras)
        zc, mc, origen = escena(mundo, amplia=True)
        (mundo_luna() if mundo == "luna" else mundo_tierra(float(zc[zc.shape[0] // 2, zc.shape[1] // 2])))
        color(exp[mundo])
        camara_oblicua(zc, mc, origen)
        nombre = "ui_luna3d.png" if mundo == "luna" else "ui_tierra3d.png"
        render(salida / nombre, int(900 * escala), int(520 * escala))
        hechos[mundo] = salida / nombre
        # Cenital del recorte de 30 km
        limpiar()
        motor_render(muestras)
        zc, mc, origen = escena(mundo, amplia=False)
        (mundo_luna() if mundo == "luna" else mundo_tierra(float(zc[zc.shape[0] // 2, zc.shape[1] // 2])))
        color(exp[mundo])
        if mundo == "luna":
            camara_cenital(30.0 * 760 / 560 if False else 30.0)
            render(salida / "ui_luna_top.png", int(760 * escala), int(560 * escala))
        else:
            camara_cenital(30.0)
            render(salida / "ui_tierra_top.png", int(1100 * escala), int(760 * escala))
        print("MOTOR", motor)
    componer(hechos["luna"], hechos["tierra"], salida / "ui_luna3d_b.png")
    print("RENDERS LISTOS en", salida)


if __name__ == "__main__":
    try:
        extra = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
        if "--marte" in extra:
            principal_marte("--rapido" in extra)
        else:
            principal("--rapido" in extra)
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
