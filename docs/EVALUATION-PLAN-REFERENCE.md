# Evaluation plan field reference (schema v1)

This is the **complete accepted input vocabulary** for the plan validator in `scripts/evaluation-plan-lib.mjs` at this revision. Unknown properties are rejected. A property being accepted by the validator does **not** necessarily mean the current runner can execute it; consult the support table below.

Run a plan with no extra execution flags:

```bash
pnpm benchmark:plan -- --plan plans/production-baseline.json
```

Preview every generated job and blocked combination without loading a model:

```bash
pnpm benchmark:plan -- --plan plans/production-baseline.json --dry-run
```

Paths are relative to the repository root. Every valid model card in `cardsDir` is included; plan files do **not** name individual model IDs. Model configuration remains in those cards.

## Complete fields

| JSON path | Type | Allowed values / constraints | Required? | Notes |
| --- | --- | --- | --- | --- |
| `schemaVersion` | integer | `1` | Yes | Rejects other schemas |
| `id` | string | 1–80 chars, lowercase letters/digits, then `a-z 0-9 . _ -` | Yes | Stable plan identity, used in checkpoint filename |
| `cardsDir` | string | Nonempty, repository-relative path; no `..` segments | Yes | All JSON model cards discovered from this folder |
| `execution.runtime` | string array | `browser`, `node`; one or both, unique | Yes | `node` is Node-hosted Transformers.js, not necessarily a CPU model |
| `execution.mode` | string | `headless`, `headful` | Yes | `headful` only works for browser |
| `execution.cache` | string | `reuse`, `cold` | Yes | `cold` only works for browser |
| `execution.trials` | integer | 1–20 | Yes | Repeats each job |
| `execution.maxJobs` | integer | 1–5000, default `500` | No | Hard upper limit on expanded jobs |
| `execution.machine` | string | 1–80 characters: letters, digits, `.`, `_`, `-` | No | Defaults to hostname |
| `execution.timeoutMs` | integer | 1–86,400,000 | No | Browser CLI timeout; Node runner does not consume this option |
| `execution.profileDir` | string | Nonempty, repository-relative, no `..` | No | Chrome profile path, browser only |
| `execution.port` | integer | 0–65535 | No | Browser Vite port; `0` chooses an available port |
| `suites` | string array | `production`, `advanced`, `character`, `t1`, `t2` | Yes | All distinct; see support table |
| `matrix.maxNewTokens` | integer array | Unique values, each 64–1536 | Optional axis | Supported technical-suite budgets currently restricted to 256/512/768; production uses 256 |
| `matrix.temperature` | number array | Unique finite values, each 0–2 | Optional axis | Reserved for future suite-aware sampling overrides; currently blocked |
| `matrix.memoryStrategy` | string array | Unique: `rolling`, `full`, `recent`, `none` | Optional axis | Reserved for character suite; currently blocked |
| `output.retainTranscripts` | boolean | `true` / `false` | Yes | Only `true` executable; raw artifacts always keep transcripts today |
| `output.publishCatalog` | boolean | `true` / `false` | Yes | Only `true` executable; current runner always materializes catalog |
| `output.directory` | string | Nonempty, repository-relative, no `..` | No | Benchmark raw artifact output directory |

`execution`, `output`, and `suites` are required objects/array. `matrix` is optional and defaults to `{"maxNewTokens":[256]}`; when present it must contain at least one of the three accepted axes. Each axis is a nonempty list of unique values. A plan cannot contain arbitrary extra root fields, a `models` list, custom shell commands, arbitrary executable paths, callbacks, or parser code.

## Suite / configuration support

| Plan request | Current behavior |
| --- | --- |
| `advanced` with 256 / 512 / 768 | Executable; the existing advanced benchmark is selected with the requested budget |
| `t1` or `t2` with 256 / 512 / 768 | Executable |
| `production` with `maxNewTokens: [256]` | Executable, fixed 256 output ceiling; includes the existing unscored Mara dialogue transcript |
| `production` with other max token values | **Blocked**; no false claim that Mara's 256 cap was changed |
| `character` | **Blocked** until the dedicated automated character runner exists |
| Any matrix with `temperature` | **Blocked** until per-suite sampling sweeps are implemented |
| Any matrix with `memoryStrategy` | **Blocked** until automated memory scenarios are implemented |
| Node + headful or Node + cold cache | **Blocked** |
| `publishCatalog: false` or `retainTranscripts: false` | **Blocked** until the output pipeline supports these options |

A blocked plan can be inspected with `--dry-run`, but `--execute` is not required and is not a valid flag. Without `--dry-run`, **execution is the default** and any blocked job prevents the entire plan from running.

## Matrix cardinality

Each axis is combined with every other axis (Cartesian product):

```text
jobs = number of model cards
     × number of runtimes
     × number of suites
     × number of matrix combinations
     × number of trials
```

The planner refuses a count over `execution.maxJobs` rather than silently running a huge sweep. Plan jobs have deterministic identifiers, and the runner records completed and failed attempts under `docs/benchmarks/plans/<plan-id>-latest.json`.

## Example: three output budgets

```json
{
  "schemaVersion": 1,
  "id": "mac-budget-comparison",
  "cardsDir": "testing",
  "execution": {
    "machine": "mac-m4",
    "runtime": ["browser"],
    "mode": "headless",
    "cache": "reuse",
    "trials": 1,
    "maxJobs": 100
  },
  "suites": ["advanced"],
  "matrix": {"maxNewTokens": [256, 512, 768]},
  "output": {
    "retainTranscripts": true,
    "publishCatalog": true,
    "directory": "docs/benchmarks/runs"
  }
}
```

For model subsets, create an experiment folder containing only the desired JSON cards and point `cardsDir` at it. For a future Mara dialogue matrix, see `plans/mara-character-design.json`: this documents intended settings but remains intentionally blocked until the character suite exists.

## Planned, not yet valid fields

The interactive Character Lab supports context/memory and generation controls, but those controls are **not all plan fields yet**. Do not put the following into a plan expecting execution: `topP`, `topK`, `minP`, `repetitionPenalty`, `presencePenalty`, `contextWindow`, `roleBudget`, `summaryBudget`, `recentPairs`, `compressAfterPairs`, `summaryMaxNewTokens`, `thinking`, `sampling`, `seed`, or `contextProfile`. The validator currently rejects these.

The intended architecture is to register supported suite-specific dimensions with typed contracts and capabilities so new **values/plans** do not require edits to the scheduler. New **evaluation behaviors** still need reusable suite handlers, not per-plan rewrites.

## Evidence and catalog

Complete transcripts, failures and invocation traces belong in immutable run JSON files in `output.directory`. `catalog/model-runtime-catalog.json` is derived and summarizes qualifications, performance and evidence references; it must not duplicate every dialogue turn. These outputs are governed by existing BML catalog and artifact formats. A plan's `publishCatalog` and `retainTranscripts` are currently assertions about the underlying runner's fixed behavior, not independently configurable toggles.
