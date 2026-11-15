# Informe de validación · Parte 3 (motor físico)

Generado por `python -m motor.tests.informe` · motor 0.1.0 · parámetros `346a6cd22cc8cb1c…`

Cada meta se escribió antes de ver el resultado (documento 02, §6) y se publica aunque no se cumpla. Una prueba sin comprobar figura como pendiente, nunca como aprobada.

**17 pruebas: 9 pasan, 0 fallan, 8 pendientes.**

| Prueba | Fórmula | Meta | Resultado | Estado | Datos | Dueño |
|---|---|---|---|---|---|---|
| Poste en plano | F1 | Error de 1 píxel o menos | 0.00 px en 32 casos (8 azimutes × 4 alturas de Sol) | PASA | sinteticos | Jean |
| Esfera perfecta | F2 | 0 píxeles en sombra por relieve | 0 píxeles en sombra (101 × 101 píxeles, 72 azimutes, Sol de 0,1° a 7°) | PASA | sinteticos | Jean |
| Superficie gaussiana contra Smith | F17 | f dentro de 3 puntos de la curva teórica, de 2° a 15° | 2.1 puntos de diferencia máxima (pendiente RMS de 5°, 10° y 20°) | PASA | sinteticos | Jean |
| Cuenco sintético | — | Largo de sombra interna dentro de 1 píxel | 0.94 px de diferencia máxima (Sol a 5°, 10° y 20°) | PASA | sinteticos | Jean |
| Esquina de VIPER | F4 | Dentro del 1 % de 450 W | 450.8 W con el Sol a 5° en una esquina: 0.18 % de diferencia | PASA | sinteticos | Jean |
| Sol contra JPL Horizons | — | Menos de 0,1° frente a Horizons | 0.00001° en la Luna y 0.0006° en total (consultas de Horizons: 2026-11-07, 2026-11-14) | PASA | reales | Jean |
| Caso a mano | F11 | 0,705 y 0,955 | L = 0.705 y U = 0.955 | PASA | sinteticos | Jean |
| Paridad Python y navegador | — | Misma sombra en 1.000 casos de prueba | El archivo de paridad está listo; falta que la prueba de Vitest de Erwan lo corra en el navegador | PENDIENTE | ninguno | Erwan (navegador) · Jean (archivo) |
| Reproducibilidad | — | Mismos archivos, mismo código de verificación | Dos corridas dan el mismo SHA-256 (7f51c9919181…) | PASA | sinteticos | Jean |
| Iluminación promedio contra NASA | F13 | ρ de 0,8 o más, en el mismo período de 18,6 años | ρ = 0.99, error cuadrático medio 2.5 puntos (10000 puntos) | PASA | reales | Jean |
| Rugosidad contra NASA | F9 | ρ de 0,6 o más (mide otra cosa, ver 3.4) | La corre motor/huella (Mathias) con el mapa de rugosidad de PGDA 90 | PENDIENTE | ninguno | Mathias |
| El recorte de Mons Mouton queda primero | — | Recorte lunar primero; copias con ruido en orden | Faltan las distribuciones reales de huella (Mathias, domingo 8:00). El resultado con la maqueta está en el detalle. | PENDIENTE | maqueta | Jean |
| La parcela con vegetación sale Incompatible | — | Médanos del Chaco sale "Incompatible" | Faltan las distribuciones reales de huella (Mathias, domingo 8:00). El resultado con la maqueta está en el detalle. | PENDIENTE | maqueta | Jean |
| La luz rasante aporta algo propio (H1b) | F16, F17 | ρ menor a 0,9; si no, se baja su peso y se dice | Faltan las distribuciones reales de huella (Mathias, domingo 8:00). El resultado con la maqueta está en el detalle. | PENDIENTE | maqueta | Jean |
| Sombras al atardecer en Ciudad del Este | F14 | Error de 5 % o menos, de 5° a 15° | La medición se hace el sábado 14/11 de 17:50 a 18:36 (si llueve, el domingo). Cargarla en campo/medicion_2026-11-14.csv con el formato de informe/plantilla_medicion_campo.csv | PENDIENTE | ninguno | Jean |
| Verificador de la función SI | — | 9 de 10 respuestas limpias | La corre Mathias con el banco de 10 preguntas (domingo 15:00) | PENDIENTE | ninguno | Mathias |
| Prueba con personas | — | 3 personas ajenas dicen qué falta y qué harían después | La hace quien lidera el equipo con 3 personas ajenas | PENDIENTE | ninguno | Quien lidera |

