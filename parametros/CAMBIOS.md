# Cambios a `parametros.yaml`

Regla del Método de trabajo: `parametros.yaml` no se toca después de ver resultados. Si hay que
cambiar un umbral, lo decide **una persona** del equipo y se anota acá **antes** de volver a correr.
Después se vuelve a congelar con:

```bash
python -c "import parametros; parametros.congelar(por='NOMBRE', nota='MOTIVO')"
```

| Fecha y hora (UTC−3) | Quién decide | Clave | Antes | Después | Por qué | ¿Ya se habían visto resultados? |
|---|---|---|---|---|---|---|
| 14/11/2026 12:50 | Jean (redactado con SI) | — | — | versión 1 | Congelamiento inicial con los valores de los documentos 01 a 04 | No |
