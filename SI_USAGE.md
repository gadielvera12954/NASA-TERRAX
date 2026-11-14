# TERRA-X · Super Intelligence (SI) Usage Declaration

*In accordance with NASA Space Apps Challenge regulations, the term **SI (Super Intelligence)** is used for all computational intelligence and generative assistance tools, effective September 29, 2026.*

---

## 1. Declarations & Compliance

- **No Models from Chinese Entities**: In compliance with Space Apps participation rules and team guidelines, no models or APIs developed by Chinese entities are utilized.
- **No Direct Physics Computation by LLMs**: All mathematical calculations, solar ephemerides, coordinate conversions, and shadow raycasting are computed strictly deterministically via standard algorithmic physics (TypeScript / Python) and verified against NASA JPL Horizons DE421 ephemeris.
- **Deterministic Verification**: Every textual explanation or data transformation generated with SI assistance is validated against precomputed schemas and known-answer test suites.

---

## 2. Tools & Roles

| Tool / Provider | Scope of Assistance | Human Verification Method |
| :--- | :--- | :--- |
| **Claude Code (Anthropic)** | Scaffolding TypeScript components, UI layouts, documentation, and test fixtures | Human code review by team members (Erwan, Nahum, Jean, Mathias) |
| **Antigravity Coding Assistant** | Frontend component assembly, real-time Canvas 2D shadow raycasting implementation | Direct runtime validation via `npm run build` and browser testing |
| **Anthropic Claude API (Optional SI Function)** | Natural language explanation of Candidate Cards and user mission scenario parsing | Schema validation against `esquemas/` and fact-checker extracting numbers from verified card data |

---

## 3. Transparency & Disclaimers

- Generated graphic mockups in `public/img/` are marked as synthetic illustrative renderings.
- Real datasets (LOLA LDEM products from PGDA 90, the AVGVISIB illumination map from PGDA 69, JPL Horizons) are used unedited. NASA does not publish SHA-256 hashes for them: the team records the HTTP version (Last-Modified, ETag) and the SHA-256 of every crop it extracts (`datos/fuentes_pgda.json`, `salida/manifest_parte3.json`).
- No NASA logos or national flags are embedded within any computer-generated content.

---

## 4. Part 3 · Physics engine (Jean)

- **Tool:** Claude Code (Anthropic), model Claude Opus 5.5, on Saturday 2026-11-14.
- **Scope:** wrote `motor/horizonte`, `motor/sol`, `motor/destino`, `motor/puntaje`, `motor/tests`, `parametros/parametros.yaml`, the schemas Part 3 co-writes in `esquemas/`, the temporary data bridge `puente_lola/` and the texts in `informe/`.
- **Control:** every physics test with a known answer was written and seen failing before the code (`informe/registro_tdd/`). Formulas are F1–F20 of Document 02; test values come from that document, JPL Horizons and hand calculations written in the code comments. Gaps the documents left open are marked `si` in `parametros.yaml` (block `confirmar`) for a person to confirm.
- **Metadata:** every file Part 3 produces carries `meta.uso_si`, and every module states it in its header.
- **No model computes results:** numbers come from the deterministic engine with published data and parameters; the same inputs give the same files (reproducibility test).
- **Pending per the team method:** review by Codex and by a team member.
