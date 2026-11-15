# modelos/ · modelos 3D hechos en Blender

Todo sale de un solo script, sin pasos a mano, para que cualquiera pueda rehacerlo:

```bash
blender --background --factory-startup --python modelos/construir_modelos.py
```

Probado con Blender 5.3. Necesita `datos/grillas/mons_mouton_60m.{npy,json}` (se bajan con
`python -m puente_lola.bajar`).

| Archivo | Qué es |
|---|---|
| `terra_x_modelos.blend` | Escena editable: colecciones Rover, Tablita y Terreno (el terreno está en km, corrido 60 unidades para no encimarse con el rover, que está en metros) |
| `vista_previa_rover.png`, `vista_previa_terreno.png` | Renders de control |
| `../web/public/modelos/rover.glb` | Rover solar genérico |
| `../web/public/modelos/tablita.glb` | Tablita de calibración de sombras |
| `../web/public/modelos/mons_mouton.glb` | Relieve real de Mons Mouton |
| `../web/public/modelos/mons_mouton_normales.png` | Normales de la grilla completa de 60 m |
| `../web/public/modelos/payunia.glb` | Relieve real de Payunia alrededor de P-27 (Tierra) |
| `../web/public/modelos/payunia_normales.png` | Normales de la grilla completa de 60 m de Payunia |
| `vista_previa_payunia.png` | Render de control del relieve terrestre |
| `../web/public/modelos/modelos.json` | Medidas, procedencia y SHA-256 de cada archivo |

## De dónde sale cada medida

- **Rover.** 1,5 × 1,5 × 2,5 m son las medidas públicas de VIPER (NASA). Tres paneles verticales con
  normales a 0°, 90° y 180° del frente: la convención `vehiculo.lados_deg` de `parametros.yaml`, la
  misma de F4. Cada panel es un objeto con nombre (`panel_0`, `panel_90`, `panel_180`) y la web
  enciende sus celdas según la potencia que da F4. **La forma es genérica: no es un modelo oficial.**
- **Tablita.** 0,50 m de alto y 0,10 m de ancho (`campo.tablita_*`), con franjas de 10 cm.
- **Terreno.** LOLA `LDEM_80S_20MPP_ADJ` (PGDA 90) promediado a 60 m, 500 × 500 píxeles, 30 × 30 km.
  1 unidad = 1 km, **sin exageración vertical**.

## Regla de la grilla de 60 m

La **malla** del terreno se guarda a 120 m (promedio de bloques de 2 × 2 píxeles de 60 m) para que
el archivo pese 2,7 MB. Es solo la superficie donde se dibuja:

- el sombreado usa las normales calculadas con la grilla completa de 60 m;
- las sombras son la consulta de `horizontes.bin` píxel por píxel de 60 m;
- ningún número de la app sale de esta malla (la altura que se ve al pasar el cursor lleva "≈").

## Terreno de la Tierra (Payunia, alrededor de P-27)

```bash
.venv/Scripts/python -m modelos.grilla_tierra
```

```bash
blender --background --factory-startup --python modelos/construir_modelos.py -- --solo-tierra
```

El primero arma `datos/grillas/payunia_p27_60m.{npy,json}` con la cadena de la Parte 4 sin cambios
(`motor.ingest.copernicus` → `motor.escala.reproyectar`): Copernicus GLO-30, tesela `S37_W070`,
llevada a UTM 19S a 60 m con remuestreo por **promedio**. Tiene la misma extensión y el mismo píxel
que Mons Mouton (500 × 500 a 60 m, 30 × 30 km), centrada en la primera candidata real del ranking
publicado (`web/public/data/fichas/indice.json`, hoy P-27). Necesita rasterio y pyproj, y conexión la
primera vez (unos 39 MB). El segundo genera solo `payunia.glb` y sus normales y los suma a
`modelos.json` bajo `terrenos`, sin volver a exportar los otros modelos.

