# TERRA-X · Practice on Earth. Prepare for the Moon.

[![CI](https://github.com/gadielvera12954/NASA-TERRAX/actions/workflows/ci.yml/badge.svg)](https://github.com/gadielvera12954/NASA-TERRAX/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![NASA Space Apps 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-critical.svg)](https://www.spaceappschallenge.org/)

**Live site:** https://nasa-terrax.vercel.app

At the lunar south pole the Sun never climbs more than about 7° above the horizon. Every hill throws a shadow kilometres long, a parked rover can spend hundreds of hours in the dark, and a mission that was not rehearsed under those conditions is a mission rehearsed for a different place. TERRA-X answers one operational question:

> **Where on Earth can a crew rehearse work planned for the lunar south pole, what transfers, what does not, and what must be measured first?**

It runs **the same physics on the same 60 m grid** for both worlds: lunar relief from NASA LOLA, Earth relief from the Copernicus DEM, the Sun from JPL ephemerides. Every candidate carries two separate numbers, compatibility and evidence, never a "% similar to the Moon", and every number on the site can be re-derived from the published files.

Built during the NASA Space Apps Challenge 2026 (Ciudad del Este, Paraguay). Everything is open: Apache-2.0 code, open NASA and Copernicus data, and a public declaration of how we used SI (`SI_USAGE.md`).

---

## Five minutes for the jury

1. **Home.** Inspect the Mons Mouton terrain plate and open the site catalogue. The 3D view and guided tour start on request. Dark is the initial appearance, and the header stores a light/dark choice.
2. **Explore and site record** (`/#explore`). Search the forty Payunia parcels. Reference controls have their own group. Read the exported verdict, compatibility C, evidence E, model bounds L–U and field measurement priorities.
3. **Compare sites** (`/#compare`). Read up to three records together. The selected practice goal highlights an existing dimension and the detailed charts follow the summary.
4. **Earth and Moon** (`/#worlds`). Study shadows, energy, gravity and time one at a time. Paired results can be read before opening the illustrative 3D curtain.
5. **Lunar terrain laboratory** (`/#lab`). Park a rover on Mons Mouton, choose a season and vehicle settings, and read Sun, power and battery by hour.
6. **Sources and verification** (`/#checks`). Inspect the scientific report, pending tests, declared sources and hashes. Re-hash every published data file in the browser.

Press **Ctrl K** anywhere for the SI console: it explains the active card in plain language, and every number it says is checked against the card before it is shown.

7. **No accounts.** The site has no sign-in and stores no personal data; the optional server only runs the live engine and relays the SI chat.

## What is real and what is illustrative

| Shown on the site | Status |
|---|---|
| Mons Mouton relief, horizons, Sun positions, night lengths, battery curves | Real: LOLA PGDA 90 at 60 m, DE421 ephemerides, formulas F2–F7 of Document 02, checked against JPL Horizons (≤ 0.00001° on the Moon) |
| The 40 Payunia parcels and the controls (C, E, L, U, slope, roughness, grazing-light factor, NDVI) | Real: Copernicus DEM GLO-30 at 60 m, Sentinel-2 L2A NDVI (annual 90th percentile), scored by `motor/puntaje` with frozen parameters |
| Positive and negative controls | Mons Mouton itself must rank first and does; three noise copies must rank in order and do; Médanos del Chaco (vegetated) must be rejected and is |
| Rover 3D model | Generic shape with public VIPER dimensions, not an official model |
| Ground and sky colours of the Earth/Moon stage | Illustrative, labelled as such on screen |
| Earth terrain in 3D | Not available yet |

Demonstration records carry a contextual label. The current terrestrial dataset declares `maqueta: false`. Consult the source of each product and the source registry.

The implemented design and navigation are documented in [web/MVP.md](web/MVP.md).

## Data sources

| Source | Used for | Access |
|---|---|---|
| **LOLA south polar DEMs**, PGDA product 90 (`LDEM_80S_20MPP_ADJ` averaged to 60 m, `LDEM_60S_60MPP_ADJ`, `LDEM_60S_240MPP_ADJ`) | Mons Mouton relief and horizons out to 300 km | NASA GSFC PGDA |
| **Average solar visibility**, PGDA product 69 (`AVGVISIB_85S_060M`, Mazarico et al. 2011) | Independent check of the illumination engine (F13) | NASA GSFC PGDA |
| **JPL Horizons API v1.2** and **DE421 / MOON_ME** NAIF kernels (via Skyfield) | Sun position on the Moon and on Earth; the Horizons queries are the control | NASA JPL |
| **Copernicus DEM GLO-30** (tiles S37_W070, S20_W062, S21_W062) | Earth relief of Payunia and Médanos del Chaco at 60 m | ESA / AWS Open Data |
| **Sentinel-2 L2A** (Earth Search STAC) | Vegetation requirement: NDVI p90 < 0.20 | ESA Copernicus / AWS Open Data |

Licences and attribution notices are in `THIRD_PARTY_NOTICES.md`; citation metadata in `CITATION.cff`. No grid is interpolated to a finer resolution than its source; coarser products are averaged, never resampled upward.

## How it is built

```
documents 01–04 (science, formulas F1–F20, frozen parameters)
        │
        ▼
motor/            Python engine, deterministic, no model in the loop
  ingest, escala  download LOLA / Copernicus / Sentinel-2, average to one 60 m grid     (Part 4)
  huella          slope F8, roughness F9, grazing-light factor F16, 40 parcels + controls (Part 4)
  horizonte, sol  horizons with curvature F2, Sun with DE421 checked against Horizons    (Part 3)
  destino         rover power and battery F3–F7, safe-haven map F20                       (Part 3)
  puntaje         compatibility C, evidence E, bounds L–U, verdicts, robustness F10–F18    (Part 3)
  exportar        copies every product to web/public/data and writes manifest.json       (Part 4)
        │
        ▼
web/public/data   64 files, each with size and SHA-256 in manifest.json
        │
        ▼
web/              Vite + React + TypeScript, no backend, works offline after one visit
servidor/         optional local HTTP wrapper around motor/ ("Live engine")
```

Two calculation paths, and the page always says which one answered:

| | Browser (always, offline too) | Live engine (`python -m servidor`, optional) |
|---|---|---|
| Horizon of a point | 72 azimuths from `horizontes.bin` | 360 azimuths ray-cast over LOLA out to 300 km |
| Dates | the two exported lunations of 2027 | any date 1901–2049 |
| Formulas | F3–F7 rewritten in TypeScript | the Python engine itself |

For the centre of Mons Mouton the live answer is identical to the exported card (`servidor/tests`), and the browser path stays within 5 % of it (`web/tests/lab.spec.ts`).

## Run it

**Web (Node 18+):**

```bash
cd web && npm install && npm run dev
```

Opens http://localhost:3000. `npm run build` produces `dist/` with an offline service worker; `npm run test:e2e` runs the browser suite (Playwright, includes an accessibility scan).

**Engine and tests (Python 3.10+):**

```bash
python -m pip install -r requirements-motor.txt -r servidor/requirements.txt
```

```bash
python -m pytest
```

```bash
python -m motor.exportar.verificar
```

The last command re-hashes the 64 published files, checks sizes, the Part 3 manifest and the frozen parameters, and exits non-zero on any mismatch. The same check runs in CI on every push and on the site under Verification.

**Live engine (optional):**

```bash
python -m servidor
```

Vite forwards `/api` to it; the web labels its answers "Live engine". Endpoints in `servidor/LEEME.md`. The real LOLA grids (`datos/`) are not in the repository; without them the server answers from `horizontes.bin` and says so.

**Rebuild the published data from scratch:**

```bash
python -m motor.huella            # Payunia parcels, controls, NDVI (needs network)
python -m motor.puntaje --distribuciones datos/distribuciones_payunia.json
python -m motor.tests.informe     # Part 3 report and manifest
python -m motor.exportar          # web/public/data + manifest.json
```

## Repository

```
motor/            physics engine (see above); motor/tests holds the known-result tests
servidor/         optional local HTTP server around the engine
esquemas/         JSON schemas and binary contracts shared by engine and web
parametros/       parametros.yaml, frozen with its SHA-256 in CONGELADO.json
web/              the site; web/public/data is the published, hashed dataset
informe/          validation report, findings for the team, field measurement sheet
modelos/          Blender script for the rover, the board and the relief mesh
demo/             slides
api/              why there are no serverless functions (design note)
PARTE3_JEAN.md, INTEGRACION_NAHUM.md, DESIGN.md, SI_USAGE.md, THIRD_PARTY_NOTICES.md, CITATION.cff
```

Ownership of each part is in `CLAUDE.md`: Part 3 (engine) Jean; Part 4 (ingest, scale, footprint, export, schemas) Mathias Pereira; web light and comparative screens Erwan; web shell and integration Nahum.

## Honesty rules we hold ourselves to

- No number is invented: everything comes from the listed data and the formulas of Document 02 with frozen parameters.
- Limits are first-class: every card lists what does not transfer; unknowns are shown as unknown.
- Tests that were not run are shown as pending, never as passed.
- SI (Super Intelligence) helped write code and text; it never computes a result. Details in `SI_USAGE.md`.

## License

Apache License 2.0, see [LICENSE](LICENSE). Data licences in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
