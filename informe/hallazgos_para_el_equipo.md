# Hallazgos para el equipo · Parte 3 (Jean)

Regla del Método de trabajo: si algo de otra parte está mal, se abre un Issue y lo arregla el
dueño. Abajo, cada hallazgo con el texto listo para pegar. Ninguno se arregló en carpetas ajenas.

---

## 1. La noche en Mons Mouton dura de 289 a 418 h, no de 148 a 210 h · `bloquea` · `parte-1`

**Qué pasa.** Los documentos 00, 01, 02 y 03 dicen que el Sol pasa "entre 148 y 210 horas seguidas"
bajo el horizonte liso en cada lunación. Es la mitad de la noche real. El script
`_fuentes/verificacion/analizar_horizons.py` corta cada lunación en el mínimo de altura del Sol, que
es la medianoche polar: cada ventana queda con dos medias noches y el tramo más largo dentro de ella
es la mitad.

**Evidencia.** Con los mismos datos de JPL Horizons (paso de 2 h) y con Skyfield (paso de 1 h):

| Lunación de 2027 | Noche completa, horizonte liso | Lo que decían los documentos |
|---|---:|---:|
| Verano (27/10 a 26/11) | 289 h y 298 h (las dos noches que toca la ventana) | 148 h |
| Invierno (3/5 a 1/6) | 418 h y 410 h | 210 h |

Comprobación independiente: en verano el Sol está sobre el horizonte el 58,7 % del tiempo (dato de
los propios documentos), así que la noche dura 0,413 × 709 h ≈ 293 h. Prueba automática:
`motor/tests/test_sol.py::test_el_148_de_los_documentos_es_media_noche`.

**Qué cambia.** El argumento queda más fuerte: sobre terreno liso la oscuridad es de 6 a 8 veces
las 50 h de VIPER, no de 3 a 4. Hay que corregir:
- Pantalla Mission (Nahum): la cifra "148-210 h" → "289-418 h".
- Guion del recorrido (doc03, segundo 10-25): "dark for over 148 hours" → "dark for over 289 hours".
- Diapositiva 2 y relato (quien lidera): "148 h contra 50 h" → "290 h contra 50 h".

**Texto para el Issue:** «Corregir 148-210 h → 289-418 h (noche completa en horizonte liso). El
análisis original partía las noches por la mitad. Evidencia en informe/hallazgos_para_el_equipo.md
(Parte 3).»

---

## 2. Parámetros que completé y una persona tiene que confirmar antes de ver datos · `bloquea` · `parte-3`

`parametros.yaml` se congeló a las 12:48 con los valores de los documentos. Donde los documentos no
fijaban un valor, lo propuse y quedó marcado con `si` en el bloque `confirmar`:

| Clave | Propuesta | Por qué |
|---|---|---|
| `decision.criterio_orden` | ordenar por L (peor caso), empate por C | No premia los lugares poco medidos |
| `tolerancias.rugosidad_valor_ref` | mediana de Mons Mouton a esa escala | "25 % del valor de referencia" no decía de qué estadístico |
| `tolerancias.rugosidad_combinar_escalas` | media de las utilidades de 200 a 1.600 m | Cuatro escalas, una sola propiedad |
| `tolerancias.luz_rasante_distancia` | media de \|f̄P − f̄Q\| de 1,5° a 10° | Es la W1 de F10 restringida a ese rango |
| `perfil_dimensiones.fuerte_desde_utilidad` | 0,60 | Para pasar de utilidad a "fuerte o débil" |
| `horizonte.muestreo` y pasos | perfil sobre el rayo, paso relativo 0,001 | Ver informe/puerta_horizonte.md |
| `destino.noches_completas` | medir cada noche entera | Hallazgo 1 |
| `vehiculo.bateria_inicial_frac` | batería llena al empezar el cálculo | Supuesto declarado |
| `sol.refraccion.*` | 10 °C y presión estándar por altura | Misma condición que Horizons |
| `horario.dias`, `robustez.semilla`, `luz_rasante.e_paso_deg` | 7 días, semilla fija, 0,5° | Reproducibilidad |

Si alguien cambia alguno, se anota en `parametros/CAMBIOS.md` y se vuelve a congelar.

---

## 3. Mathias: lo que necesita el motor físico de `motor/escala` y `motor/huella` · `no-bloquea` · `parte-4`

1. Grilla de Mons Mouton a 60 m (500 × 500, polar estereográfica sur, R = 1.737,4 km) **y capas de
   margen** hasta 300 km (60 m cerca, 240 o 480 m lejos), en el formato de `esquemas/grilla_entrada.md`.
   Sin margen, el comando avisa: el horizonte de los bordes sería solo una cota inferior.
2. Mapa AVGVISIB de PGDA 69 en la **misma grilla** (para F13).
3. Distribuciones de huella con la forma de `esquemas/distribuciones.schema.json`, con la
   referencia, las 40 parcelas, el recorte de Mons Mouton, tres copias con ruido creciente y la
   parcela con vegetación. Incluir `alt_m` de cada parcela (para la refracción del horario).
