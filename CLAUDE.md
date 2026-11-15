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
   - Use the field atlas design documented in `web/MVP.md` and the semantic tokens in `web/src/sistema/tokens.css`.
   - Default to the dark field atlas theme with an optional persistent light theme. Use semantic colors for reading surfaces, teal actions and ochre solar annotations. Pair data colors with labels, patterns or symbols.
   - Use local IBM Plex Sans for interface text and a monospace face for technical readings.
   - Limit physical solar shadows to the scientific visualizations. Scope controls to the view they affect.
5. **Language**: English by default. In NASA-facing documents, write "SI" (Super Intelligence), not "AI".
