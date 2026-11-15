# TERRA-X field atlas

Run `npm ci` and `npm run dev` in `web/`. For the offline build, run `npm run build` followed by `npm run preview`. Open the printed localhost address and wait for “Saved for offline use” in the footer before disconnecting. The service worker caches the local fonts, terrain plate, models, code and scientific exports. Deployments currently use the domain root.

## Navigation and reading order

| View | Primary task |
| --- | --- |
| `#home` | Understand the purpose, inspect the lunar reference map and open the terrestrial catalogue. The 3D scene and timed tour start on request. |
| `#explore` | Search the full candidate index. Terrestrial records and scientific reference controls have separate lists. |
| `?candidate=P-07#card` | Read the exported verdict, evidence, limits, measurement priorities and dated rehearsal windows. Download the source record or print the sheet. |
| `#compare` | Read up to three named records together. The practice goal highlights a dimension. Detailed property scores, requirements, bounds and grazing-light curves follow the summary. |
| `#worlds` | Select shadows, energy, gravity or time. Read the results before opening the illustrative 3D curtain. |
| `#guide` | Learn the method and use the field shadow kit. |
| `#checks` | Inspect the test report, pending results, source registry and available hashes. |
| `#lab` | Examine a rover scenario at a grid point on Mons Mouton. Use the terrain or enter a row and column. |

The query parameters `candidate`, `goal` and `sites` carry the record, reading goal and comparison slots. Hash links keep those parameters. English is the default. English and Spanish are available throughout the atlas and the chosen language persists locally. The original English specialist workspace is accessible from How it works at `/team.html`.

## Design

The identity uses a contour-line mark and a map of the actual lunar reference site. The first screen pairs a left-aligned introduction with the terrain plate. Below it, a compact site list opens individual records and a smaller tools list leads to the lab and Earth/Moon experiments. On a phone the introduction, plate and lists follow in that order.

`src/sistema/tokens.css` defines the palette, typography, spacing, corners and semantic colors. The default dark theme uses #101C22 for the page, #18272E for surfaces, #E4EDF1 for text, #A7B9C3 for secondary text and #80CBD1 for teal actions. The header appearance button switches to the light palette with #F3F6F8 paper, white surfaces, #172B35 text and #176B78 actions. The selected theme is saved locally and shared with the specialist workspace. It is applied before the interface loads and remains available offline. Print uses the light palette. Solar annotations, status labels and chart series have theme-specific accessible colors. Use labels and symbols with verdict colors and letter labels with comparison series. IBM Plex Sans is bundled locally under the SIL Open Font License. Technical numbers use IBM Plex Mono where installed and a local monospace fallback elsewhere.

Solar controls belong with their visualization. The main interface uses ordinary document scrolling. Numerical readouts, the hashed source files and the parameters of the physical models remain authoritative.

### Terrain plate

`public/img/mons-mouton-atlas.webp` is a static cartographic rendering of the existing NASA LOLA export. Shading comes from the supplied 60 m normal map, using a fixed map light. Elevation contours at 100 m intervals come from the existing 120 m display mesh in `mons_mouton.glb`, restoring the exported vertical offset in `modelos.json`. The plate is a central 30 km × 17.5 km crop in projected coordinates with a 3 km scale. Values in the simulation continue to use their original scientific inputs. The cartographic illumination is independent of the ephemeris-driven shadow view.

### Data status

The terrestrial catalogue currently contains demonstration records. The reference controls check the method. LOLA relief, JPL solar series and live or browser computations have their own provenance. Earth/Moon uses a flat illustrative stage. C describes fit over known properties. E is the weighted evidence coverage. L–U are model bounds. A missing C is shown as unknown. Changing the reading goal leaves exported scores intact.

## Review

The before screenshots in `../output/playwright/rebranding/` record the initial state. The global mock banner appeared on the LOLA view, the solar bar occupied the bottom of every view, the search only checked the selected candidate and the comparator followed the Earth/Moon experiment. Confusing a control with a field site or mistaking evidence coverage for certainty were usability hypotheses. This project review did not involve participant testing.

Run `npm run test:e2e` in `web/` for the integrated browser suite. It uses local Edge by default. Set `PLAYWRIGHT_CHANNEL=chrome` to select Chrome and `PLAYWRIGHT_PORT` to choose an isolated preview port. The suite covers legacy and current records, original JSON downloads, verification hashes, selection history, language, the tour, failure recovery, accessibility checks and offline scenarios.

The original project design PDFs and their source material in `web/docs/` describe earlier proposals. This document and the shared tokens describe the implemented atlas.
