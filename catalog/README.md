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

Raw benchmark artifacts under `docs/benchmarks/runs/` remain authoritative evidence. The catalog is replaceable derived state intended for consumers that need the current qualification view without reading benchmark internals.
