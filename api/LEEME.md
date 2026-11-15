# api/ · why there are no serverless functions here

Document 04 reserved this folder for Vercel functions that would run the engine on demand. We
decided not to deploy them, on purpose:

- **Everything the public site shows is precomputed and verifiable.** `motor/exportar` writes
  `web/public/data` with a manifest that lists every file's SHA-256; the site, the CI and
  `python -m motor.exportar.verificar` re-check it. A function computing numbers at request time
  would make the published result depend on a runtime nobody can hash.
- **The interactive parts run in the browser.** The 3D lab repeats formulas F3–F7 in TypeScript over
  the exported `horizontes.bin` (72 azimuths), so the site works offline and on the venue Wi-Fi.
- **The full engine needs data that is not in the repository.** Ray-casting horizons over the LOLA
  grids out to 300 km needs `datos/grillas` (hundreds of MB) and the DE421 kernels; a cold serverless
  start would download them on every invocation.

When a finer answer is wanted (any date 1901–2049, 360 azimuths, point altitude and slope), the
same engine runs locally as `python -m servidor` (see `servidor/LEEME.md`); the web detects it and
labels every number it returns as "Live engine".
