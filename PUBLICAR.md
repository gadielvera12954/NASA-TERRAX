# Publicar TERRA-X completo (para Jean)

El sitio de Vercel ya publica la web estática desde `main`: ranking, ficha, laboratorio 3D,
Dos Mundos, Verificación, Guía y el chat SI. No hay cuentas ni base de datos: el sitio no guarda
datos personales.

Lo único que **no** puede correr en Vercel es el servidor de Python (`servidor/`), que hace dos cosas:

- el **motor en vivo** (cualquier fecha 1901–2049, horizonte de 360 azimutes);
- el **relevo del chat SI** (la clave de Gemini queda en el servidor, nunca en el navegador).

Sin el servidor, la web funciona igual: usa los datos exportados y el chat responde con los datos
de la ficha. Para activar todo hay que hacer los tres pasos de abajo. Llevan unos 15 minutos.

## 1. Publicar el servidor de Python

El servidor no guarda nada, así que no necesita disco persistente: sirve el plan gratuito.

### Opción A: Render (con el archivo `render.yaml` del repo)

1. En https://dashboard.render.com → **New → Blueprint** → elegir el repositorio `NASA-TERRAX`.
2. Render lee `render.yaml` y crea el servicio `terrax-servidor`.
3. En **Environment**, pegar `TERRAX_GEMINI_KEY` (Mathias la tiene; **nunca** al repositorio).
4. Esperar a que el despliegue termine y copiar la URL (por ejemplo `https://terrax-servidor.onrender.com`).
5. Comprobar: abrir `https://…onrender.com/api/estado` → tiene que devolver un JSON con
   `"motor": "terra-x"`.

### Opción B: cualquier otro hosting

```bash
pip install -r requirements-motor.txt -r servidor/requirements.txt
```

```bash
waitress-serve --host 0.0.0.0 --port $PORT servidor.app:app
```

| Variable | Valor |
|---|---|
| `TERRAX_DETRAS_DE_PROXY` | `1` (toma la IP real del visitante detrás de Vercel/Render) |
| `TERRAX_GEMINI_KEY` | la clave de Gemini del chat SI |

La primera vez, Skyfield baja las efemérides DE421 (unos 17 MB) desde la NASA; el hosting necesita
salida a internet. Las grillas grandes de LOLA (`datos/grillas`) no están en el repo: sin ellas el
servidor usa `horizontes.bin` (72 azimutes) y lo dice en cada respuesta.

## 2. Conectar el sitio de Vercel con el servidor

El navegador habla **solo con el dominio de Vercel**, que reenvía `/api/...` al servidor:

1. Copiar `web/vercel.json.example` a `web/vercel.json`.
2. Reemplazar `https://TU-SERVIDOR.onrender.com` por la URL del paso 1.
3. Commit y push a `main`. Vercel vuelve a publicar solo.

Si en Vercel el directorio raíz del proyecto no es `web/`, el archivo va en la raíz del proyecto de
Vercel (Settings → General → Root Directory).

Comprobar: `https://nasa-terrax.vercel.app/api/estado` tiene que devolver el mismo JSON, y en el pie
del sitio tiene que aparecer **Live engine connected**.

## 3. La clave de Gemini (chat SI)

La clave **no está en el repositorio**: GitHub la bloquea porque es una credencial de Google Cloud
atada a una cuenta de servicio.

- **Sitio publicado:** en la variable `TERRAX_GEMINI_KEY` del servidor (paso 1). La web manda las
  preguntas a `POST /api/si/chat` y el servidor llama a Gemini con la clave.
- **Desarrollo local:** en `web/.env.development.local` (fuera de git; Vite solo lo usa en desarrollo)
  como `VITE_GEMINI_API_KEY=...`.

Recomendado en https://console.cloud.google.com/apis/credentials: limitar la clave a la API
"Generative Language" y rotarla después del hackatón.
