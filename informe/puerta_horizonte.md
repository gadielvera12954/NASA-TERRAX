# Puerta Horizonte · sábado 14/11, 18:00

**Qué se exige (Método de trabajo):** pasan las pruebas de poste y esfera.
**Si no pasa:** se cambia a HORAYZON; si a las 20:00 tampoco, mapa de iluminación de NASA.
**Decisión propuesta: PASA → se sigue con el código propio. No se activa ningún plan B.**
La decisión la toman Jean y Mathias en la verificación de las 18:00; este informe es la evidencia.

## Resultados

| Prueba | Meta (doc02 §6) | Resultado | Estado |
|---|---|---|---|
| Poste en plano (F1) | Error ≤ 1 píxel | 0,00 píxeles en 32 casos (8 azimutes × Sol a 5°, 7°, 10° y 15°) | Pasa |
| Esfera perfecta (F2) | 0 píxeles en sombra por relieve | 0 píxeles (101 × 101 píxeles de 60 m, relieve hasta 300 km, 72 azimutes, Sol de 0,1° a 7°) | Pasa |
| Torre de 5 km sobre la esfera | atan(√(2h/R)) = −4,3385° | −4,3385° en los 360 azimutes | Pasa |
| Plano inclinado 10° | horizonte = pendiente | 10,000° hacia arriba de la pendiente, 0° de costado | Pasa |
| Cuenco sintético | sombra interna ≤ 1 píxel | 0,94 píxeles de diferencia máxima | Pasa |
| Superficie gaussiana contra Smith (F17) | ≤ 3 puntos de 2° a 15° | 2,1 puntos (RMS 5°), 2,1 (RMS 10°), 2,0 (RMS 20°) | Pasa |

Registro de que las pruebas existieron y fallaron antes del código: `informe/registro_tdd/01_horizonte_rojo.txt`.
Registro en verde: `informe/registro_tdd/02_horizonte_verde.txt`. Las pruebas: `motor/tests/test_horizonte_*.py`.

## Dos decisiones de método que se tomaron con las pruebas a la vista

Se dejan escritas porque una persona del equipo tiene que poder explicarlas.

1. **Cómo se mide el error del poste.** La primera versión de la prueba tomaba la celda en sombra
   más lejana. A 45° las celdas están a 1,41 píxeles una de otra: con el Sol a 7°, la sombra
   teórica termina en 40,72 m, entre una celda a 39,60 m (en sombra) y otra a 41,01 m (al Sol). Las
   dos están bien clasificadas; la "diferencia" de 1,12 era la separación de la grilla. La prueba
   ahora mide el error como la distancia al borde teórico de la peor celda **mal clasificada**: 0.
   La meta (1 píxel) no se cambió.

2. **Cómo se recorre cada rayo.** La primera versión del núcleo usaba la celda más cercana a cada
   punto del rayo. En la superficie gaussiana daba 4 a 6 puntos más de sombra que Smith en los
   azimutes oblicuos y menos de 3 en los ejes y diagonales: cerca del observador tomaba centros de
   celda fuera del rayo, un abanico de direcciones. Habría inflado las sombras en el terreno real.
   La versión final evalúa el perfil exactamente sobre el rayo, en los cruces con las líneas entre
   centros de celda, con la combinación lineal de las dos celdas vecinas: la misma superficie
   lineal por tramos que usa HORAYZON (plan B 1). No crea una grilla más fina. Consecuencia
   conocida: un poste de **una sola celda** se vuelve una carpa, así que F1 es exacta en los 8
   azimutes principales (el rayo pasa por el centro del poste) y en azimutes oblicuos la sombra de
   esa carpa sale más corta. Las pruebas lo comprueban (`test_poste_azimut_oblicuo_direccion_y_cota`).

## Rendimiento

Destino de 500 × 500 píxeles con 72 azimutes y relieve lejano a 480 m hasta 150 km: unos 3 minutos
en 8 núcleos (Numba). Con 300 km de margen se estima entre 5 y 10 minutos. Una parcela de 50 × 50
píxeles con 30 km de margen: menos de 1 segundo.

## Lo que se entrega a Mathias a las 18:00

- `motor/horizonte` probado, con el comando
  `python -m motor.horizonte --objetivo GRILLA --capas MARGEN... --salida parcelas/P-07.bin`.
- El formato exacto en `esquemas/horizontes_bin.md` y el contrato de grillas en `esquemas/grilla_entrada.md`.
- Aviso automático si las capas no cubren el margen pedido (30 km en la Tierra, 300 km en la Luna).
