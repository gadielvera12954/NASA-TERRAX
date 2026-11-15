# TERRA-X · Earth Analogs for Lunar South Pole Operations

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![NASA Space Apps 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-critical.svg)](https://www.spaceappschallenge.org/)

**TERRA-X** is an open-access web application and scientific engine that answers a critical operational question for the Artemis era:

> **Where on Earth can we faithfully rehearse a solar-powered lunar south pole base operation, what conditions transfer directly, what does not, and what must be measured first on the ground?**

Built from scratch during the NASA Space Apps Challenge 2026 (Ciudad del Este local event).

---

## Current frontend MVP

The current MVP provides a simplified English/Spanish interface, a candidate search and card loaded from JSON, a source/verification registry, an illustrative Earth/Moon comparison, an optional 90-second tour, JSON download and browser print-to-PDF. It supports keyboard navigation, mobile layouts and offline use after the first complete production visit. English is the default; the language selection is saved locally.

The bilingual MVP adapts the current physics-engine exports without changing their source files. Earth candidates remain **mock data**; the lunar products include real data, and the verification section reads the exported report with pending tests explicitly shown. The comparison images are synthetic illustrations, not validated terrain simulations. The original main interface is preserved at `/team.html` (specialist workspace, English), reachable from Guide. This is not a claim of complete scientific validation.

See [web/MVP.md](web/MVP.md) for scope, remaining team integration and browser checks. Run `npm run test:e2e` inside `web/` to run the MVP browser suite (Microsoft Edge by default).

## Interactive 3D lab and live engine

The main interface is no longer a set of static pages:

- **Home**: the real relief of Mons Mouton in 3D (LOLA, 60 m) with the shadows of a real lunation moving over it.
- **3D lab** (`/#lab`): click anywhere on the relief to park a solar rover, choose the season and the power it needs, and follow Sun, panel power and battery hour by hour. Hovering the charts moves the Sun in the 3D view; every attempt is kept in a list so that places can be compared.
- **Two worlds** (`/#compare`): the same rover and the same 0.50 m board under the same Sun angle on the Moon and on Earth, with live readouts for shadow length (F14, F15, F19), panel power (F4), a gravity drop test and the time a grazing Sun lasts.
- **Candidate comparator** (`/#compare`): up to three exported candidates or controls side by side, property by property.
- **Field kit** (`/#guide`): type a measured shadow and check it against the Sun model.

The 3D models (generic solar rover, calibration board, Mons Mouton relief) are built in Blender by one reproducible script: see [modelos/LEEME.md](modelos/LEEME.md). The rover is a generic shape with public VIPER dimensions, not an official model. There is no Earth terrain in 3D yet, because the NASADEM grids of the candidates have not been delivered.

The lab has two calculation paths and always says which one answered:

| | Live engine (`servidor/`, optional) | Browser (always available, offline too) |
|---|---|---|
| What runs | the Python code of `motor/` at that moment | the same formulas F3–F7 in TypeScript over the exported files |
| Horizon of the point | 360 azimuths, ray-cast over LOLA relief out to 300 km | 72 azimuths from `horizontes.bin` |
| Dates | any date from 1901 to 2049 | the two exported lunations of 2027 |

```bash
python -m pip install -r requirements-motor.txt -r servidor/requirements.txt
python -m servidor
```

Then start the web as usual; Vite forwards `/api` to the engine. Details and endpoints in [servidor/LEEME.md](servidor/LEEME.md). For the centre of Mons Mouton the live answer is identical to the exported card (`servidor/tests`), and the browser path is within 5 % of it (`web/tests/lab.spec.ts`).

## Target Capabilities & Scientific Design

1. **Grazing Sun Optical Engine (`web/src/luz`)**:
   At the lunar south pole (Mons Mouton, 84.60°S, 31.00°E), the Sun never rises above 7.0° elevation. TERRA-X models real grazing shadow geometry where shadow length equals:
   $$\text{Length} = \frac{h}{\tan(\text{elevation})}$$
   Panels cast physical shadows dynamically updated across the entire interface. On the Moon, shadows have razor-sharp vacuum edges (0 px blur); on Earth, atmospheric penumbral diffusion is applied.

2. **Comparative Two Worlds Canvas (`web/src/pantallas/dos-mundos`)**:
   A unified raycasting engine comparing the Moon (Mons Mouton, LOLA DEM from PGDA 90 on a 60 m grid) and Earth (Payunia, Mendoza; NASADEM at 60 m once `motor/huella` delivers it). An interactive yellow curtain splits the screen, showing shadow coverage calculated with the exact same physics code.

3. **Safe-Haven Duration Mapping (`web/src/pantallas/destination`)**:
   Identifies safe havens where uninterrupted darkness does not exceed the VIPER 50-hour battery survival envelope during both summer and winter lunar seasons. On a flat horizon the night at Mons Mouton lasts 289–418 h per lunation (2027), 6 to 8 times that limit: only relief can save a parked rover.

4. **90-Second Guided Tour for Judges (`web/src/recorrido`)**:
   An automated, timed, six-stage narrative walking through the scientific challenge, safe havens, candidate scanning, comparative parity, analog card metrics, and open verification tests.

5. **Strict Data Contract & Open Verification**:
   - Zero databases, zero user accounts.
   - 100% reproducible with SHA-256 hashes for all inputs and precomputed datasets.
   - Transparent test suite reporting synthetic benchmarks and real-world field shadow calibrations.

---

## Repository Structure

```
terra-x/
├─ README.md                  # Project overview, run instructions, and specifications
├─ LICENSE                    # Apache-2.0 open-source license
├─ THIRD_PARTY_NOTICES.md     # Notices and attributions for NASA and USGS data
├─ SI_USAGE.md                # Super Intelligence (SI) usage declaration
├─ CLAUDE.md, AGENTS.md       # AI assistant guidelines and scientific constraints
├─ web/                       # Vite + React + TypeScript frontend
│  ├─ src/
│  │  ├─ luz/                 # SolContext, BarraHorizonte, TerrainShadowCanvas (Erwan)
│  │  ├─ graficos/            # FranjaLimites, PerfilHorizonte, RecorridoSolLunacion (Erwan)
│  │  ├─ recorrido/           # 90-second guided jury tour (Erwan)
│  │  ├─ pantallas/
│  │  │  ├─ destination/      # Safe-haven map and lunar survival telemetry (Erwan)
│  │  │  ├─ dos-mundos/       # Flagship split-curtain comparative screen (Erwan)
│  │  │  ├─ mission/          # Landing hook & challenge overview
│  │  │  ├─ search/           # Candidate scanning & control verification
│  │  │  ├─ ficha/            # Open Analog Card P-07
│  │  │  ├─ field/            # Sunset ground shadow calibration kit
│  │  │  ├─ learn/            # Yvy ha Jasy (Spanish & Jopara)
│  │  │  ├─ tests/            # Open verification test report
│  │  │  └─ data/             # Sources, hashes & licenses registry
│  │  └─ sistema/             # tokens.css (Instrument design tokens, 2px radius, 1px lines)
│  └─ public/
│     ├─ data/                # Precomputed contract data, ephemerides, candidate cards
│     └─ img/                 # High-fidelity relief and mission visuals
```

---

## Quick Start & Running Locally

### Prerequisites

- Node.js 18+ (tested on Node v24.15)
- npm 9+

### Installation & Development

```bash
cd web
npm install
npm run dev
```

Open your browser at `http://localhost:3000`.

### Production Build

```bash
cd web
npm run build
npm run preview
```

---

## Physics Engine (Part 3, `motor/`)

Python engine that computes every number the app shows: horizons with curvature (F2), the Sun with Skyfield/DE421 checked against JPL Horizons, rover power and battery (F3–F7), the safe-haven map (F20) and analog scoring (F10–F12, F18). Details in `PARTE3_JEAN.md`.

```bash
python -m pip install -r requirements-motor.txt
python -m pytest
python -m motor.tests.cierre
```

Real LOLA relief (temporary bridge until `motor/ingest` and `motor/escala` exist):

```bash
python -m pip install rasterio
python -m puente_lola.bajar
python -m motor.destino real --objetivo datos/grillas/mons_mouton_60m --capas datos/grillas/mons_mouton_margen_60m datos/grillas/mons_mouton_lejano_240m
python -m puente_lola.exportar_web
```

## Scientific Data Sources

- **JPL Horizons API v1.2**: Sun position control for Mons Mouton (`84.60°S, 31.00°E`, official IAU center), the IM-2 site and Earth sites (queried Nov 7 and Nov 14, 2026). The engine computes the Sun with Skyfield and the DE421 ephemeris in the MOON_ME_DE421 frame and agrees with Horizons to 0.00001° on the Moon.
- **NASADEM Global DEM V001**: NASA EOSDIS Land Processes DAAC (1 arc-second reprojected to 60m UTM).
- **LOLA south pole DEMs (PGDA 90, Barker et al. 2023)**: `LDEM_80S_20MPP_ADJ` (20 m, averaged to 60 m), `LDEM_60S_60MPP_ADJ` and `LDEM_60S_240MPP_ADJ` for far relief up to ~300 km.
- **Lunar polar illumination (PGDA 69, Mazarico et al. 2011)**: `AVGVISIB_85S_060M_201608`, average solar-disc visibility over 18.6 years, used to validate the engine (F13).

---

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
