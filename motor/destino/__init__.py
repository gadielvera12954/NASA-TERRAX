"""motor/destino — paneles, batería, condiciones críticas y mapa de refugios (F3 a F7, F20). Dueño: Jean.

Máscara de horizontes y escenario → ficha del destino, mapas de refugios y archivo de paridad.

Uso de SI: redactado con Claude Code a partir del documento 02.
"""
from . import energia, paridad, png16, refugios, simulacion

__all__ = ["energia", "paridad", "png16", "refugios", "simulacion"]
