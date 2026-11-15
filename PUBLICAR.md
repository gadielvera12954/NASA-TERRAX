# Publicar TERRA-X completo (para Jean)

El sitio de Vercel ya publica la web estática desde `main`: ranking, ficha, laboratorio 3D,
Dos Mundos, Verificación, Guía y el chat SI. Lo que **no** puede correr en Vercel es el servidor de
Python (`servidor/`), que hace tres cosas:

- el **motor en vivo** (cualquier fecha 1901–2049, horizonte de 360 azimutes);
- las **cuentas**, la **Comunidad** con autores verificados y el **panel admin**;
- la base de datos de esas cuentas (SQLite).

Sin el servidor, la web funciona igual y en Comunidad muestra un aviso. Para activar todo hay que
hacer los cuatro pasos de abajo. Llevan unos 20 minutos.

## 1. Publicar el servidor de Python

Cualquier hosting de Python sirve (Render, Railway, Fly.io, una VM). Lo único obligatorio es un
**disco persistente** para la base de datos: si el disco se borra en cada despliegue, se pierden las
cuentas.

### Opción A: Render (con el archivo `render.yaml` del repo)

1. En https://dashboard.render.com → **New → Blueprint** → elegir el repositorio `NASA-TERRAX`.
2. Render lee `render.yaml` y crea el servicio `terrax-servidor` con un disco de 1 GB en `/data`.
   El disco necesita un plan pago (Starter); en el plan gratuito la base se borra en cada despliegue.
3. Render genera solo `TERRAX_SECRET_KEY`. Esperar a que el despliegue termine y copiar la URL
   (por ejemplo `https://terrax-servidor.onrender.com`).
4. Comprobar: abrir `https://…onrender.com/api/estado` → tiene que devolver un JSON con
   `"motor": "terra-x"`.

### Opción B: cualquier otro hosting

```bash
pip install -r requirements-motor.txt -r servidor/requirements.txt
```

```bash
waitress-serve --host 0.0.0.0 --port $PORT servidor.app:app
```

Variables de entorno:

| Variable | Valor |
|---|---|
| `TERRAX_SECRET_KEY` | una cadena larga y aleatoria (firma las sesiones; nunca al repositorio) |
| `TERRAX_DB` | ruta en el disco persistente, por ejemplo `/data/comunidad.sqlite3` |
| `TERRAX_COOKIE_SEGURA` | `1` (la cookie de sesión solo viaja por HTTPS) |
| `TERRAX_DETRAS_DE_PROXY` | `1` (toma la IP real del visitante detrás de Vercel/Render) |
| `TERRAX_GEMINI_KEY` | la clave de Gemini del chat SI (Mathias la tiene; **nunca** al repositorio) |

En Render, `TERRAX_GEMINI_KEY` se pega a mano en el panel (Environment): el `render.yaml` la deja
declarada pero vacía a propósito.

Para generar `TERRAX_SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

La primera vez, Skyfield baja las efemérides DE421 (unos 17 MB) desde la NASA; el hosting necesita
salida a internet. Las grillas grandes de LOLA (`datos/grillas`) no están en el repo: sin ellas el
servidor usa `horizontes.bin` (72 azimutes) y lo dice en cada respuesta.

## 2. Conectar el sitio de Vercel con el servidor

El navegador tiene que hablar **solo con el dominio de Vercel** (así la cookie de sesión es del mismo
sitio y no hace falta abrir CORS). Vercel reenvía `/api/...` al servidor:

1. Copiar `web/vercel.json.example` a `web/vercel.json`.
2. Reemplazar `https://TU-SERVIDOR.onrender.com` por la URL del paso 1.
3. Commit y push a `main`. Vercel vuelve a publicar solo.

Si en Vercel el directorio raíz del proyecto no es `web/`, el archivo va en la raíz del proyecto de
Vercel (Settings → General → Root Directory).

Comprobar: `https://nasa-terrax.vercel.app/api/estado` tiene que devolver el mismo JSON, y en la
barra de arriba del sitio tiene que aparecer **Live**.

## 3. Crear el primer admin

1. En el sitio publicado: **Sign in → Create an account**, con tu correo y tu propia contraseña.
2. En la consola del hosting (Render → Shell):

```bash
python -m servidor.cuentas admin tu-correo@ejemplo.org
```

Después, desde el panel admin (`#admin`) se verifica a las personas y se nombran otros admins.
Para ver las cuentas (sin contraseñas):

```bash
python -m servidor.cuentas lista
```

## 4. La clave de Gemini (chat SI)

La clave **no está en el repositorio**: GitHub la bloquea porque es una credencial de Google Cloud
atada a una cuenta de servicio. Vive en dos lugares, y en ninguno llega al navegador de un visitante:

- **Sitio publicado:** en la variable `TERRAX_GEMINI_KEY` del servidor (paso 1). La web manda las
  preguntas a `POST /api/si/chat` y el servidor llama a Gemini con la clave. Hasta que el servidor
  esté publicado, el chat responde solo con los datos de la ficha y lo avisa.
- **Desarrollo local:** en `web/.env.development.local` (fuera de git; Vite solo lo usa en desarrollo) como `VITE_GEMINI_API_KEY=...`.

Recomendado en https://console.cloud.google.com/apis/credentials: limitar la clave a la API
"Generative Language" y rotarla después del hackatón.

## Copia de seguridad de la base

La base es un solo archivo. Para copiarla sin cortar el servicio:

```bash
sqlite3 /data/comunidad.sqlite3 ".backup '/data/respaldo-$(date +%F).sqlite3'"
```

Las contraseñas están guardadas como hash scrypt: ni siquiera un admin con la base en la mano
puede leerlas.
