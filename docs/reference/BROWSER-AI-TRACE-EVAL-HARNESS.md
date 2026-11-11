# Browser AI trace-first evaluation harness

## Goal

Make Browser AI Benchmark V2 explainable and replayable: every run should preserve enough evidence to understand what happened, why it failed, and how a later scorer revision would interpret the same model outputs.

## Design

The benchmark now treats the raw run artifact as immutable primary evidence.

A run contains:

- a versioned eval manifest;
- benchmark/scorer/compatibility identities;
- selected candidates/tests/budgets;
- tagged case descriptors;
- explicit deterministic-vs-sampled trial policy;
- rendered model invocations;
- chronological normalized event traces;
- raw model output;
- normalized model turns;
- tool calls and deterministic tool receipts;
- timing/token/termination evidence;
- validity and failure attribution.

### Event chronology

Tool trajectories are persisted in execution order:

```text
invocation
model-output
normalized-turn
tool-call
tool-result
invocation
model-output
normalized-turn
...
```

This makes a failed run inspectable without reconstructing chronology from unrelated arrays.

## Offline rescoring

```sh
pnpm benchmark:browser-ai:rescore -- docs/benchmarks/runs/<run>.json
```

Rescoring:

- performs no model inference;
- reads the saved production-fitness outputs;
- applies the current deterministic production scorer;
- writes a new non-overwriting `*.rescored.json` artifact;
- records the source artifact and scorer revision;
- never mutates the original run.

This is intentionally the first offline-rescore surface. Advanced trajectory scorers can be moved onto the same replay contract as their score definitions evolve.

## Tags

Cases are tagged by concerns such as:

- production
- advanced
- context
- evidence
- provenance
- tools
- trajectory
- authority-boundary
- identity
- memory
- role/privacy
- research
- player-facing

The goal is to support category comparisons rather than relying on one aggregate score.

## Invariants

- Inference evidence is immutable.
- Rescoring creates a derived artifact.
- Scorer revisions are explicit.
- Compatibility-profile changes create a new benchmark revision.
- Tool execution remains deterministic authority.
- The normalized trace does not replace raw model output.
- Human review can use the same stored trace without introducing an LLM judge.

## Scorer revision v2

The current production scorer revision is `browser-ai-scorers-v2`.

Current schema-13 artifacts retain the 12 scored PF cases plus PF11B, the unscored sequential character transcript, and the separate unscored diagnostic/role projection evidence. Offline rescoring recomputes deterministic PF scores from stored outputs without rerunning inference; PF11B remains human-review evidence and is never converted into an automatic quality score.

