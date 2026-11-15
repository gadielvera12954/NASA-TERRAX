# Third-Party Notices & Open Data Attributions

TERRA-X incorporates and references open scientific datasets and open-source software libraries under permissible licenses.

---

## 1. Scientific Data Sources

### NASA Jet Propulsion Laboratory (JPL)
- **Dataset**: JPL Horizons On-Line Ephemeris System v1.2 (DE421)
- **License**: NASA Open Data Policy (Public Domain)
- **Usage**: Reference solar elevation, azimuth, and lunation cycle duration for Mons Mouton and Argentine analog sites.

### NASA EOSDIS Land Processes DAAC / USGS
- **Dataset**: NASADEM Merged DEM Global 1 arc second V001
- **License**: Public Domain
- **Usage**: Topographic elevation model of Payunia, Mendoza, Argentina.

### Copernicus DEM GLO-30 (European Space Agency / European Union)
- **Dataset**: Copernicus DEM GLO-30 Public, tile `Copernicus_DSM_COG_10_S37_00_W070_00_DEM`, from the AWS Open Data registry (`copernicus-dem-30m`)
- **Attribution**: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
- **License**: Copernicus DEM licence (free use with the attribution above).
- **Usage**: Payunia elevation grids (`motor/ingest/copernicus.py`) and the Earth relief mesh `web/public/modelos/payunia.glb` shown in "Earth and Moon".

### USGS Astrogeology Science Center: Mars HRSC + MOLA blended DEM
- **Dataset**: Mars MGS MOLA - MEX HRSC Blended DEM Global 200m v2 (`Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif`, https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/); only the rows around Jezero crater are read, by HTTP range
- **Credit**: USGS Astrogeology Science Center; MOLA (NASA Mars Global Surveyor) and HRSC (ESA/DLR/FU Berlin, Mars Express) science teams
- **License**: Public domain (U.S. Government work); credit requested
- **Usage**: Jezero relief mesh `web/public/modelos/marte_jezero.glb` and the Mars renders (`modelos/grilla_marte.py`, `modelos/renders.py`)

### USGS Astrogeology Science Center / NASA PDS
- **Dataset**: LOLA / Kaguya Merged DEM 5m (pgda78)
- **License**: Public Domain
- **Usage**: High-resolution digital elevation model of Mons Mouton plateau, lunar south pole.

---

## 2. Software Dependencies

### React & React DOM
- **License**: MIT
- **Copyright**: (c) Meta Platforms, Inc. and affiliates.

### Vite
- **License**: MIT
- **Copyright**: (c) 2019-present, Yuxi (Evan) You and Vite contributors.

### Lucide React
- **License**: ISC
- **Copyright**: (c) Lucide Contributors.

### NumPy · SciPy (used by `motor/escala`, `motor/huella`)
- **License**: BSD-3-Clause
- **Copyright**: (c) NumPy Developers · (c) SciPy Developers.

### rasterio (used by `motor/escala`)
- **License**: BSD-3-Clause
- **Copyright**: (c) Mapbox and rasterio contributors.

### pyproj (used by `motor/escala`)
- **License**: MIT
- **Copyright**: (c) pyproj contributors.

### Archivo · Public Sans · Azeret Mono (web fonts, self-hosted via `@fontsource`)
- **License**: SIL Open Font License 1.1
- **Copyright**: Archivo (c) Omnibus-Type; Public Sans (c) General Services Administration / Impallari Type; Azeret Mono (c) Displaay Type Foundry.
- **Use**: display, text and tabular-number faces of the public web app and the team workspace; shipped as woff2 files inside the build so the app renders offline.

## IBM Plex Sans

The atlas bundles the Latin variable-weight webfont from IBM Plex Sans, distributed via Fontsource. Copyright 2019 IBM Corp. Licensed under the SIL Open Font License 1.1. The full notice is in [web/public/fonts/OFL.txt](web/public/fonts/OFL.txt).
