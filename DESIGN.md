# TERRA-X · Design system (public app)

The public app (`index.html`) is a sunlit wall that reads the Sun from the shadows it casts. Earth
surfaces are lime plaster; everything lunar sits on basalt plates. The team workspace (`team.html`)
keeps the original dark instrument theme (`web/src/sistema/tokens-equipo.css`) and is not covered here.

## Tokens (`web/src/sistema/tokens.css`)

| Role | Token | Value |
|---|---|---|
| Wall (page ground) | `--muro` | `#E4E2DC` |
| Raised plaster (panels) | `--muro-luz` | `#EEECE7` |
| Sunken plaster (notes) | `--muro-hundido` | `#D6D3CB` |
| Ink (text, buttons, rules) | `--tinta` | `#141414` |
| Secondary ink | `--tinta-2` / `--tinta-3` | `#45423D` / `#5E5A53` |
| Accent, the only one on the wall | `--oxido` | `#A8321E` |
| Earth fields | `--ocre` | `#C98F55` |
| Basalt plate (Moon, charts, SI console) | `--basalto` / `--basalto-2` | `#1F1F1E` / `#2A2A28` |
| Sunlight, data only (chart lines, Sun marker) | `--luz-solar` | `#F2B33D` |
| Verdicts on the wall | `--sost` / `--huec` / `--noal` / `--inco` | `#2F6B3A` / `#7A5A12` / `#8A4A0C` / `#A8321E` |

Plates redefine the same names for light-on-dark (`.placa`, `.escena`, `.noche-lunar`, `.panel.reloj`,
`.panel.comparador`), so a component styled with tokens works on both grounds.

## Type

- Display: **Archivo** variable, width 112–125 %, weight 700–900, tracking −0.02 em (`--tit`).
- Text: **Public Sans** variable (`--txt`), 16 px, line-height 1.55, measure ≤ 68 ch.
- Numbers and measurements: **Azeret Mono** (`--mono`), tabular; large readouts at weight 500, tracking −0.03 em.
- All three are self-hosted through `@fontsource` (OFL) and imported in `main.tsx` / `team-main.tsx`.

## Shape, rules and shadow

- Square corners (`--radius: 0`), 1 px ink rules, no gradients, no glass.
- Buttons are ink plaques with a 3 px oxide rule inside the bottom edge; on basalt they invert to plaster ink.
- Shadows follow the Sun: `--sombra-l = 2 px / tan(elevation)` is set live; the wall casts a soft penumbra
  (`--sombra-muro`), plates cast a hard vacuum shadow (`--sombra-placa`). Light always comes from the upper left.
- Verdicts and test states use drawn marks (`web/src/sistema/Marca.tsx`, lucide icons), never glyphs.

## Composition

- Home: headline and lede on the wall; the **shadow nomogram** runs edge to edge and is the Sun control
  (drag the shadow, the Sun follows); below its horizon the page becomes night (`.noche-lunar`) with the
  real Mons Mouton relief and the four destinations as full-width ruled rows.
- Inner pages: a fixed Sun scale (`.mvp-horizon`) at the bottom; sections are full-width rows or ruled
  definition lists, not card grids.
- Motion: one authored moment per page (the Sun sinking on the nomogram); hover and press states only,
  160–260 ms, exponential ease-out; everything stops under `prefers-reduced-motion`.
