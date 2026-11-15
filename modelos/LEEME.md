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

## Qué NO hay

No hay relieve de Marte ni del resto de las candidatas: solo el recorte de 30 × 30 km alrededor de
P-27. El contorno de 3 × 3 km que se ve es la parcela de la ficha.

Uso de SI: script y modelos redactados con Claude Code.
