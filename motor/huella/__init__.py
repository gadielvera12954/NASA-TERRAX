"""motor/huella: huella de terreno de la Luna y de cada parcela (F8, F9, F16). Dueño: Mathias (Parte 4).

* `pendiente.horn`: pendiente por celda con su vecindad de 3 x 3 (F8, Horn 1981).
* `rugosidad.rugosidad`: dispersión respecto del plano ajustado en una ventana circular (F9).
* `luz.f_media`: fracción del terreno en sombra promediada en azimut, f̄(e) (F16).
* `distribucion.cuantiles`: 101 cuantiles, la forma que pide esquemas/distribuciones.schema.json.

Salida: distribuciones_<region>.json para motor/puntaje (Jean).

Uso de SI: redactado con Claude Code para la Parte 4; revisión humana pendiente.
"""
from . import distribucion, luz, pendiente, rugosidad

__all__ = ["distribucion", "luz", "pendiente", "rugosidad"]