## Sol contra JPL Horizons

| Consulta | Archivo | Puntos | Peor diferencia en elevación | Peor diferencia en azimut (× cos e) |
|---|---|---:|---:|---:|
| 2026-11-07 | luna_mons_mouton_centro_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-07 | luna_im2_athena_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-07 | luna_mons_mouton_norte_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-07 | luna_mons_mouton_sur_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-07 | tierra_cde_2026-11-14_geometrica.csv | 301 | 0.000595° | 0.000404° |
| 2026-11-07 | tierra_cde_2026-11-14_refractada.csv | 180 | 0.000627° | 0.000284° |
| 2026-11-07 | tierra_cde_2026-11-15_refractada.csv | 181 | 0.000631° | 0.000286° |
| 2026-11-07 | tierra_payunia_2026-11-14_refractada.csv | 199 | 0.000555° | 0.000386° |
| 2026-11-07 | tierra_puna_2026-11-14_refractada.csv | 172 | 0.000615° | 0.000286° |
| 2026-11-14 | luna_mons_mouton_centro_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-14 | luna_im2_athena_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-14 | luna_mons_mouton_norte_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-14 | luna_mons_mouton_sur_2027_2028.csv | 8773 | 0.000013° | 0.000009° |
| 2026-11-14 | tierra_cde_2026-11-14_geometrica.csv | 301 | 0.000600° | 0.000408° |
| 2026-11-14 | tierra_cde_2026-11-14_refractada.csv | 180 | 0.000632° | 0.000287° |
| 2026-11-14 | tierra_cde_2026-11-15_refractada.csv | 181 | 0.000637° | 0.000289° |
| 2026-11-14 | tierra_payunia_2026-11-14_refractada.csv | 199 | 0.000559° | 0.000389° |
| 2026-11-14 | tierra_puna_2026-11-14_refractada.csv | 172 | 0.000620° | 0.000288° |

Skyfield con DE421 en el marco MOON_ME_DE421 (el de LOLA). La consulta del 14/11 se hizo el mismo día del hackatón, como pide el Método de trabajo. Meta: menos de 0,1°.

## El destino sin relieve (Sol real, horizonte liso)

| Lunación | Sol máximo | Noche (centro del Sol bajo el horizonte) | Tramo con menos de 108,4 W | Batería mínima | En riesgo |
|---|---:|---:|---:|---:|---|
| verano (2027-10-27 a 2027-11-26) | 6,94° | 295 h | 290 h | 0 % | sí |
| invierno (2027-05-03 a 2027-06-01) | 3,87° | 415 h | 410 h | 0 % | sí |

Sobre terreno liso un rover estacionado no sobrevive: la noche dura de 6 a 8 veces las 50 h de VIPER. Ver `informe/hallazgos_para_el_equipo.md`, hallazgo 1: los documentos decían 148 a 210 h.

## Controles de la búsqueda

Datos: reales.

- Recorte de Mons Mouton: puesto 1 (primero en 100.0 % de los pesos de robustez)
- Copias con ruido: puestos 2, 6, 18
- Control negativo: CTRL-MEDANOS → incompatible
- Confiable: True
- Redundancia pendiente y luz (H1b): ρ = 0,756 con 40 parcelas (meta ρ < 0,9)

## Fuentes de los cálculos

- Efemérides y kernels (NAIF, JPL):
  - `naif_de421.bsp` · SHA-256 `a20a7139da04cbc462454634918e9a9ca69127044e2cc9d4f9c16e238d2deedc`
  - `naif_moon_080317.tf` · SHA-256 `78732477b96f9863e7b0d65bcee3c22b8707ca5ed0db56d1173319cb2e8c7993`
  - `naif_pck00008.tpc` · SHA-256 `ca07df56e9f1bca85a4c6748b618a46c0bf8e081f96f81e324896f2fdc54ea27`
  - `naif_moon_pa_de421_1900-2050.bpc` · SHA-256 `656f90616403d75a75f0cd6c8830fc5b44f8cb4facb5ccb8915e752b397520cf`
- JPL Horizons API, consultas del 7/11/2026 y del 14/11/2026 en `motor/sol/referencia_horizons/`.

