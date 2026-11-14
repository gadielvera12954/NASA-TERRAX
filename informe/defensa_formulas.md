# Defensa de cada fórmula · para el jurado

Tarea del domingo 18:00 a 21:00: "Repasar cada fórmula para explicarla al jurado. Queda hecho cuando
puede defender cualquier cifra de la app." Cada fila dice qué es, en una frase, el número que lo
muestra, dónde está el código y qué prueba lo respalda.

| | Qué dice, en una frase | Número para recordar | Código | Prueba |
|---|---|---|---|---|
| **F1** s = h / tan e | La sombra de un objeto vertical crece muy rápido cuando el Sol baja | 1 km de loma a 1,5° → 38,2 km de sombra; la tablita de 50 cm a 5° → 5,72 m | `motor/horizonte/geometria.py` | poste en plano |
| **F2** Δz = (1−k)d²/2R; e_h = max atan((z − z0 − Δz)/d) | El horizonte de cada píxel es el punto más alto que se ve en cada dirección, con la curvatura del cuerpo | A 50 km la Luna "cae" 719,5 m; un punto 5 km más alto que todo ve el horizonte 4,34° más abajo | `motor/horizonte/nucleo.py` | esfera perfecta, torre de 5 km |
| **F3** fracción del disco | El Sol no es un punto: puede estar medio tapado | 0 tapado, 0,5 con el centro en el horizonte, 1 entero; radio 0,267° | `motor/destino/energia.py` | test_f3 |
| **F4** P = Pmax·max(0, n·s)·f | Cada panel rinde según el coseno del ángulo con que le llega el Sol | Sol a 5° en una esquina: 450,8 W contra 450 W de NASA (0,18 %); de frente 319 W; del lado sin panel 0 W | `motor/destino/energia.py` | esquina de VIPER |
| **F5** balance de batería | La batería sube con los paneles y baja con el consumo, entre 0 y 5.420 Wh | Con 108,4 W y sin Sol se vacía en exactamente 50 h | `motor/destino/energia.py` | test_f5 |
| **F6** P_surv ≤ 5420/50 | Si 5.420 Wh alcanzan 50 h, el consumo medio de supervivencia no pasa de 108,4 W | 108,4 W (cota, no dato publicado); la prueba de vacío de NASA sugiere ~95 W | `motor/destino/energia.py` | test_f6 |
| **F7** condiciones críticas | Riesgo si la oscuridad pasa 50 h, la batería baja de la reserva o la pendiente pasa 15° | Terreno liso, verano: 290 h con menos de 108,4 W → riesgo | `motor/destino/energia.py` | test_f7 |
| **F8** pendiente de Horn | Pendiente de una celda con sus 8 vecinas | Se usa para la pendiente local del punto del rover | `motor/destino/energia.py` (Mathias la usa en huella) | — |
| **F10** Wasserstein | Cuánto hay que "mover" una distribución para que se parezca a otra | Igual a SciPy al 1e-9 con valores; ±2 % con 101 cuantiles | `motor/puntaje/distancias.py` | test_f10 |
| **F11** C, E, L, U | Compatibilidad = cuánto encaja lo que se conoce; evidencia = cuánto se conoce; L y U = peor y mejor caso | C 0,94 y E 0,75 → L 0,705 y U 0,955 | `motor/puntaje/compatibilidad.py` | caso a mano |
| **F12** robustez | Con 1.000 juegos de pesos parecidos, cuántas veces queda primera cada candidata | Dirichlet con α = 100: los pesos se mueven pocos puntos | `motor/puntaje/robustez.py` | test_dirichlet |
| **F13** Spearman | Si nuestras sombras ordenan el terreno como el mapa de NASA | Meta ρ ≥ 0,8 en 10.000 puntos y 18,6 años | `motor/destino/iluminacion.py` | iluminación contra NASA (pendiente de datos reales) |
| **F14** error de campo | El error de la sombra medida, y cuánto pesan la hora y la inclinación del suelo | Para 5 % hay que estar por debajo de 0,25° a 5° y 0,72° a 15° | `motor/tests/campo.py` | medición al atardecer |
| **F15** refracción | La atmósfera levanta el Sol bajo | +0,32° a 1,5°; +0,16° a 5° (3,2 % de la sombra); en la Luna 0 | `motor/sol/refraccion.py` | test_f15 y horarios contra Horizons |
| **F16** f̄(e) y f(e, A) | Qué fracción del terreno queda en sombra con el Sol a cada altura: promediada en azimut describe el terreno; con el azimut real, la escena del ensayo | De 1,5° a 10° cada 0,5° | huella (Mathias) con el horizonte de Jean | — |
| **F17** Smith | Para una superficie gaussiana la fracción en sombra tiene fórmula exacta | Sol a 6°: RMS 5° → 15 %, 10° → 44 %, 20° → 68 %; el motor queda a 2,1 puntos | `motor/tests/sinteticos.py` | superficie gaussiana |
| **F18** u = exp(−W1/τ) | Pasa de una distancia a una utilidad entre 0 y 1 | W1 igual a la tolerancia → u = 0,37 | `motor/puntaje/distancias.py` | test_f18 |
| **F19** penumbra y ancho mínimo | La punta de la sombra es difusa y un palo fino no da sombra plena | A 5°: punta difusa de 62 cm y ancho mínimo de 5,3 cm | `motor/sol/ventanas.py` | test de campo |
| **F20** mapa de refugios | Horas seguidas sin Sol en cada píxel: "¿dónde sobrevive?" | Refugio si T ≤ 50 h | `motor/destino/refugios.py` | test_f20 |

## Las cifras que más se van a preguntar

- **6,96°**: lo más alto que llega el Sol en el centro de Mons Mouton en 2027-2028 (JPL Horizons y
  Skyfield coinciden a 0,00001°). En verano llega a 6,94° (11/11/2027) y en invierno a 3,87°.
- **289 a 418 h**: noche completa sobre horizonte liso en las lunaciones de verano e invierno de
  2027. No 148 a 210 h (ver hallazgo 1).
- **50 h**: lo que soporta VIPER sin Sol (NASA). Sobre terreno liso la noche es de 6 a 8 veces eso:
  sobrevive solo donde el relieve lo eleva.
- **450,8 W**: dos paneles de 320 W a 45° con el Sol a 5°. NASA publica 450 W.
- **5,72 m**: la sombra de la tablita de 50 cm con el Sol a 5° (18:36 del 14/11 en Ciudad del Este).
- **19:41 a 20:12**: ventana de ensayo en Payunia el 14/11/2026, Sol de 7° a 1,5°, desde el
  oeste-suroeste (azimut 252° a 248°).

## Lo que no hay que decir

- "94 % parecido a Marte": C no es un porcentaje de parecido. Se dice "lo conocido encaja y falta
  medir esto".
- "Probabilidad de éxito": L y U son límites algebraicos, no probabilidades ni intervalos de confianza.
- Que la energía se ensaya en la Tierra: se ensaya la geometría, no la potencia.
- Cualquier cifra de una ficha con la banda MOCK DATA.
