# Integración del MVP de Nahum con main

Base de Nahum: `64c3171` (respaldo completo del MVP). Main incorporado: `aca01dd`.

## Conflictos resueltos

- Git detectó un conflicto de contenido en `web/src/App.tsx`. Se conservó la entrada del MVP de Nahum. La App original de main se preservó como `web/src/sistema/TeamApp.tsx`, ajustando únicamente los imports relativos, con su propia entrada `/team.html`.
- `.gitignore`, README y declaración de SI se combinaron conservando las aportaciones de ambas ramas.
- La incompatibilidad de contratos se resolvió en `web/src/datos/integration.ts`: acepta el formato original y las exportaciones actuales. Normaliza copias para mostrar en pantalla, sin reescribir datos científicos.
- Las fichas actuales usan dimensiones estructuradas, listas de mediciones, nuevas etiquetas, compatibilidad nullable y nombres de lugar en la raíz. El manifiesto actual usa fuentes con otros campos y algunos hashes nulos. Todos esos casos se adaptan explícitamente.

## Qué se conserva

- Tu interfaz sigue siendo la página principal. Los archivos de estilos del MVP, tokens y contexto de idioma son idénticos al respaldo `64c3171`.
- Se conservan navegación, español/inglés, persistencia de idioma, búsqueda, ficha, recorrido, controles de Sol, impresión, descargas y modo offline.
- La selección ahora permite consultar todas las candidatas y controles exportados por main; cada descarga contiene el JSON original, sin normalización.
- Verificación muestra el informe exportado en ambos idiomas, con las pruebas pendientes identificadas.
- El espacio original del equipo conserva Destination y las demás vistas, con sus limitaciones preexistentes; se abre desde Guía sin sustituir el flujo principal de Nahum.
- Motor, esquemas, parámetros, puente lunar, datos públicos y componentes científicos coinciden con main. No se modificaron archivos de otros responsables para resolver la integración.

## Verificación

- Compilación de producción con las dos entradas: correcta.
- 9 pruebas de navegador aprobadas: las seis originales del MVP con sus fixtures de maqueta y tres de integración con los datos vigentes.
- Las pruebas nuevas recorren todas las fichas del índice, verifican puntajes, persistencia de selección al recargar y descargas idénticas al archivo fuente.
- Los 31 hashes del manifiesto coinciden.
- No hay diferencias con main en `motor/`, `esquemas/`, `parametros/`, `puente_lola/`, `web/public/data`, `web/src/luz`, `web/src/graficos`, `web/src/pantallas` ni `web/src/recorrido`.
- No se incluyen carpetas temporales, entornos de auditoría ni los documentos locales sin seguimiento.

Las correcciones visuales y demás pendientes de la auditoría siguen siendo tareas independientes; esta integración conserva el diseño, no constituye un rediseño ni una certificación científica completa.
