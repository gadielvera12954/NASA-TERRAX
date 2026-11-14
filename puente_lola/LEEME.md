# puente_lola/ · puente temporal de datos reales

**No es una parte del Método de trabajo.** Lo pidió quien lidera el equipo el sábado 14/11 para que
el motor físico (Parte 3) corriera con relieve real antes de que estén `motor/ingest` y
`motor/escala` (dueño: Mathias). Entrega exactamente el contrato de `esquemas/grilla_entrada.md`:
cuando Mathias entregue sus grillas, este puente se borra y nada más cambia.

```bash
python -m pip install rasterio
```

```bash
python -m puente_lola.bajar
```

Baja solo las ventanas necesarias de los GeoTIFF de PGDA (productos 90 y 69), con versión
(Last-Modified y ETag) y SHA-256 de cada recorte en `datos/fuentes_pgda.json`. Detalle de qué se baja
y por qué, en el encabezado de `bajar.py`. Los datos quedan en `datos/` (fuera de git).
