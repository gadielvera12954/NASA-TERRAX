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
| **Codex (OpenAI)** | Bilingual MVP navigation, candidate-file loading and validation, accessibility, offline caching, and clearer descriptions of mock data and unverified results | Production build and browser workflow checks; team review before merge |
| **Claude Code (Anthropic)** | Scaffolding TypeScript components, UI layouts, documentation, and test fixtures | Human code review by team members (Erwan, Nahum, Jean, Mathias) |
| **Antigravity Coding Assistant** | Frontend component assembly, real-time Canvas 2D shadow raycasting implementation | Direct runtime validation via `npm run build` and browser testing |
| **Anthropic Claude API (Optional SI Function)** | Natural language explanation of Candidate Cards and user mission scenario parsing | Schema validation against `esquemas/` and fact-checker extracting numbers from verified card data |

---

## 3. Transparency & Disclaimers

- Generated graphic mockups in `public/img/` are marked as synthetic illustrative renderings.
- Real empirical datasets (NASADEM 60m, LOLA 5m, JPL Horizons) are unedited and verified against public NASA SHA-256 integrity hashes.
- No NASA logos or national flags are embedded within any computer-generated content.
