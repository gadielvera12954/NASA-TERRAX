"""motor/exportar: escribe en web/public/data lo que usa la app, con manifest.json. Dueño: Mathias (Parte 4).

Reemplaza a puente_lola/exportar_web.py (que era temporal): hace lo mismo y además
* integra salida/manifest_parte3.json (SHA-256 de todo lo que produce la Parte 3);
* agrega las fuentes de la Parte 4 (Copernicus GLO-30, Sentinel-2, LOLA) con versión y SHA-256;
* publica distribuciones_payunia.json (huella de terreno) para que cualquiera reproduzca el puntaje.

    python -m motor.exportar

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
