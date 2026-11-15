# Revisión del atlas TERRA-X

## Recorrido y decisiones

La portada presenta el objetivo del ensayo, una entrada directa al catálogo y el mapa de Mons Mouton. El relieve sombreado y las curvas de nivel provienen de los archivos LOLA del proyecto. Abrir la vista 3D es opcional. Los controles solares actúan junto a la escena que modifican.

El catálogo busca por nombre o identificador en todo el índice y separa las referencias científicas. La ficha muestra el veredicto exportado, la cobertura de evidencia, las condiciones que difieren y la prioridad de medición. La impresión incluye las ventanas de ensayo y la fuente.

Comparar sitios conserva hasta tres fichas y el objetivo de lectura en la URL. Los gráficos de propiedades y las tablas de valores se despliegan después de la comparación resumida. Tierra y Luna permite estudiar sombras, energía, gravedad y tiempo por separado. Se puede leer el resultado de cada mundo sin mover la cortina.

## Capturas

| Vista | Escritorio, 1440 px | Móvil, 390 px |
| --- | --- | --- |
| Inicio | [Portada](home-1440.png) | [Portada](home-390.png) |
| Explorar sitios | [Catálogo](explore-1440.png) | [Catálogo](explore-390.png) |
| Ficha | [Payunia P-07](card-1440.png) | [Payunia P-07](card-390.png) |
| Comparar | [Fichas seleccionadas](compare-1440.png) | [Fichas seleccionadas](compare-390.png) |
| Tierra y Luna | [Sombras](worlds-1440.png) | [Sombras](worlds-390.png) |
| Laboratorio | [Relieve y controles del rover](lab-1440.png) | [Relieve y controles del rover](lab-390.png) |
| Cómo funciona | [Guía](guide-1440.png) | [Guía](guide-390.png) |

También se revisaron las [fuentes y verificaciones](checks-1440.png), el [detalle de curvas](compare-detail-1440.png), la [escena ilustrativa](worlds-3d-1440.png) y la [ficha impresa en A4](ficha-P-07.pdf).

## Auditoría inicial

Las capturas anteriores muestran el aviso global de maqueta sobre la portada lunar, la barra solar fija al pie de la página y el acceso al comparador a través de la escena Tierra/Luna. Al escribir en el buscador, solo se comprobaba el nombre de la candidata abierta. [Portada anterior](antes-home-1440.png) · [Comparación anterior](antes-compare-1440.png) · [Comparación anterior en móvil](antes-compare-375.png)

La posibilidad de confundir el control lunar con un destino terrestre y la dificultad de interpretar C y E eran hipótesis de usabilidad. La revisión cubrió comportamiento y presentación en navegador. La comprensión de la interfaz por parte de estudiantes, docentes y equipos de campo queda pendiente de sesiones con participantes.

## Verificación de la entrega

- React, TypeScript y Vite compilaron la aplicación. El paquete compartido del motor 3D supera el umbral de aviso de 500 kB de Vite y se carga cuando se abre una escena. La copia de producción guarda 69 recursos locales para su uso sin conexión.
- Las 16 pruebas de navegador cubrieron las fichas actuales y el formato anterior, las descargas originales, los 31 hashes registrados, selección, historial, idioma, recorrido de 90 segundos, errores recuperables y comparación sin conexión. La prueba sin WebGL abrió una ficha, la escena ilustrativa y el laboratorio a partir de los recursos locales.
- Las ocho vistas del atlas se revisaron a 375, 390, 768 y 1440 px. Las 32 combinaciones mantuvieron el ancho del documento dentro del viewport. Se completó el recorrido por teclado con ampliación al 200 % y por controles táctiles en un navegador móvil emulado.
- Las comprobaciones automatizadas con axe de las vistas principales y los cuatro fenómenos finalizaron sin infracciones detectadas de los criterios A/AA evaluados. Se verificaron el enlace de salto al contenido, los controles de cámara, la lectura textual de valores y el inicio pausado del recorrido con movimiento reducido.
- El PDF de P-07 conserva el veredicto, los datos de demostración, las 14 ventanas y la fuente en una página A4.
- El laboratorio produjo un resultado con el servidor local y la tabla exportada de 72 azimutes. Al cortar la API, se verificó la vía de cálculo en el navegador. El motor y el servidor pasaron 161 pruebas. Cuatro casos quedaron omitidos por faltar productos intermedios o grillas originales.
- Las fichas terrestres distribuidas siguen siendo demostrativas. El espacio especializado histórico de `/team.html` se conserva en inglés. El recorrido público está disponible en inglés y español.

## Abrir la aplicación

Desde `C:\Users\espin\Documents\Nasa\web`, ejecutar `npm ci` y `npm run dev`. Para verificar el modo sin conexión, ejecutar `npm run build` y `npm run preview`, abrir la dirección indicada y esperar el estado de guardado en el pie de página. El servidor Python es opcional.

## Integración con main

El merge combina el atlas y su tema oscuro predeterminado con los datos y funciones de main en 52c5f7c. Conserva las cuarenta parcelas terrestres, las cinco referencias de control, cuentas, Comunidad, moderación, el asistente SI y la verificación de archivos en el navegador. El catálogo usa el estado real o demostrativo declarado por cada exportación.

La compilación y las 18 pruebas de navegador finalizaron correctamente. El motor y el servidor pasaron 184 pruebas, con cuatro omisiones por falta de productos intermedios o grillas originales. La verificación de integridad confirmó los 64 archivos publicados. La revisión de las once vistas en ambos temas y cuatro anchos comprobó 88 combinaciones sin desbordamientos generales. Se comprobó el registro y cierre de sesión contra un servidor y una base temporal de prueba, y la accesibilidad del formulario, del asistente y de las vistas integradas.

Las capturas merge-dark-home-1440.png, merge-dark-home-390.png, merge-dark-community-1440.png y merge-dark-lab-1440.png muestran esta combinación. El resultado detallado de la revisión está en merge-checks.json.
