# Extraction from Code Gauntlet

## Source

BML originated in `jasonmcalpin/code-gauntlet` under `apps/client/src/features/browser-ai-benchmark/`, with CLI/report support under `scripts/*browser-ai*`.

Extraction implementation baseline: Code Gauntlet commit `49f2834acde37283c8b52750e07bee72eadd15a9`. This baseline includes the schema-13 diagnostics and the stuck-worker cleanup developed after the first diagnostic run.

## Phases

1. Foundation: project contract, guidance, skills, architecture, and provenance.
2. Copy-first extraction: import runtime, benchmark, CLI, and tests with only standalone adaptations.
3. Standalone verification: typecheck, tests, build, browser launch, cached model run, artifact generation.
4. Parity: compare representative survivor models to Code Gauntlet.
5. Boundary cleanup: separate generic core/runtime/suites from Code Gauntlet-derived fixtures.
6. Consumer integration.
7. Remove the embedded Code Gauntlet harness only after accepted parity.

## Parity rule

Sampled text need not be byte-identical. Preserve model identity, compatibility profile, semantic tasks/scorers, runtime/tool adapter behavior, validity/failure attribution, stored evidence, role/failure projections, and recovery behavior.

Code Gauntlet remains the reference implementation until standalone BML is marked working.
