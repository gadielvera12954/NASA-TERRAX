# TERRA-X · Parte 3 · Jean · Backend: motor físico

De estos módulos sale cada cifra que muestra la app: horizonte, Sol, destino y puntaje. Esta carpeta
contiene la Parte 3 completa según el Método de trabajo del equipo, lista para unirse al repositorio
que crea Mathias. Las carpetas de otras partes no se tocaron.

Carpetas propias de Jean: `motor/horizonte`, `motor/sol`, `motor/destino`, `motor/puntaje`,
`motor/tests`, `parametros/`, `informe/`. Escritos con Mathias en la primera hora: `esquemas/`
(dueño: Mathias, que los aprueba).

## Instalar y correr

```bash
python -m venv .venv
```

```bash
.venv/Scripts/python -m pip install -r requirements-motor.txt
```

```bash
.venv/Scripts/python -m pytest
```

```bash
.venv/Scripts/python -m motor.tests.cierre
```

En Linux o macOS, `.venv/bin/python`. La primera corrida baja los kernels de NAIF (19 MB) a
`motor/sol/kernels/`. `cierre` regenera, en orden: Sol por lunación, control contra Horizons,
planilla de campo, fichas del destino con horizonte liso, puntaje, `pruebas.json`, informe y
manifiesto. El destino con relieve va aparte porque tarda minutos:

```bash
.venv/Scripts/python -m motor.destino maqueta
```

```bash
.venv/Scripts/python -m motor.destino real --objetivo DATOS/mons_mouton_60m --capas DATOS/margen_60m DATOS/lejano_240m
```

## Estado de cada tarea del Método de trabajo

| Cuándo | Tarea | Estado | Dónde |
|---|---|---|---|
| Sáb 9-10 | Congelar `parametros.yaml` antes de ver datos | Hecho, con SHA-256 registrado. Los huecos que propuso la SI esperan confirmación humana | `parametros/` |
| Sáb 9-10 | Formato exacto de `horizontes.bin` con Mathias | Hecho: orden de píxeles, 72 azimutes, ángulo de cada byte, regla de consulta | `esquemas/horizontes_bin.md` |
| Sáb 10-12 | Pruebas primero: poste sobre plano y esfera perfecta | Hecho; fallaron antes del código | `motor/tests/`, `informe/registro_tdd/` |
| Sáb 12-18 | `horizonte` con curvatura y margen (F2), con Numba | Hecho. Puerta Horizonte: pasan poste, esfera, cuenco y gaussiana | `motor/horizonte/`, `informe/puerta_horizonte.md` |
| Sáb 18-21 | `sol`: Skyfield con DE421, control contra Horizons consultado ese día, refracción (F15) | Hecho. Diferencia máxima 0,00001° en la Luna (meta 0,1°); Horizons consultado el 14/11 | `motor/sol/` |
| Sáb 21-dom 2 | `destino` sobre la grilla real de Mons Mouton (F3 a F7, F20) | Hecho con relieve real de LOLA (puente temporal `puente_lola/`): noche de 424 h (verano) y 622 h (invierno) en el centro; 0 % de refugios en 30 × 30 km | `motor/destino/` |
| Dom 8 | Archivo de paridad de 1.000 casos | Hecho sobre el horizontes.bin actual; se regenera con el real | `salida/destino/paridad.json` |
| Dom 8-12 | `puntaje` (F10 a F12, F18), etiquetas, robustez y controles | Código hecho y probado con maqueta. **Faltan las distribuciones reales (Mathias)** | `motor/puntaje/` |
| Dom 12-15 | Validación: gaussiana, esquina de VIPER, correlación con NASA; `pruebas.json` con todas | Hecho: 17 pruebas, 9 pasan, 0 fallan, 8 pendientes con su motivo. F13 contra NASA: ρ = 0,985 | `motor/tests/validacion.py`, `salida/pruebas.json` |
| Dom 15-18 | Comparar la medición de sombras con la predicción; informe de validación | Comparación y planilla listas; **la medición se hace hoy de 17:50 a 18:36** | `informe/planilla_medicion_2026-11-14.md`, `motor/tests/campo.py` |
| Dom 18-21 | Repasar cada fórmula para el jurado | Hecho | `informe/defensa_formulas.md` |
| Turnos | Verificaciones de las 21:00, 0:00 y 12:00 | Guía preparada; se hacen a esa hora en el repositorio integrado | `informe/turnos_verificacion_jean.md` |

## Qué recibe y qué entrega

- **Recibe de Mathias:** grillas a 60 m con capas de margen (`esquemas/grilla_entrada.md`), el mapa
  AVGVISIB de PGDA 69 en la misma grilla, y las distribuciones de huella
  (`esquemas/distribuciones.schema.json`).
- **Entrega a Mathias:** `motor/horizonte` probado (para las 40 parcelas) y `salida/manifest_parte3.json`.
- **Entrega a Erwan:** el formato binario (`esquemas/horizontes_bin.md`, con lector de referencia en
  JavaScript) y el archivo de paridad.
- **Entrega a la web** (por `motor/exportar`): `destino/horizontes.bin`, `destino/refugios_{verano,invierno}.png`,
  `destino/ficha_*.json`, `destino/paridad.json`, `sol/*.json`, `fichas/*.json`, `pruebas.json`.

## Lo más importante que hay que saber

1. **La noche en Mons Mouton dura de 289 a 418 h, no de 148 a 210 h** (los documentos partían cada
   noche por la mitad). Ver `informe/hallazgos_para_el_equipo.md`.
2. **Con relieve real no hay refugios en los 30 × 30 km del centro de Mons Mouton**, y el motor coincide con el mapa de iluminación de NASA (ρ = 0,985). Ver hallazgo 6.
3. Todo lo que sale de la maqueta lleva `"maqueta": true`: la web muestra MOCK DATA.
4. El código lo redactó Claude Code y **todavía no lo revisaron Codex ni una persona**, como pide el
   Método de trabajo.
