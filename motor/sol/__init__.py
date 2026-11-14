"""motor/sol — posición del Sol con Skyfield y DE421, control contra JPL Horizons y refracción (F15).

Fecha y lugar → azimut y altura. Dueño: Jean.

Uso de SI: redactado con Claude Code a partir del documento 02.
"""
from . import efemerides, horizons, lunacion, posicion, refraccion, ventanas

__all__ = ["efemerides", "horizons", "lunacion", "posicion", "refraccion", "ventanas"]
