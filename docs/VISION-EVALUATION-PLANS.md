# Vision evaluation plans and fixtures

Vision tests are **suite data**, not model-card fields or hard-coded evaluation logic. Model cards declare whether a model has a vision-capable runtime (`compatibilityProfile.visionProfile`); the evaluation plan selects which visual tasks to run. The default consists of the existing table-reading and table-reasoning fixtures.

## Start here

Copy `plans/vision-template.json` and edit its `cardsDir`, `vision.fixtures`, and execution settings. The template already includes the table fixtures.

```json
{
  "schemaVersion": 1,
  "id": "my-vision-run",
  "cardsDir": "experiments/vision",
  "execution": {
    "machine": "mac-m4",
    "runtime": ["browser"],
    "mode": "headless",
    "cache": "reuse",
    "trials": 1,
    "maxJobs": 100
  },
  "suites": ["vision"],
  "matrix": { "maxNewTokens": [256] },
  "vision": {
    "fixtures": [
      "fixtures/vision/table-text.json",
      "fixtures/vision/table-reasoning.json"
    ]
  },
  "output": {
    "retainTranscripts": true,
    "publishCatalog": true,
    "directory": "docs/benchmarks/runs"
  }
}
```

Run `pnpm benchmark:plan -- --plan plans/my-vision-run.json` or add `--dry-run` for preflight.

When `vision` is omitted and `suites` includes `vision`, BML uses the same two default table fixtures. A `vision` section without the `vision` suite is an error to avoid silently ignored settings. Model membership always comes from the directory, not from an embedded model list.

## Fixture schema v1

Each file contains exactly one question and an expected answer:

```json
{
  "schemaVersion": 1,
  "id": "person-count-three",
  "image": "/artifacts/testing/three-people.png",
  "prompt": "How many people are visible? Return only an integer.",
  "expected": "3",
  "scorer": "normalized-exact",
  "trials": 3,
  "maxNewTokens": 96
}
```

The example above is **not bundled**; add a verified image first. Assets must exist under `public/artifacts/` and are addressed with a same-origin `/artifacts/...` URL. PNG, JPEG, WebP and SVG are supported. Every fixture ID must be unique within a plan, its scorer is currently `normalized-exact`, its `trials` is 1–10, and `maxNewTokens` is 16–768. New scoring primitives must be implemented explicitly rather than permitting fixture-authored code. Strings are compared after uppercase, punctuation removal, and whitespace normalization, which supports exact numbers and phrases.

To add people-counting or scene recognition, put the image under `public/artifacts/`, create its JSON fixture under `fixtures/vision/`, and add that JSON path to the `vision.fixtures` array. The model runner does not need to be rewritten.

## Execution and scoring

The `vision` suite uses browser WebGPU and tests only image recognition. It does not run production, agent, tool or character scores. The exact `trials` and `maxNewTokens` are set per fixture, while the plan's `execution.trials` repeats the whole suite. Each case passes with a strict majority of successful attempts.

Vision results preserve every answer, timing metric, model invocation, source fixture ID and image path in the raw benchmark JSON. The existing compact model capability catalog receives evidence via the existing catalog materializer, not full transcripts. Explicitly non-vision model cards are reported as unsupported, not misreported as an image comprehension success.

`matrix.maxNewTokens` is a technical-suite axis. For `vision`, the plan must use `[256]` (the neutral/default sentinel) and **per-image `maxNewTokens` controls actual generation**. This avoids implying that changing a generic token-budget matrix changes vision prompts. A future suite-specific axis can replace this transition convention.

Node vision is currently disabled; set `runtime: ["browser"]`. The image-capable ONNX/Transformers.js model is still subject to actual WebGPU memory and compatibility limitations, and this PR does not claim that Qwen3.5 multimodal has passed an end-to-end run.

## Why fixture JSON, not embedded images?

Plan files compose and schedule experiments. Fixture files own task identity, asset reference, question, expected response, scorer, trial count, and output ceiling. This lets you reuse the same visual test across models, plans, and machines without duplicating its definition.

```text
plan.json ──> fixture-a.json ──> public/artifacts/a.png
          └─> fixture-b.json ──> public/artifacts/b.svg
```

When the model passes the table test, that only proves visual chart extraction for the supplied fixture. Counting people, recognizing objects, interpreting spatial relationships, and understanding expressions each require distinct verified fixtures and scores.
