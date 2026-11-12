# Unified model capability catalog contract

## Purpose

Publish one generated, versioned `model-capability-catalog.json` for consumers such as Pantheon. It aggregates all tested model/runtime/hardware combinations and may include declared but untested model specifications, clearly separated from evidence.

The catalog is a **derived artifact**, not a manually edited source of truth. Source data remains in model cards, benchmark run artifacts, and optional runtime discovery records. No large model inventories belong in implementation source files.

## Conceptual schema

- `schemaVersion`, `generatedAt`, `generatorVersion`, source revision and evidence provenance.
- `models`: stable model identity, upstream revision, family, artifact/quantization identifiers, declared capabilities, and provenance.
- `deployments`: runtime type, wire protocol, compatible adapter version, supported features, effective settings and machine/environment identifiers; exclude private endpoint URLs and secrets from distributable exports.
- `benchmarkRuns`: immutable evidence references, suite/scorer versions, measured metrics with units, observed failures, resource usage, and result status.
- `capabilityAssessments`: task/role qualifications linked to the exact supporting run IDs, sample sizes, confidence/uncertainty and qualification method.

A model with no run evidence can have declared metadata but cannot be labeled benchmark-qualified. Preserve multiple runs rather than replacing them with a single universal rating. Unknown is distinct from unsupported and failed.

## Consumer boundary

BML reports observations and reproducible derived qualifications. Pantheon decides model routing, reliability thresholds, and task decomposition. Aether receives a selected execution profile and relevant capability requirements; it does not need to scan all model cards or own the catalog.

Export generation should be deterministic for identical source inputs (apart from explicitly recorded generation metadata), schema-validated, and backward-compatible through explicit schema versioning. Missing evidence must be surfaced rather than invented.

## Hosted model evidence

Hosted API model runs require an explicit API model identifier, execution surface (raw API versus agent harness), token usage, latency, rate-limit/failure evidence, and pricing provenance when cost can be estimated. Do not present ChatGPT app behavior as equivalent to a raw API model benchmark. Hosted model card proposals may exist before an adapter, but must be marked non-runnable and excluded from active browser inventory.

## Token usage, pricing, and task-cost evidence

Every benchmark result should record input, output, cached-input, reasoning, and other billable token categories when exposed, together with provider-reported totals, request count, elapsed time, runtime/model/deployment identity, and collection method. Missing categories are unknown, not zero. Locally measured token counts are estimates unless validated against the runtime tokenizer; do not compare estimated and provider-billed tokens as if identical.

Record pricing separately from measurements: pricing source, currency, effective date/version, input/output/cache rates, minimum charges if applicable, and whether a request was covered by a subscription or prepaid quota. Never infer marginal API cost from a ChatGPT subscription. Derived cost includes an explicit formula and pricing snapshot; local inference should report hardware, energy and resource measurements separately rather than pretend it has API token charges.

Expose observed cost-per-successful-task and distributions across repeated attempts, not only average cost per request. Include failed-attempt and retry costs in end-to-end task cost. Aether receives the selected execution profile and relevant cost evidence; Pantheon applies budgets and routing policy. Benchmark evidence is not a guaranteed quote for an arbitrary future task.

## Standardized coding workload

Maintain versioned, immutable benchmark fixtures independent of runtime adapters. Start with two related profiles: (1) single-turn coding challenge with identical source, instructions, output contract and deterministic tests; (2) bounded agentic coding challenge with controlled tools, filesystem fixture, execution limits and end-to-end acceptance tests. Record task ID/version, input digest, scoring version, tool permissions, context budget, attempt count and all token/cost metrics. Do not combine the two profiles into one ranking.

A representative TypeScript challenge should include a real bug and a small feature extension with contract-preserving tests. Challenge fixtures and expected outputs must live in data/fixture files, not executable model-card lists. Preserve identical semantics across runtimes, while recording differences in available tooling and context. Run multiple trials when making reliability claims.

## Implemented materialized catalog

BML now materializes `catalog/model-runtime-catalog.json` directly from:

- active model cards under `testing/*.json`;
- immutable benchmark artifacts under `docs/benchmarks/runs/*.json`.

Run:

```sh
pnpm benchmark:catalog:materialize
```

Successful browser and Node benchmark CLI runs also refresh the catalog automatically after writing their raw artifact and Markdown summary.

### Execution profile identity

The durable catalog unit is one effective model execution profile:

```text
model + upstream revision
+ engine + engine version
+ host/execution surface
+ accelerator/backend
+ dtype/quantization
+ compatibility/protocol profile
```

Machine identity is **not** part of execution-profile identity. The same profile may accumulate observations from multiple machines. Performance measurements remain grouped by machine so latency, readiness, and resource data are never averaged across dissimilar hardware.

Current Transformers.js artifacts materialize as separate browser and Node profiles. Future runtime adapters may introduce other engine and host values without changing the conceptual contract.

### Incremental evidence and qualification

Raw benchmark artifacts are immutable evidence and are never replaced by the catalog.

Repeated runs of the same execution profile accumulate under one catalog profile. Current production statistics use the median/minimum/maximum of observations from the current scorer revision rather than retaining the luckiest run.

When a newer scorer revision appears for a profile, only observations from that scorer revision contribute to `currentQualification`. Older evidence remains referenced under `supersededEvidence`; it is not deleted or mixed into the current score.

This allows benchmark evolution without rerunning the entire model inventory. Only profiles or capability dimensions requiring fresh evidence need to be rerun.

Role capability entries preserve observed ratings, sample counts, and rating distributions. The catalog does not invent a new universal capability score beyond the deterministic qualifications already present in benchmark evidence.

### Consumer boundary

The materialized catalog is the compact current view intended for downstream systems. Consumers do not need to parse BML's raw benchmark artifacts or model cards.

BML owns evidence and qualification. Pantheon may use the catalog for routing and selection policy. Aether can consume a selected execution profile plus its relevant runtime requirements/evidence when its runtime registry is implemented.

The generated file is derived state and must not be hand-edited. Its schema is `schemas/model-runtime-catalog.schema.json`.

## Delivery

Add a catalog export command after the schema and runtime adapter contract are validated. Keep generated catalog artifacts separate from authoritative model cards and raw benchmark evidence. This is a planned interface, not an implemented exporter.
