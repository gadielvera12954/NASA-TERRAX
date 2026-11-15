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
2. Erwan supplies `pedido` / `pedidos` from the visible experiment. His terrestrial
   site comparator can pass site IDs for explanation; it must not manufacture
   lunar destination requests from terrestrial IDs.
3. Exercise the adapter against Jean's real endpoint after pulling `main`.
4. Integrate the team PRs, run the final checks and freeze functionality.
   Publishing still requires the team's approval.
