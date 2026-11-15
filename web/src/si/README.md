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