4. En `manifest.json`: integrar `salida/manifest_parte3.json` (hashes de todo lo de la Parte 3).
5. `parcelas/*.bin` usa el mismo formato que `destino/horizontes.bin`.

---

## 4. Erwan: paridad y formato · `no-bloquea` · `parte-2`

- `salida/destino/paridad.json` tiene 1.000 casos (azar, cerca del umbral, empates, bordes de
  azimut, vuelta de 360°). Cada caso trae `k`, `byte`, `horizonte_deg` y `sombra`: la prueba de
  Vitest tiene que reproducir los cuatro. Hoy está calculado sobre el horizontes.bin de la maqueta;
  se regenera solo cuando llegue el real (el archivo trae el SHA-256 del .bin que usa).
- Regla exacta y lector de referencia en JavaScript: `esquemas/horizontes_bin.md`. El azimut de los
  bytes es el de la grilla: para usar el azimut geográfico del Sol hay que sumar la
  `convergencia` de la cabecera (+31° en Mons Mouton con lon0 = 0).
- Una sombra "rasante exacta" (Sol justo a 90° de un panel) da 0 W: no es un error.

---

## 5. Lo que se ve con la maqueta y no hay que presentar como resultado · `no-bloquea` · `parte-1`

- Con el terreno sintético hay 0 % de refugios: es una meseta inventada con una cima ancha y plana,
  y a 1 m de altura el propio techo de la cima tapa el Sol bajo. Es física correcta para ese
  terreno, no un resultado sobre Mons Mouton.
- Las fichas de Payunia son de maqueta: en la maqueta la luz rasante y la pendiente salen
  redundantes (ρ = 0,98) porque la curva de luz se generó con Smith a partir de la pendiente. La
  prueba H1b se decide con los datos reales.
- Todo eso sale con `"maqueta": true` y la web tiene que mostrar la banda MOCK DATA.

---

## 6. Con relieve real de LOLA (sábado 14/11, tarde) · `bloquea` · `parte-1` · `parte-2`

Se bajó el relieve real (PGDA 90) y el mapa de iluminación de NASA (PGDA 69) con el puente temporal
`puente_lola/` y se corrió el destino completo.

| Resultado real | Verano 2027 | Invierno 2027 |
|---|---:|---:|
| Noche en el centro de Mons Mouton (84,60°S, 31,00°E), con relieve | 424 h | 622 h |
| Tramo con menos de 108,4 W en ese punto | 422 h | 616 h |
| Refugios (≤ 50 h) en el recorte de 30 × 30 km | **0 %** | **0 %** |
| El mejor punto del recorte | 219 h | 345 h |
| Mediana del recorte | 407 h | 501 h |

**Validación:** la iluminación media simulada en 10.000 puntos durante 18,6 años coincide con el
mapa de NASA con ρ = 0,985 (meta 0,8) y 2,5 puntos de error medio. El motor queda validado contra
NASA, y el propio mapa de NASA no tiene en este recorte ningún punto con más de 59 % de iluminación.

**Qué significa:** en el centro de la meseta, con el relieve real, la noche es todavía más larga que
sobre terreno liso. Ningún punto de esos 30 km sirve de refugio para un rover estacionado. Los
refugios, si existen, están en otras partes de la región (bordes altos): hay que mover el recorte o
agrandarlo, y decir en la demo que en el centro no hay.

**Lo que mostraba la app y era maqueta:** "survives on 18 % of this terrain", "longest dark stretch
38 h", "nearest haven 1.2 km", "Sun vs Horizons 0.03°", "NASA map ρ 0.84 Passed", "sunset shadows
7.1 % Failed". Ya se reemplazó por los valores reales (ver hallazgo 7).

## 7. Lo que se corrigió en la web al integrar la Parte 3 · `no-bloquea`

- Tests lee `data/pruebas.json`: ningún resultado escrito a mano; lo no corrido figura como "Not run yet".
- Destination lee `data/destino/ficha_{verano,invierno}.json` y muestra el mapa real de refugios.
- Data lee `data/manifest.json`: fuentes reales con versión y SHA-256. Los hashes anteriores eran
  inventados (uno era el SHA-256 de un archivo vacío).
- Mons Mouton figuraba en 85,5°S, 31,4°E: el centro oficial (USGS/IAU) es 84,60°S, 31,00°E.
- "LOLA / Kaguya 5 m (pgda78)" no es lo que se usa: se usa LDEM de PGDA 90 en una grilla de 60 m.
- 148-210 h → 289-418 h en Mission, recorrido y gráfico de lunación; `sol/lunaciones.json` corregido.
- La banda MOCK DATA ahora sigue a `manifest.json` (sigue encendida: fichas de Payunia y P-07 son maqueta).
