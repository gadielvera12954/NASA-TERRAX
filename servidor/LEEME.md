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
| `POST /api/campo/sombra` | Predicción de la sombra de la tablita y error de una medición | `motor.tests.campo.comparar` (F14, F15, F19) |

`POST /api/destino/punto` recibe `fila`, `col` y una `lunacion` (`verano` o `invierno`) o un par
`desde`/`hasta` (hasta 62 días, de 1901 a 2049 por la cobertura del marco lunar DE421). Opcionales:
`consumo_w`, `panel_w`, `bateria_wh`. Lo que la persona cambia respecto de las cifras públicas
vuelve en `vehiculo.cambios`, y `p_surv_w` se recalcula con F6.

Límites: cuerpos de hasta 64 KB (413 si se pasan), errores siempre en JSON (400 con el motivo,
404 con la lista de rutas, 405, 500 sin detalles internos), CORS abierto solo a orígenes
`localhost`/`127.0.0.1`, sin caché (`Cache-Control: no-store`). Los parámetros se cargan como copia
en cada pedido (`parametros.cargar()`), así que un cambio de consumo de una persona nunca se filtra
al pedido de otra.

## Cuentas, Comunidad y panel admin

El mismo servidor guarda las cuentas, los artículos de divulgación y el registro de los admins en
`datos/comunidad.sqlite3` (fuera de git; otra ruta con la variable `TERRAX_DB`). El sitio público
sigue sin cuentas: la web las muestra solo cuando este servidor responde.

- Roles: **lector** (lee y puede pedir verificación), **autor** (verificado por un admin: escribe),
  **admin** (verifica personas, publica o pide cambios, cambia roles, desactiva cuentas).
- Cada artículo pasa por revisión; lo que no está publicado solo lo ven su autor y los admins.
- Contraseñas: hash scrypt de Werkzeug, 10 caracteres o más; 5 intentos fallidos bloquean 15 min.
- Sesión: cookie firmada `HttpOnly`, `SameSite=Lax`; los pedidos que cambian algo exigen la
  cabecera `X-TerraX: 1`. Toda acción de un admin queda en `GET /api/admin/auditoria`.

El primer admin se crea así: la persona se registra en la web (`#account`) con su contraseña y
después, en esta máquina:

```bash
python -m servidor.cuentas admin su-correo@ejemplo.org
```

```bash
python -m servidor.cuentas lista
```

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
