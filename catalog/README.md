# Model Runtime Catalog

`model-runtime-catalog.json` is a generated materialized view over BML model cards and immutable benchmark artifacts.

Do not hand-edit the catalog.

Regenerate it with:

```sh
pnpm benchmark:catalog:materialize
```

Successful browser and Node benchmark CLI runs regenerate it automatically.

The catalog contains one record per effective execution profile:

```text
model + revision
+ engine + engine version
+ host
+ accelerator
+ dtype
+ protocol profile
```

Machine/hardware is observation metadata rather than profile identity. Performance measurements remain grouped by machine.

Raw benchmark artifacts under `docs/benchmarks/runs/` remain authoritative evidence. Current model cards define the executable runtime/protocol configuration exposed by the catalog. If historical evidence was collected under an older configuration, the catalog marks that qualification `stale-config` until matching evidence exists.

The catalog is replaceable derived state intended for consumers that need the current qualification view without reading benchmark internals.