"Dos mundos" muestra los dos relieves lado a lado con el mismo ángulo local del Sol (modo
geométrico) y la misma cámara. La exageración vertical es solo de presentación y siempre está
rotulada. Ningún número sale de estas mallas.

## Renders del relieve real (reemplazan las ilustraciones inventadas)

```bash
blender --background --factory-startup --python modelos/renders.py
```

Escribe en `web/public/img/` los mismos nombres y tamaños que usaban las ilustraciones procedurales
(`ui_luna3d.png`, `ui_tierra3d.png`, `ui_luna3d_b.png`, `ui_luna_top.png`, `ui_tierra_top.png`), así
que ninguna pantalla cambia de código. Ahora son las grillas reales, sin exageración, con el mismo Sol
en los dos cuerpos (elevación 3°, azimut de grilla 250°, disco de 0,53°) y la curvatura de cada uno
(el horizonte lunar queda mucho más cerca). En la Luna el cielo es negro y las sombras también; en la
Tierra el cielo es el modelo de dispersión múltiple de Blender a 2000 m de altitud, que ilumina las
sombras. `ui_luna3d_b.png` es la misma vista partida: Luna a la izquierda, Tierra a la derecha. El
horizonte sale de las grillas amplias (`mons_mouton_margen_60m` recortada a 72 km y
`payunia_p27_amplio_60m`, 70 km, que arma `python -m modelos.grilla_tierra` y el motor no lee). El
color del suelo es uniforme (no hay datos de albedo) y la exposición es de presentación.

En la web, las dos maquetas 3D llevan un zócalo (paredes hasta una base plana 0,6 km debajo del punto
más bajo, armadas en el navegador con el borde real de la malla) y, en Payunia, el contorno de P-27 y,
más tenues, los de las otras 14 parcelas del ranking que entran en el recorte (`terrenos.payunia.parcelas`
de `modelos.json`). La pantalla "Two Worlds" del espacio del equipo (`team.html`) usa ahora este 3D
real en lugar de dos imágenes fijas.

## Marte (Jezero, sitio de aterrizaje de Perseverance)

```bash
.venv/Scripts/python -m modelos.grilla_marte
```

```bash
blender --background --factory-startup --python modelos/construir_modelos.py -- --solo-marte
```

```bash
blender --background --factory-startup --python modelos/renders.py -- --marte
```

Fuente: USGS Astrogeology, "Mars MGS MOLA - MEX HRSC Blended DEM Global 200m v2". El archivo
global pesa 11,4 GB y está guardado por filas sin comprimir, así que se leen por HTTP Range solo las
filas alrededor de Jezero (unos 85 MB, quedan en `datos/crudos/marte/` con URL, versión y SHA-256).
Se reproyecta a una grilla azimutal equidistante local sobre la esfera de Marte (radio 3396,19 km),
por promedio, a **200 m, su resolución nativa**: no se interpola a 60 m. Cubre los mismos 30 × 30 km
que Mons Mouton y Payunia (150 × 150) y una versión de 70 km para el horizonte de los renders. El
motor físico no lee estas grillas: Marte es solo para el relieve 3D, los renders y la tabla de
constantes (fichas NSSDCA de la NASA, `web/src/escena3d/mundos.ts`).

En la web, "Earth and Moon" compara Luna | Tierra, Marte | Tierra y Luna | Marte con el mismo Sol.
Cada escena trae el cielo de su mundo (ilustración), el disco solar a su tamaño aparente real
(0,53° desde la Luna y la Tierra, 0,35° desde Marte), la luz en proporción a la irradiancia
(Marte recibe 586/1361), una regla de 5 km, la flecha al norte de la grilla y los sitios rotulados.
`ui_marte3d.png` y `mundos_luna_tierra_marte.png` son los renders con la misma cámara y el mismo Sol.

## Qué NO hay

No hay relieve del resto de la región de las candidatas: solo el recorte de 30 × 30 km alrededor de
P-27. El contorno de 3 × 3 km que se ve es la parcela de la ficha.

Uso de SI: script y modelos redactados con Claude Code.
