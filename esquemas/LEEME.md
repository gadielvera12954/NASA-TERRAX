# esquemas/

**Dueño de la carpeta: Mathias (Parte 4).** Regla del Método de trabajo: los archivos compartidos
cambian solo con aprobación de su dueño, y cambiar un esquema se avisa en el grupo antes de unir.

Estos archivos los escribió **Jean (Parte 3)** en la primera hora, junto con Mathias, porque
definen la forma de lo que el motor físico recibe y entrega. Mathias los revisa y los aprueba en el
pull request.

| Archivo | Qué describe | Produce | Consume |
|---|---|---|---|
| `horizontes_bin.md` | Formato binario exacto de `destino/horizontes.bin` y `parcelas/*.bin` | Jean (`motor/horizonte`) | Erwan (sombras), Mathias (parcelas) |
| `horizontes_meta.schema.json` | Metadatos de cada archivo de horizontes en `manifest.json` | Mathias (`motor/exportar`) | Nahum (Data), verificación |
| `grilla_entrada.md`, `grilla.schema.json` | Grillas de alturas a 60 m | Mathias (`motor/escala`) | Jean |
| `distribuciones.schema.json` | Distribuciones de huella (F8, F9, F16) | Mathias (`motor/huella`) | Jean (`motor/puntaje`) |
| `escenario.schema.json` | Escenario de operación | Formulario de Operación o función SI | Jean (`motor/destino`) |
| `destino.schema.json` | Ficha del destino | Jean (`motor/destino`) | Nahum, Erwan (Destination) |
| `sol.schema.json` | Sol hora por hora | Jean (`motor/sol`) | Erwan (barra de horizonte) |
| `tarjeta.schema.json` | Tarjeta de Análogo Abierta | Jean (`motor/puntaje`) | Nahum (Search, ficha) |
| `fichas_indice.schema.json` | Lista de candidatas con controles | Jean (`motor/puntaje`) | Nahum (Search) |
| `paridad.schema.json` | 1.000 casos de paridad | Jean (`motor/destino`) | Erwan (Vitest) |
| `pruebas.schema.json` | Resultado de cada prueba | Jean (`motor/tests`) | Nahum (Tests) |
| `comun.schema.json` | Definiciones compartidas (`meta`, `fuente`, fechas) | — | Todos |

Reglas que aplican a todos: el esquema manda (si un archivo no coincide, el error está en el
archivo); agregar un campo es libre; renombrar o quitar uno exige cambiar los dos lados en el
mismo pull request; todo archivo de maqueta lleva `"maqueta": true`.
