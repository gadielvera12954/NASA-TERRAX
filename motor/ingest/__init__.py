"""motor/ingest: baja solo lo necesario de cada fuente y registra versión y SHA-256. Dueño: Mathias (Parte 4).

* `copernicus`: teselas del modelo de relieve Copernicus GLO-30 (ESA/UE, AWS Open Data, sin cuenta).
* `sentinel2`: NDVI percentil 90 anual a partir de Sentinel-2 L2A (ESA, AWS Open Data, sin cuenta).

La Luna (LOLA, PGDA) la baja por ahora `puente_lola/` con el mismo contrato de grillas.
NASADEM y HLS (NASA) piden Earthdata Login: entran cuando el equipo cargue sus credenciales. Hasta
entonces se usan estas fuentes abiertas de ESA, declaradas en cada salida.

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
