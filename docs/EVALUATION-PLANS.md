# Declarative Evaluation Plans

For the exhaustive list of accepted plan keys, value ranges, defaults, and supported combinations, see [Evaluation Plan Field Reference](EVALUATION-PLAN-REFERENCE.md).

## Contract

**Model cards describe models. Suites describe evaluation capabilities. Plans describe execution.**

A plan is a versioned JSON document: it owns the model-card **directory**, run settings, suite selection, token/sampling matrix, cache/runtime/machine, output directory, and catalog publication choice. It does **not** name, copy, or embed a list of candidate models. All valid cards in `cardsDir` are included automatically, using BML's existing model-card inventory. To change participants, change the folder contents or choose another folder.

The single runtime entrypoint is:

```bash
pnpm benchmark:plan -- --plan plans/production-baseline.json
```

All settings are in the file. There are no additional execution flags to remember. For inspection without running models, add `--dry-run`. `--plan` takes a path separated by a space (not a colon).

## Example

```json
{
  "schemaVersion": 1,
  "id": "mac-model-check",
  "cardsDir": "experiments/mara-dialogue",
  "execution": {
    "machine": "mac-m4",
    "runtime": ["browser"],
    "mode": "headless",
    "cache": "reuse",
    "trials": 1,
    "maxJobs": 200,
    "timeoutMs": 1800000,
    "profileDir": ".artifacts/browser-ai-benchmark-profile",
    "port": 0
  },
  "suites": ["advanced"],
  "matrix": {
    "maxNewTokens": [256, 512, 768]
  },
  "output": {
    "retainTranscripts": true,
    "publishCatalog": true,
    "directory": "docs/benchmarks/runs"
  }
}
```

This selects every candidate card in the specified directory and runs the requested suite at the three budgets using the existing BML browser CLI. No model ID is duplicated in the plan. A second file can target Node, use different budgets, or select other suites.

For multimodal recognition, use `suites: ["vision"]` and `vision.fixtures: ["fixtures/vision/table-text.json", "fixtures/vision/table-reasoning.json"]`. See [Vision Evaluation Plans](VISION-EVALUATION-PLANS.md) and `plans/vision-template.json`.

## Current execution and honest limits

This first implementation includes:

- Strict versioned plan validation, safe repository-relative paths, fail-closed unknown keys, and deterministic matrix expansion.
- Automatic model-card discovery by directory and unique per-job run identifiers.
- A workload/blocked-job preview; job count is model count × runtime count × suites × combinations × trials, bounded by `maxJobs`.
- `--dry-run` preflight (optional), sequential execution via existing browser and Node runners, continued attempts after one runner fails, and a run checkpoint.
- Existing complete benchmark JSON evidence, including transcripts, remains in the configured output directory; the **catalog** continues to ingest compact measurements and pointers to raw evidence, not full dialogue.
- Existing benchmark commands and model cards are not changed. The plan is orchestration, not a second model registry.

The plan vocabulary deliberately **reserves** `character`, `temperature`, and `memoryStrategy` for a dedicated automated character-evaluation suite. Those combinations are marked BLOCKED and may not silently run an unrelated technical suite. The manually operated Character Lab is already available, but it is not a headless matrix runner.

The legacy `production` suite uses a fixed 256 output-token cap. The `advanced` suite has 256/512/768 token budgets. The plan reports conflicts explicitly; it never pretends that `maxNewTokens: [512]` changes production-fitness or Mara's MR1 limit.

Current benchmark CLIs always retain full raw artifacts and refresh the catalog. A plan requesting `retainTranscripts: false` or `publishCatalog: false` is blocked until the underlying output controls are implemented; it is not silently ignored. Node cold-cache reset and Node headful mode are also blocked.

The execution mode applies to the browser process, not a promise to run all models through a desktop-native inference backend. A larger model may still fail its WebGPU memory envelope.

## Architectural direction

A future native `character` suite should accept the same plan contract, with context profiles, seeded replay where supported, summary compression strategies, configurable response budgets and repeated trials. Suites register typed settings and produce versioned evidence; the planner composes cases and schedules them without modifying its own code for each test definition.

Any new suite needs a handler; **new plans and model combinations must not**. Avoid interpreting missing suite implementations as passed benchmarks.

## Reporting boundary

Evidence record: plan ID/digest, machine, model, runtime, suite, parameter combination, trial, effective protocol/adapter, status, benchmark artifact path, and failure attribution. Preserve immutable benchmark artifacts and failed attempt evidence; do not place verbose transcript text into the capability catalog. The catalog must report only measured qualifications and stable evidence references, never aggregate incomparable scorers or parameter profiles into a false universal ranking.
