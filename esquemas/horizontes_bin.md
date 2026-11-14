# `horizontes.bin` — formato v1

Contrato acordado entre Jean (produce) y Mathias (exporta) en la primera hora del sábado 14/11.
Lo consume Erwan en el navegador (sombras del terreno, Dos mundos) y Mathias para las 40 parcelas
(`parcelas/*.bin` usa **el mismo formato**). Implementación de referencia en Python:
`motor/horizonte/formato.py`. Si este documento y el código no coinciden, manda este documento
y el error está en el código.

## Qué guarda

Para cada píxel de la grilla, la **altura angular del horizonte** (en grados) en 72 direcciones,
calculada con el relieve, la curvatura y el margen de la fórmula F2 del documento 02. Un píxel está
en sombra cuando el Sol está más bajo que su horizonte en esa dirección. En el navegador no hay
física: solo una búsqueda en esta tabla.

## Estructura del archivo

Todo en **little-endian**. Cabecera fija de **32 bytes** y después los datos.

| Byte | Largo | Tipo | Campo | Valor en v1 |
|---:|---:|---|---|---|
| 0 | 4 | ASCII | `magia` | `TXHZ` |
| 4 | 1 | uint8 | `version` | `1` |
| 5 | 1 | uint8 | `orden` | `0` = azimut-mayor `[k][fila][col]` |
| 6 | 1 | uint8 | `cuerpo` | `0` sintético · `1` Luna · `2` Tierra |
| 7 | 1 | uint8 | `referencia_azimut` | `0` = norte de la grilla |
| 8 | 2 | uint16 | `n_az` | `72` |
| 10 | 2 | uint16 | `desplazamiento` | `128` |
| 12 | 2 | uint16 | `divisor` | `10` |
| 14 | 2 | uint16 | `reservado` | `0` |
| 16 | 4 | uint32 | `ancho` (W, columnas) | `500` en el destino, `50` en una parcela |
| 20 | 4 | uint32 | `alto` (H, filas) | `500` en el destino, `50` en una parcela |
| 24 | 4 | int32 | `convergencia_mdeg` | milésimas de grado; ver "Azimut" |
| 28 | 4 | uint32 | `pixel_mm` | tamaño del píxel en milímetros (`60000` = 60 m) |

Datos: `n_az × alto × ancho` bytes `uint8`, en orden azimut-mayor:

```
offset(k, fila, col) = 32 + (k * alto + fila) * ancho + col
```

Así, todos los píxeles de un mismo azimut son un bloque contiguo de `alto × ancho` bytes:
para sombrear el mapa entero con un Sol hace falta leer un solo bloque.

Tamaño: destino 32 + 72 × 500 × 500 = 18.000.032 bytes (18 MB; el documento 02 lo estima en 18 MB
sin comprimir). Parcela: 32 + 72 × 50 × 50 = 180.032 bytes (180 KB). La compresión para el
transporte (gzip o brotli de HTTP) la decide `motor/exportar`; el contenido descomprimido es siempre
este.

## Píxeles

`fila 0` es el borde superior y `col 0` el borde izquierdo, **en el mismo orden y tamaño que
`alturas.png`**. El borde superior es el norte de la grilla (eje +y de la proyección).

## Azimut

El índice `k` corresponde al azimut `α_k = 5·k` grados (`k = 0…71`), medido **desde el norte de la
grilla, en sentido horario** (0° = arriba en `alturas.png`, 90° = derecha).

Se usa el norte de la grilla, y no el norte geográfico de cada píxel, porque el Sol está en el
infinito: con una sola dirección de Sol en la grilla, todos los píxeles quedan bien orientados. En
el recorte de Mons Mouton el norte geográfico gira unos ±5° de un borde al otro; con el norte de la
grilla ese giro no afecta la búsqueda.

Para pasar un azimut geográfico (el que da JPL Horizons o Skyfield, desde el norte geográfico del
centro del recorte, sentido horario) al azimut de la grilla:

```
A_grilla = (A_geografico + convergencia_mdeg / 1000) mod 360
```

En una grilla polar estereográfica sur con meridiano central `lon0`, `convergencia = lon − lon0`
(en el centro de Mons Mouton con `lon0 = 0°`: +31°). En una grilla local alineada al norte vale 0.

## Ángulo de cada byte

```
e_h = (b − desplazamiento) / divisor   →   e_h = (b − 128) / 10  grados
```

| byte `b` | horizonte |
|---:|---|
| 0 | −12,8° o más bajo (saturado) · también "sin relieve que tape" |
| 128 | 0,0° |
| 151 | +2,3° |
| 255 | +12,7° o más alto (saturado) |

Resolución 0,1°; error máximo de cuantización 0,05°, la mitad de la meta del Sol contra Horizons
(0,1°). La saturación no cambia ninguna sombra: el Sol en Mons Mouton va de −8,3° a +8,3° y la
barra de horizonte de 1,5° a 10°.

Codificación (solo Python): `b = clip(floor(e_h × 10 + 0,5) + 128, 0, 255)`, es decir redondeo al
décimo más cercano con empate hacia arriba. Un horizonte de −∞ (ningún relieve en el rayo) se
guarda como `0`.

## Regla de consulta (idéntica en Python y en el navegador)

Dados el azimut del Sol en la grilla `A` (grados, en [0, 360)) y su altura `e` (grados):

```
paso = 360 / n_az                        // 5 exactamente
k = floor(A / paso + 0.5) mod n_az       // azimut más cercano; empate hacia arriba
e_h = (b[k][fila][col] − 128) / 10
en_sombra = e < e_h                      // igual = iluminado
```

No se interpola entre azimutes: el documento 04 lo define como "solo una búsqueda". La prueba de
paridad (`destino/paridad.json`, 1.000 casos) comprueba que el navegador aplique exactamente esta
regla sobre los mismos bytes.

## Referencia en JavaScript (para Erwan; no es código de la app)

```js
function leerHorizontes(buf) {               // buf: ArrayBuffer ya descomprimido
  const v = new DataView(buf);
  const magia = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magia !== "TXHZ" || v.getUint8(4) !== 1) throw new Error("horizontes.bin: formato desconocido");
  const nAz = v.getUint16(8, true), desp = v.getUint16(10, true), div = v.getUint16(12, true);
  const ancho = v.getUint32(16, true), alto = v.getUint32(20, true);
  const convergencia = v.getInt32(24, true) / 1000;
  const datos = new Uint8Array(buf, 32, nAz * alto * ancho);
  const paso = 360 / nAz;
  return {
    nAz, ancho, alto, convergencia,
    enSombra(fila, col, A, e) {
      const k = Math.floor(A / paso + 0.5) % nAz;
      const b = datos[(k * alto + fila) * ancho + col];
      return e < (b - desp) / div;
    },
  };
}
```

## Metadatos en `manifest.json`

`motor/exportar` agrega para cada archivo de horizontes: `sha256`, `formato: "TXHZ v1"`, `ancho`,
`alto`, `n_az`, `pixel_m`, `convergencia_deg`, `cuerpo`, `altura_observador_m` y la huella de
`parametros.yaml` con que se calculó. El esquema de esos campos está en
`esquemas/horizontes_meta.schema.json`.
