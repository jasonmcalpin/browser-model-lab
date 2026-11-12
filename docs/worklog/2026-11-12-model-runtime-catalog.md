# Materialized model runtime catalog

## Goal

Create one compact, generated model-runtime specification file that downstream systems can consume without reading BML model cards or raw benchmark artifacts.

## Completed work

- Replaced the prototype normalized catalog exporter with a repository-aware materializer.
- Added stable execution-profile identity based on model revision, engine/version, host, accelerator, dtype, and compatibility profile.
- Kept machine identity out of profile identity while grouping performance evidence by machine.
- Added incremental aggregation of repeated benchmark runs.
- Added current qualification semantics keyed to the latest scorer revision.
- Preserved older scorer evidence as superseded references rather than deleting or mixing it into current results.
- Added production median/minimum/maximum/sample-size aggregation so the catalog does not retain only the luckiest run.
- Preserved role rating distributions and sample counts rather than inventing a new universal capability score.
- Added explicit declared-model-without-evidence reporting.
- Added the catalog schema.
- Added automatic catalog refresh after successful browser and Node benchmark CLI runs.
- Added tests for browser-vs-Node identity, repeated-run aggregation, scorer supersession, machine grouping, and unqualified declarations.
- Updated README, model-card guidance, and capability-catalog documentation.

## Architecture decisions

Raw benchmark artifacts remain immutable authoritative evidence.

`catalog/model-runtime-catalog.json` is disposable derived state and must never be manually edited.

The profile identity is:

```text
model + revision
+ engine + engine version
+ host/execution surface
+ accelerator/backend
+ dtype/quantization
+ compatibility/protocol profile
```

A material change to protocol or generation behavior should receive a new `compatibilityProfileId`, which therefore creates a distinct execution profile.

Hardware/machine does not create a new profile. Performance measurements are grouped under `performanceByMachine`.

Repeated runs using the same scorer revision contribute to current aggregate evidence. When a newer scorer revision appears, only that revision contributes to `currentQualification`; older evidence remains traceable as superseded evidence.

## Significant files changed

- `scripts/export-model-capability-catalog.mjs`
- `scripts/export-model-capability-catalog.test.mjs`
- `scripts/run-browser-ai-benchmark.mjs`
- `scripts/run-node-ai-benchmark.mjs`
- `schemas/model-runtime-catalog.schema.json`
- `catalog/README.md`
- `docs/CAPABILITY-CATALOG.md`
- `docs/MODEL-CARDS.md`
- `README.md`
- `package.json`

## Verification

CI is expected to run the existing Node tests, Vitest suite, typecheck, and build.

The new materializer tests use synthetic artifacts to verify identity and aggregation behavior without requiring model inference.

## Operational dependencies

No new package dependency.

The materializer uses Node filesystem APIs and existing benchmark artifacts/model cards.

## Deferred work / limitations

- Hosted/API pricing and token-cost evidence can be added when hosted runtime adapters exist.
- Future external runtimes should emit canonical runtime identity rather than rely on current Transformers.js environment inference.
- Per-capability scorer revisions may eventually allow finer-grained staleness than the current artifact-wide scorer revision.
- Catalog JSON is first generated/refreshed by the materializer or the next successful benchmark run; it is derived rather than hand-authored.

## Resulting state

BML now has a durable evidence pipeline:

```text
model cards + immutable benchmark runs
                 |
                 v
       catalog materializer
                 |
                 v
catalog/model-runtime-catalog.json
```

Downstream systems can consume one current runtime-profile catalog while retaining full evidence provenance.

## Suggested next step

After merge, run `pnpm benchmark:catalog:materialize` once to materialize the catalog from the benchmark artifacts already in the repository and commit that generated JSON alongside future benchmark evidence.
