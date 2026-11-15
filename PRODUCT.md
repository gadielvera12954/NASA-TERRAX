# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the NASA Space Apps 2026 jury at the Ciudad del Este site, watching a live demo on a laptop or projector. They have minutes, not hours, and must grasp the problem, the mechanism and the evidence quickly. Secondary: curious public and the team itself (scientists checking numbers).

## Product Purpose

TERRA-X finds places on Earth where a crew could rehearse work planned for the lunar south pole (a VIPER-class rover at Mons Mouton, 84.60°S 31.00°E). It compares Moon and Earth terrain with the same code at 60 m per pixel, without interpolation, and says honestly what transfers and what does not. Success: a visitor understands in seconds why grazing sunlight and long night matter, opens a candidate, and sees its limits.

## Positioning

The same physics and the same 60 m grid for both worlds: lunar relief from NASA LOLA, Earth relief from Copernicus GLO-30, the Sun from JPL ephemerides. Candidates carry two separate numbers, compatibility (C) and evidence (E), never a "% similar to the Moon", and every candidate lists what does not transfer.

## Operating Context

Hackathon demo (Sunday 15 Nov 2026, delivery 23:59), in English with a Spanish toggle. Runs locally with Vite; a live physics engine (python -m servidor) is optional and the app falls back to exported files. Must work offline after one visit. Field kit: a 0.50 m board measuring real shadows at sunset.

## Capabilities and Constraints

- Screens: Home, Explore (candidate picker), Candidate card, Compare sites, Earth/Moon phenomena, 3D lab (park a rover on real Mons Mouton relief, watch battery through the lunar night), Verification (data and sources), Guide (with a Sun-angle shadow lab and field measurement).
- Data comes from `web/public/data` (manifest with SHA-256, fichas per candidate, 40 Payunia parcels plus controls). Numbers are never invented in the UI.
- Verdict vocabulary: supported, with gaps, insufficient, unknown, incompatible.
- English by default; "SI" instead of "AI" in NASA-facing text. Apache-2.0; every source cited.
- The integrated public interface follows the field atlas in `DESIGN.md` and `web/MVP.md`, including the persistent dark/light choice.

## Brand Commitments

Name TERRA-X. Voice: plain, honest about limits, no hype. No minors in imagery. No Chinese models. No invented data.

## Evidence on Hand

Real data in `web/public/data` (manifest.json with 14 sources, fichas, huella/distribuciones_payunia.json), 3D models in `web/public/modelos` (Mons Mouton relief .glb, rover, board), illustrative terrain image `web/public/img/ui_tierra_top.png` (synthetic, labeled). No testimonials, partners or endorsements exist; none may be invented.

## Product Principles

1. Show the mechanism (light, shadow, night) before explaining it.
2. Honesty is the product: limits and unknowns are first-class, never fine print.
3. One code path, two worlds: every comparison is like for like.
4. A judge should get it in one viewport; a scientist should find every source.

## Accessibility & Inclusion

Keyboard navigation, visible focus, skip link, reduced-motion support, bilingual EN/ES, print-friendly candidate card.
