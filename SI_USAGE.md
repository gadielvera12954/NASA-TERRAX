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
| **Codex (OpenAI)** | Bilingual field atlas, terrain-based rebranding, persistent dark/light appearance, candidate-file loading and validation, accessibility, offline caching, and integration with the existing Community, accounts and SI guide | Production build and browser workflow checks; team review before merge |
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

## 5. Part 4 · Scale and terrain footprint (Mathias)

- **Tool:** Claude Code (Anthropic), model Claude Opus 5.5, on Saturday 2026-11-14.
- **Scope:** wrote `motor/escala` (exact 3 × 3 block averaging; geographic → UTM reprojection at 60 m with average resampling), `motor/huella` (F8 Horn slope, F9 circular-window roughness, F16 grazing-light response, 101-quantile distributions) and the tests `motor/tests/test_parte4_*.py`.
- **Control:** known-answer tests (tilted plane, plane plus white noise, constant horizon, constant and planar fields through reprojection) were written before the code and run red first. One failure exposed a real bug (a cell with no elevation received a slope) and was fixed in the code, not in the test.
- **Metadata:** every Part 4 module states SI use in its header; commits carry a co-author trailer.
- **Pending per the team method:** review by Codex and by a team member.

## 6. 3D lab, Blender models and live engine server

- **Tool:** Claude Code (Anthropic), on Saturday 2026-11-14.
- **Scope:** wrote `modelos/construir_modelos.py` (Blender models), `servidor/` (HTTP wrapper around `motor/`), `web/src/escena3d`, `web/src/pantallas/operacion`, `web/src/pantallas/field/SombraCampo.tsx`, `web/src/datos/laboratorio.ts`, `web/src/sistema/lab.css`, and wired them into `web/src/sistema/MvpApp.tsx`.
- **Control:** the server answer for the centre of Mons Mouton must equal the exported destination card (`servidor/tests`); the browser calculation must stay within 5 % of it (`web/tests/lab.spec.ts`); the existing browser suite, including the automated accessibility scan, still passes.
- **No model computes results:** the server only calls the deterministic engine; the browser repeats formulas F3–F7 over the exported files. Illustrative elements (ground and sky colours of the Two Worlds stage, the generic rover shape) are labelled as such on screen.
- **Pending:** the Codex and human review that the team method requires.

## 7. SI Guide Chatbot (`web/src/si/`)

- **Tool / Model:** Google Gemini API, model `gemini-3.5-flash` (fixed; no model picker), with deterministic offline fallback (`respuestaDeterministaSI`). The console code was written with Gemini on 2026-11-15 and later restyled with Claude Code.
- **Scope:** Natural-language explanation of the active Candidate Card (`C`, `E`, `[L, U]`), Mons Mouton lunar destination, and non-transferable limits on the web interface.
- **Control (`verificadorSI.ts`):** Every response generated by Gemini is checked by `verificarRespuestaSI` against the numbers in the active card and frozen mission parameters (`parametros.yaml`). Any response containing unverified numbers or prohibited global similarity claims (`% similar to the Moon/Mars`) is automatically blocked and replaced by the verified deterministic explanation.

## 8. Web redesign (`web/src/sistema/tokens.css`, `mvp.css`, `lab.css`, `MvpApp.tsx` home)

- **Tool:** Claude Code (Anthropic), on Sunday 2026-11-15.
- **Scope:** the "Meridian Wall" visual system of the public app: light plaster ground with basalt plates for everything lunar, self-hosted fonts, the shadow nomogram on the home page (a 0.50 m board, shadow = 0.50 / tan(Sun elevation)) and the drawn verdict marks. The team workspace (`team.html`) keeps the original instrument theme in `tokens-equipo.css`.
- **No model computes results:** every number shown comes from the exported files or from the formulas already in the app; the nomogram only re-plots `height / tan(elevation)`.
- **Pending:** human review of copy and contrast by the team before the final submission.
## 9. Accounts, Community and admin panel (`servidor/cuentas.py`, `web/src/pantallas/comunidad`)

- **Tool:** Claude Code (Anthropic), on Sunday 2026-11-15.
- **Scope:** sign-up and sign-in, author verification by admins, outreach articles with admin review, the admin panel and its audit log; all of it in the optional local server, stored in a git-ignored SQLite file.
- **Control:** `servidor/tests/test_cuentas.py` covers password hashing, sign-in throttling, the CSRF header, role permissions, the verify → write → review → publish circuit and the audit log.
- **No model writes or approves content:** articles are written by people and published by people; the SI console does not read or write them.