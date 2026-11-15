# Bilingual MVP

## Integration with main

The merge keeps Nahum's bilingual shell as the default entry and preserves its CSS, language context, Sun controls, tour and offline behavior. `src/datos/integration.ts` accepts the legacy mock shape and the current engine exports, normalizing copies for presentation. It reads the candidate index, supports each candidate/control including null compatibility, and downloads the original JSON unchanged. Verification reads `pruebas.json` in both languages. The original upstream App is preserved separately in `src/sistema/TeamApp.tsx` with only relative imports adjusted, and built as `/team.html`; its existing specialist features and limitations remain accessible through Guide. All engine modules, schemas, specialist components and scientific exports match upstream main.

The additional integration browser checks open all indexed cards, compare displayed compatibility to the source, verify original downloads and all 31 recorded hashes, and open Destination in the preserved team workspace. The original six MVP scenarios continue to run with their original explicitly mock fixtures. The historical scope notes below describe the initial MVP before integration.

Run `npm install` then `npm run dev`. For offline support use `npm run build` and `npm run preview` (localhost or HTTPS).

The default language is English. English/Spanish selection persists locally. Four main sections lead from an introduction to the available candidate, its limitations and the source registry. Direct hash links and browser back/forward work. The optional six-step tour lasts 90 seconds, supports pause/exit, and starts paused when reduced motion is requested.

The current MVP consumes the existing `manifest.json` and `fichas/P-07.json`; it validates their shape and numeric ranges before rendering. It does not edit the exporter's files or add invented candidates. Scientific test results and source hashes are explicitly unverified. The practice goal explains suitability limits; it does not rerank or recompute scores. Source JSON export and browser print-to-PDF are available.

The comparison uses synthetic illustrative images, a keyboard-accessible divider and the existing Sun provider for panel shadows. It does not claim terrain simulation or shadow-coverage measurements. Existing specialist screens and Erwan's modules remain in the repository; the MVP presents a simpler bilingual shell pending validated data integration.

Production builds generate a content-versioned service worker that precaches the local app, data and images. Wait for the offline-ready message before disconnecting. Remote fonts and external pages are optional and are not cached. Deployment currently assumes the root of a domain (Vercel); a GitHub Pages subdirectory needs base-path support.

## 3D lab, Two Worlds and comparator

The shell now has a seventh view, `#lab`, and the Home and Compare views are interactive 3D scenes (three.js, loaded on demand; the models come from `modelos/construir_modelos.py`). `src/datos/laboratorio.ts` talks to the optional live engine (`/api`, see `servidor/LEEME.md`) and, when it is not reachable, runs the same formulas in the browser over `horizontes.bin` and `/laboratorio/sol_*.json`. The page states which path produced each result. The Compare view keeps its divider and adds live readouts plus a side-by-side comparator of exported cards, which lays out their values without rescoring them. The Guide adds a field kit for the shadow measurement. If WebGL is missing, the 3D views fall back to the previous illustrative images.

Scroll wheel and vertical swipes are left to the page; the 3D views zoom with their + / − buttons. The six-step tour is unchanged and does not include the lab.

## Validation

`tests/lab.spec.ts` cuts `/api` and checks that the lab computes in the browser within 5 % of the exported engine card, that parking with the keyboard fields and changing season work, the Two Worlds readouts, the field kit geometry, automated WCAG A/AA scans of the lab and comparator in Spanish, and that these views fit a 375 px phone.


`npm run test:e2e` builds and previews the production app (or reuses a running preview), then checks bilingual navigation, language persistence, candidate download, empty search, mobile width, keyboard access, comparison, the complete 90-second tour, reduced-motion behavior, invalid-file recovery and offline reload. It also scans all six Spanish views for automated WCAG A/AA violations with axe; this is not a substitute for manual accessibility review. Microsoft Edge is used by default; set `PLAYWRIGHT_CHANNEL=chrome` for Chrome, or install another supported browser and update the configuration.

## Remaining team integration

- Mathias: final schemas, candidate index, scientific test export, reproducible source files and validated hashes.
- Jean: measured/validated scientific results and real candidate calculations.
- Erwan: integrate the bilingual shell with validated destination maps and the physical Two Worlds engine.
- Team: review, CI, deployment and public URL. No deployment or merge is performed by this local change.
