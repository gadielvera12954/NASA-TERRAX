# servidor/ · el motor físico respondiendo en vivo

La web de TERRA-X funciona sola con los archivos exportados (`web/public/data`). Este servidor es
opcional: cuando está en marcha, cada clic del laboratorio 3D ejecuta **el mismo código de `motor/`**
en ese momento, en vez de leer un resultado precalculado.

No es `api/` (las funciones de Vercel de Mathias, documento 04): es un proceso local de Python para
la demostración y para explorar. No guarda nada: sin base de datos, sin cuentas, sin estado.

## Arrancar

```bash
python -m venv .venv
```

```bash
.venv/Scripts/python -m pip install -r requirements-motor.txt -r servidor/requirements.txt
```

```bash
.venv/Scripts/python -m servidor
```

Queda en `http://127.0.0.1:8787` (solo esta máquina). En otra terminal, la web:

```bash
npm --prefix web run dev
```

Vite reenvía `/api` al servidor (`web/vite.config.ts`). La barra superior de la web dice
"Live engine connected" cuando lo encuentra; si no, sigue con los datos exportados.

## Qué responde

| Ruta | Qué hace | Funciones del motor |
|---|---|---|
| `GET /api` | Lista estas rutas (para quien llega sin leer este archivo) | — |
| `GET /api/estado` | Versión, huella de `parametros.yaml`, si están las grillas reales | `parametros` |
| `GET /api/sol/ahora` | El Sol en este instante en Mons Mouton y en el sitio de campo | `motor.sol.posicion` (DE421, F15) |
| `POST /api/destino/punto` | Rover estacionado en un píxel: horizonte, potencia, batería hora por hora y veredicto | `motor.horizonte.calcular_horizontes_puntos` (F2), `motor.destino.simulacion.simular_punto` (F3 a F7) |
| `POST /api/destino/comparar` | De 2 a 3 escenarios de `/punto` en un pedido, cada uno con su `scenario_id`, más un resumen lado a lado | las mismas que `/punto` |
| `POST /api/campo/sombra` | Predicción de la sombra de la tablita y error de una medición | `motor.tests.campo.comparar` (F14, F15, F19) |

`POST /api/destino/punto` recibe `fila`, `col` y una `lunacion` (`verano` o `invierno`) o un par
`desde`/`hasta` (hasta 62 días, de 1901 a 2049 por la cobertura del marco lunar DE421). Opcionales:
`consumo_w`, `panel_w`, `bateria_wh`. Lo que la persona cambia respecto de las cifras públicas
vuelve en `vehiculo.cambios`, y `p_surv_w` se recalcula con F6.

Cada respuesta de `/punto` trae ahora `scenario_id` (SHA-256 de las entradas normalizadas, la huella
de `parametros.yaml`, la versión del motor y los datos de relieve usados; no incluye la hora), las
`entradas` normalizadas y `reutilizado`, que dice si el horizonte o la serie solar salieron de la
caché del proceso.

`POST /api/destino/comparar` recibe `{"escenarios": [{"id": "A", ...pedido de /punto}, ...], "series": true}`
con 2 o 3 escenarios. Cada uno es exactamente el cálculo de `/punto` (lo prueba
`servidor/tests/test_escenarios.py`). Un escenario inválido vuelve con `ok: false` y su error, y los
demás siguen. `resumen` pone lado a lado las métricas de `resultado` y `mejor` dice qué escenario
gana en cada una (tramo oscuro más corto, batería mínima más alta, más tiempo sobre la potencia de
supervivencia). Con `"series": false` no manda las series hora por hora, para el asistente SI.

**Caché.** El horizonte por raycast y la serie solar DE421 son resultados puros de (entradas,
parámetros congelados, versión del motor). Se guardan en memoria del proceso (64 como máximo) y se
entregan como copias; un candado por clave evita calcular dos veces lo mismo cuando llegan pedidos
juntos. No es estado de la persona: repetir un pedido da los mismos números con o sin caché.

Límites: cuerpos de hasta 64 KB (413 si se pasan), errores siempre en JSON (400 con el motivo,
404 con la lista de rutas, 405, 500 sin detalles internos), CORS abierto solo a orígenes
`localhost`/`127.0.0.1`, sin caché (`Cache-Control: no-store`). Los parámetros se cargan como copia
en cada pedido (`parametros.cargar()`), así que un cambio de consumo de una persona nunca se filtra
al pedido de otra.

## Relevo del chat SI

`POST /api/si/chat` (`servidor/si.py`) reenvía la pregunta a Gemini con la clave de la variable
`TERRAX_GEMINI_KEY`, que nunca llega al navegador. Exige la cabecera `X-TerraX: 1` y acepta 20
pedidos por minuto por IP. Sin clave responde 503 y la guía contesta solo con los datos de la ficha.

## Diferencia con el cálculo en el navegador

| | Servidor (este) | Navegador (`web/src/datos/laboratorio.ts`) |
|---|---|---|
| Horizonte del punto | 360 azimutes, trazado sobre LOLA hasta 300 km (3 capas) | 72 azimutes, tabla `horizontes.bin` |
| Fechas | Cualquiera entre 1901 y 2049 | Las dos lunaciones exportadas de 2027 |
| Altura y pendiente del punto | Sí (grilla de 60 m) | No (la grilla no viaja a la web) |
| Fórmulas | F3 a F7 de `motor/destino` | Las mismas, reescritas en TypeScript |

Las grillas reales (`datos/grillas/`) no están en el repositorio: se bajan con
`python -m puente_lola.bajar`. Si faltan, el servidor usa `horizontes.bin` y lo dice en
`punto.horizonte.detalle`.

Las series del Sol que usa el navegador se regeneran con:

```bash
.venv/Scripts/python -m servidor.exportar_laboratorio
```

## Pruebas

```bash
.venv/Scripts/python -m pytest servidor/tests
```

La prueba central comprueba que la respuesta para el centro de Mons Mouton es **idéntica** al bloque
`resultado` de `web/public/data/destino/ficha_verano.json`. Si difieren, el servidor dejó de ser el motor.

## Estado

Redactado con SI (Claude Code). Falta la revisión de Codex y de una persona que pide el Método de
trabajo. No está desplegado: en Vercel la web corre sin servidor, con el cálculo en el navegador.
