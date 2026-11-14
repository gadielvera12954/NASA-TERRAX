"""motor/escala: lleva cada relieve a la escala común de 60 m sin inventar detalle. Dueño: Mathias (Parte 4).

* `bloques.promedio`: 20 m -> 60 m en la Luna, promedio exacto de bloques enteros (sin interpolar).
* `reproyectar.a_utm`: modelos de la Tierra en grilla geográfica (1 segundo de arco) -> UTM a 60 m
  con remuestreo por PROMEDIO, en una grilla alineada a múltiplos de 60 m.

Nunca se pasa una grilla a una malla más fina (documento 02, sección 2.3). La salida cumple el
contrato de esquemas/grilla_entrada.md.

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from . import bloques

__all__ = ["bloques"]
