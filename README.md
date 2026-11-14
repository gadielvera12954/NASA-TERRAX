# TERRA-X · Earth Analogs for Lunar South Pole Operations

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![NASA Space Apps 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-critical.svg)](https://www.spaceappschallenge.org/)

**TERRA-X** is an open-access web application and scientific engine that answers a critical operational question for the Artemis era:

> **Where on Earth can we faithfully rehearse a solar-powered lunar south pole base operation, what conditions transfer directly, what does not, and what must be measured first on the ground?**

Built from scratch during the NASA Space Apps Challenge 2026 (Ciudad del Este local event).

---

## Current frontend MVP

The current MVP provides a simplified English/Spanish interface, a candidate search and card loaded from JSON, a source/verification registry, an illustrative Earth/Moon comparison, an optional 90-second tour, JSON download and browser print-to-PDF. It supports keyboard navigation, mobile layouts and offline use after the first complete production visit. English is the default; the language selection is saved locally.

The available candidate and manifest are **mock data**. Scientific tests and declared source hashes have **not** been verified by this frontend. The comparison images are synthetic illustrations, not validated terrain simulations. The capabilities below describe the scientific design and specialist modules; they are not a claim that the integrated MVP has completed scientific validation.

See [web/MVP.md](web/MVP.md) for scope, remaining team integration and browser checks. Run `npm run test:e2e` inside `web/` to run the MVP browser suite (Microsoft Edge by default).

## Target Capabilities & Scientific Design

1. **Grazing Sun Optical Engine (`web/src/luz`)**:
   At the lunar south pole (e.g., Mons Mouton, 85.5°S), the Sun never rises above 7.0° elevation. TERRA-X models real grazing shadow geometry where shadow length equals:
   $$\text{Length} = \frac{h}{\tan(\text{elevation})}$$
   Panels cast physical shadows dynamically updated across the entire interface. On the Moon, shadows have razor-sharp vacuum edges (0 px blur); on Earth, atmospheric penumbral diffusion is applied.

2. **Comparative Two Worlds Canvas (`web/src/pantallas/dos-mundos`)**:
   A unified raycasting engine comparing the Moon (Mons Mouton LOLA 5m DEM) and Earth (Payunia P-07 volcanic field, Mendoza, NASADEM 60m). An interactive yellow curtain splits the screen, showing shadow coverage calculated with the exact same physics code.

3. **Safe-Haven Duration Mapping (`web/src/pantallas/destination`)**:
   Identifies safe havens where uninterrupted darkness does not exceed the VIPER 50-hour battery survival envelope during both summer and winter lunar seasons.

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

## Scientific Data Sources

- **JPL Horizons Ephemeris v1.2**: DE421 ephemeris calculations for Mons Mouton (`85.5°S, 31.4°E`) and Payunia (`36.4°S, 69.2°W`).
- **NASADEM Global DEM V001**: NASA EOSDIS Land Processes DAAC (1 arc-second reprojected to 60m UTM).
- **LOLA / Kaguya Merged Polar DEM (pgda78)**: USGS Astrogeology / NASA PDS Geosciences Node (5m polar stereographic).

---

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
