"""motor/horizonte — horizonte por píxel y azimut con curvatura y margen (F2). Dueño: Jean.

Entra una grilla (y sus capas de margen) → sale la máscara de 72 azimutes (horizontes.bin).
Es el camino crítico del proyecto: la Puerta Horizonte (sábado 18:00) exige que pasen las pruebas
de poste sobre plano y de esfera perfecta.

Uso de SI: redactado con Claude Code a partir del documento 02.
"""
from . import formato, geometria
from .nucleo import (Capa, azimutes, calcular_horizontes, calcular_horizontes_puntos, horizonte_en_azimut,
                     sombra_mapa)

__all__ = [
    "Capa", "azimutes", "calcular_horizontes", "calcular_horizontes_puntos", "horizonte_en_azimut",
    "sombra_mapa", "formato", "geometria",
]
