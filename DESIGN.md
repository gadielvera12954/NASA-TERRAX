# TERRA-X field atlas design

The public app and specialist workspace use the shared semantic tokens in `web/src/sistema/tokens.css`. The implementation and navigation are documented in `web/MVP.md`.

## Appearance

Dark is the initial screen theme. The header button stores the user's light/dark choice before the interface loads and shares it with the specialist workspace. The app also uses that choice offline. Printing uses white paper and dark text.

| Role | Dark | Light |
| --- | --- | --- |
| Page | #101C22 | #F3F6F8 |
| Surface | #18272E | #FFFFFF |
| Text | #E4EDF1 | #172B35 |
| Secondary text | #A7B9C3 | #536773 |
| Action | #80CBD1 | #176B78 |

Status colors, chart series and input states use their named tokens. Verdicts have text and an icon. Comparison series have letter labels and line patterns. Physical shadows belong to the scientific visualizations.

## Typography and shape

Three local faces, all under the SIL Open Font License: IBM Plex Sans for interface and body text, Archivo in its expanded width (112–125 %) for headings and the wordmark, and Azeret Mono for technical readings (coordinates, scores, units). The home hero shows Earth, the Moon and Mars at their true relative sizes under one low Sun, in a single small WebGL canvas capped near one megapixel and 30 frames per second that stops drawing when it is off screen. Surface corners use the 8 px radius token and controls use the smaller 5 px token. Labels use sentence case and controls have at least a 44 px touch area.

## Composition

The home page pairs a short introduction with a contour map generated from the existing LOLA data. The catalogue and field tools follow. The full site index is searchable and scientific controls have a separate group. A record leads with its exported verdict and field measurement priorities. Comparison starts with up to three named records and places technical details in a disclosure.

Earth/Moon presents one phenomenon at a time with controls next to its readouts. The 3D view is optional and includes camera buttons. Source integrity verification and the SI assistant use the same palette. The original specialist tools remain accessible from How it works.

Layouts reflow down to 375 px, preserve visible keyboard focus, offer alternatives to dragging and respect reduced motion.
