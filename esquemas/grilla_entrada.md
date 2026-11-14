# Grillas que recibe el motor físico

Contrato entre `motor/escala` (Mathias, produce) y `motor/horizonte` y `motor/destino` (Jean,
consumen). Mathias entrega las grillas reales a 60 m antes de las 18:00 del sábado; Jean entrega
el módulo `horizonte` probado a la misma hora para que Mathias lo corra sobre las 40 parcelas.

## Archivos

Cada grilla son dos archivos con el mismo nombre:

- `<nombre>.npy`: matriz `float32` de `alto × ancho` con la altura en metros respecto de la
  superficie de referencia del cuerpo (en la Luna, la esfera de 1.737,4 km de LOLA). `NaN` = sin dato.
  `fila 0` es el borde superior (norte de la grilla).
- `<nombre>.json`: metadatos, validados con `esquemas/grilla.schema.json`.

```json
{
  "nombre": "mons_mouton_60m",
  "cuerpo": "luna",
  "pixel_m": 60.0,
  "x0_m": 69000.0,
  "y0_m": 155000.0,
  "proyeccion": { "tipo": "polar_estereografica_sur", "radio_m": 1737400.0, "lon0_deg": 0.0 },
  "promediado": "bloques de 3 × 3 píxeles de 20 m (sin interpolar)",
  "fuentes": [ { "id": "lola_ldem_80s_20mpp_adj", "sha256": "…" } ],
  "maqueta": false
}
```

`x0_m` e `y0_m` son las coordenadas proyectadas del **centro** del píxel `[0, 0]`. La columna
crece hacia +x y la fila hacia −y: el centro del píxel `[f, c]` está en
`(x0_m + c·pixel_m, y0_m − f·pixel_m)`.

Proyecciones admitidas por el motor:

| `tipo` | Campos | Uso |
|---|---|---|
| `polar_estereografica_sur` | `radio_m`, `lon0_deg` | Luna, productos LOLA del polo sur (esfera, escala real en el polo) |
| `utm` | `zona`, `hemisferio`, `lat_centro_deg`, `lon_centro_deg` | Tierra (Payunia) |
| `plano_local` | — | Terrenos sintéticos de prueba (sin curvatura si `cuerpo` es `sintetico`) |

## Capas para el horizonte

El horizonte necesita relieve más allá del recorte: 30 km de margen en la Tierra y hasta 300 km en
la Luna. Se entregan varias grillas **en la misma proyección**:

1. la grilla objetivo (los píxeles para los que se calcula el horizonte), a 60 m;
2. una o más capas de margen, a 60 m o más gruesas (por ejemplo 240 m), que cubren el radio
   pedido.

A cada punto del rayo el motor usa la capa más fina que lo contiene. Nunca se pasa una capa a una
malla más fina.
