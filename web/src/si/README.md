# SI integration contract (Nahum)

Import `abrirSI` from `web/src/si/abrirSI.ts`. It dispatches `terrax:si`, opens
the existing panel, prefills the question and focuses the input. The visitor
sends explicitly. No changes to `MvpApp.tsx` are needed by other owners.

```ts
abrirSI("Analyze this point", {
  pagina: "lab",
  pedido: { fila, col, lunacion, consumo_w, panel_w, bateria_wh },
});

abrirSI("Explain this comparison", {
  pagina: "lab",
  pedidos: [pedidoA, pedidoB], // two or three destination requests
});
```

- `pagina`: the originating screen. Optional; defaults to the current screen.
- `candidataId`: optional terrestrial record ID. Never converted to a lunar pixel.
- `pedido`: the actual destination request visible on screen.
- `pedidos`: two or three destination requests for the batch comparison.
- `alturaObjetoM`, `elevacionSolDeg`, `instante`: optional experiment context.

Erwan's payloads are also accepted through `normalizarContextoSI`:
`pantalla`, `punto` + `periodo` + `vehiculo` (laboratory), `sitios` (published
record IDs), `altura_objeto_m` and `elevacion_sol_deg` (Earth/Moon).
Caller-supplied `resultado` or score values never count as verified data. The
SI reruns the engine or reloads the published records. From a laboratory
lunation request, the visitor can also compare summer and winter at the same
point, keeping the supplied vehicle parameters.

Use the existing `PedidoEscenario` fields. Vehicle overrides are optional at the
API boundary; omitted values use the server parameters. Supply either `lunacion`
or `desde` and `hasta`. The SI validates requests before executing them. Caller
context is descriptive input, never a source of verified engine output.

Ownership: Nahum maintains `si/`, the data adapter, SI server and atlas entry
points. Erwan owns the laboratory, comparator and Earth/Moon buttons. Jean owns
the scientific endpoints. This branch does not change their files.

## Engine boundary

`analizarPuntoSI` posts the validated request to the existing
`/api/destino/punto`. Returned point, period, vehicle overrides, finite metrics
and parameter hash must match before a readout can be shown. The SI does not
calculate terrain metrics or invent `scenario_id` for this endpoint.

The batch adapter consumes Jean's J4 wire format (commit `5004720`):

```ts
// POST /api/destino/comparar
{ escenarios: [pedidoA, pedidoB], series: false }
// Response, in request order:
{ origen: "motor-en-vivo", escenarios: [
  { id: "A", ok: true, scenario_id: hashReproducibleDeJean, escenario: respuestaDePuntoA },
  { id: "B", ok: false, error: "..." },
] }
```

The adapter checks wrapper IDs, matching nested scenario hashes and scientific
fields before showing a readout. `series: false` avoids transferring unused time
series. The browser suite exercises success, partial failure and unavailable
endpoints. An unavailable
endpoint produces an explicit message, never emulated individual calls or fake
comparison results. Valid items survive individual response failures.

`verificarCifrasMotorSI` binds each displayed value to a returned field and unit.
The deterministic engine readout is available independently of Gemini. Follow-up
model prose receives the verified results but may only explain them without
numbers; numeric claims cannot silently switch fields or scenarios.

The chat and its connection status use the server relay and `VITE_MOTOR_URL`
when configured. Configure `TERRAX_GEMINI_KEY` on the server; the browser no
longer imports the embedded key module. Model text is buffered until checked.

## Delivery order

1. Reuse/cherry-pick the opening-contract commit if another branch needs it early.
   Do not copy or rewrite `abrirSI.ts`; Git can reconcile the shared commit.
2. Erwan's screen payload is normalized in the SI layer. His terrestrial site
   comparator supplies published record IDs for explanation, never lunar pixels.
3. Exercise the adapter against Jean's real endpoint after pulling `main`.
4. Integrate the team PRs, run the final checks and freeze functionality.
   Publishing still requires the team's approval.

## Integration status

Jean's `5004720` is integrated in this branch, with no changes to his files.
Real HTTP checks exercised the adapter against both scientific endpoints:
one point, two complete scenarios, a partially failed batch and reproducible IDs.

Erwan's `b144ba5` and Jean's `5004720` overlap in
`web/src/pantallas/operacion/DosMundos.tsx`. A read-only `git merge-tree` check
reports three conflicting regions: the terrain controls, the 3D component props
and the relief caption. Their owners need to reconcile this file, retaining the
editable height, terrain loading/fallback callback, and the distinction between
the 60 m scientific grid and the 120 m display mesh. The automatic merge also
duplicates terrain state/reset declarations, which need review.

This SI branch intentionally leaves that cross-owner conflict unresolved and
does not merge Erwan's branch. Its payload is covered by SI integration tests.
Once the owners publish the combined view, repeat the laboratory, terrain and
SI browser checks before the final freeze. No deployment has been performed.

## Validation on the integrated Jean base

- Python motor/server suite: **197 passed, 8 skipped**. Skips cover missing
  `rasterio`, unpublished raw grids and generated outputs absent on this machine.
- Browser suite (SI, verifier, laboratory, atlas, MVP and terrain): **41 passed**,
  including English/Spanish, 375 px, keyboard focus, offline use and failure paths.
- TypeScript check and production build passed. Published-data verification:
  **64 files / 20.5 MB**, all hashes matched.
- Live HTTP smoke check: point readout (4 figures), summer/winter comparison
  (8 figures), partial batch failure (4 figures retained), stable scenario IDs.
- Gemini relay behavior is tested with controlled responses; no live Gemini
  generation was requested. Its server key is required for model-written prose.
