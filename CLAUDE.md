# TERRA-X · Guidelines for Coding Agents (Claude Code / Codex)

## Core Principles
1. **Never Invent Data**: All numbers must originate from official NASA/JPL ephemeris or verifiable formulas from Document 02 (`doc02_ciencia.py`).
2. **Never Downsample Without Documentation**: Grids are standardized at 60m resolution without downward interpolation.
3. **Strict Ownership Boundaries**:
   - `web/src/luz`, `web/src/graficos`, `web/src/recorrido`, `web/src/pantallas/{destination, dos-mundos}`: Owned by Erwan.
   - `web/src/sistema`, `web/src/datos`, `web/src/i18n`, `web/src/pantallas/{mission, operacion, search, ficha, tests, data, field, learn}`: Owned by Nahum.
   - `motor/horizonte`, `motor/sol`, `motor/destino`, `motor/puntaje`: Owned by Jean.
   - `motor/ingest`, `motor/escala`, `motor/huella`, `motor/exportar`, `esquemas/`, `api/`: Owned by Mathias.
4. **Visual Rules**:
   - No generic component kits (Tailwind, shadcn, Bootstrap).
   - 2px corners (`border-radius: 2px`), 1px borders (`border: 1px solid`).
   - Instrument typography (Fira Sans, Overpass, Overpass Mono).
   - Primary background `#07173F`, single accent `#E7F434` (grazing Sun).
   - Physical dynamic shadows cast via `--sombra-x`, `--sombra-y` derived from `--sol-el` and `--sol-az`.
5. **Language**: English by default. In NASA-facing documents, write "SI" (Super Intelligence), not "AI".
