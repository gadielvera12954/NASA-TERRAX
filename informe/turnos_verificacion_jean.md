# Turnos de verificación de Jean

Mathias es el verificador principal; Jean lo releva cuando Mathias tiene el camino crítico. Cada
verificación: actualizar `main`, abrir Claude Code en la raíz, pegar el pedido fijo del Método de
trabajo, publicar el informe como Issue «Verificación» con la hora y el estado en la primera línea,
un Issue por falla al dueño de la carpeta, y volver al trabajo propio. Máximo 20 minutos (30 en las
puertas). Un control sin comprobar se informa como sin comprobar, nunca como aprobado.

| Hora | Quién | Foco del control | Qué mirar de la Parte 3 |
|---|---|---|---|
| Sáb 18:00 · Puerta Horizonte | Mathias verifica, Jean presenta | Poste y esfera pasan; seguir o cambiar a HORAYZON | `informe/puerta_horizonte.md` |
| **Sáb 21:00** | **Jean** | Sol contra Horizons, exportador, sombras en el navegador | `python -m motor.sol control`; que `destino/horizontes.bin` llegue intacto a `web/public/data` (mismo SHA-256 que `salida/manifest_parte3.json`) |
| **Dom 0:00** | **Jean** | Datos reales entrando a la web, contrato sin cambios rotos | Validar todo `web/public/data` contra `esquemas/`; que ningún archivo real lleve `"maqueta": true` |
| Dom 2:00 · Puerta 1 | Los dos, 30 min | Recorrido completo con datos reales; ¿se corta el 3D y la función SI? | Ficha del destino con datos reales (`python -m motor.destino real ...`) |
| **Dom 12:00** | **Jean** | Puntaje y controles, modo sin conexión | `salida/fichas/indice.json`: controles con `confiable: true`; la app anda en modo avión |
| Dom 18:00 · Puerta 2 | Los dos, 30 min | Congelamiento: todo el checklist de entrega | `python -m motor.tests.validacion` y la pantalla Tests con todas las pruebas, también las que fallan |

Pedido fijo (copiar tal cual del Método de trabajo, página 16), cerrar con VERDE, AMARILLO o ROJO.
