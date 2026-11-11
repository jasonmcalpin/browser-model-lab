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

## Delivery

Add a catalog export command after the schema and runtime adapter contract are validated. Keep generated catalog artifacts separate from authoritative model cards and raw benchmark evidence. This is a planned interface, not an implemented exporter.
