# Headless Node/WebGPU benchmark runner

## Goal

Add a browserless Node benchmark path that exercises the same Browser Model Lab model cards, protocol adapters, benchmark cases, scoring, diagnostics, and artifact contract as the existing Chrome/WebGPU runner.

## Completed work

- Added a shared benchmark runtime-client contract.
- Kept the browser Web Worker client as one implementation of that contract.
- Added a Node runtime client using Transformers.js and the same model/runtime construction path.
- Generalized the model-runtime naming so it is not browser-specific.
- Made the core benchmark runner runtime-client-injected and browser-independent.
- Added a headless Node benchmark entrypoint and CLI.
- Added `pnpm benchmark:node-ai`.
- Reused the existing Vite dependency to bundle the TypeScript benchmark entry for Node; no new package dependency was added.
- Kept the existing benchmark cases, tool harness, scoring, diagnostics, and artifact format shared.
- Updated the CLI model-card inventory to accept schema v3 cards.
- Updated summary reporting so headless WebGPU runs can report WebGPU readiness from artifact environment metadata.
- Documented the headless runner in the README.

## Architecture decisions

The benchmark core does not import the browser Web Worker client. Browser UI injects `BenchmarkWorkerClient`; the headless runner injects `NodeBenchmarkRuntimeClient`.

The initial Node runner intentionally supports cached execution only. Browser Cache API semantics do not map directly to the native Node/Transformers.js cache, so `--cold` is rejected rather than simulated.

Vision qualification is skipped for the initial Node path. Text/model/tool compatibility is the first decision point; Node image fixture handling can be added after the text runtime is proven.

The Node path never falls back to Chrome. Runtime incompatibility is benchmark evidence and should remain visible.

## Significant files changed

- `src/benchmark/runtimeClient.ts`
- `src/benchmark/nodeRuntimeClient.ts`
- `src/benchmark/nodeBenchmarkMain.ts`
- `src/benchmark/modelRuntime.ts`
- `src/benchmark/benchmark.worker.ts`
- `src/benchmark/workerClient.ts`
- `src/benchmark/benchmarkRunner.ts`
- `src/benchmark/BrowserAiBenchmark.tsx`
- `src/benchmark/artifact.ts`
- `scripts/run-node-ai-benchmark.mjs`
- `scripts/model-card-inventory.mjs`
- `scripts/model-card-inventory.test.mjs`
- `scripts/browser-ai-benchmark-cli-lib.mjs`
- `package.json`
- `README.md`

## Verification

Repository CI should run typecheck, tests, and build after the PR is opened.

A real Node/WebGPU model run is intentionally not claimed from GitHub CI because successful native GPU execution depends on the local host/runtime. The first meaningful runtime verification should be run on the Mac M4 using the same active cards that have already been benchmarked in Chrome.

## Operational dependencies

- Node 22-class runtime used by the project
- Transformers.js 4.3.2
- native/headless WebGPU support exposed through the Transformers.js/ONNX runtime stack
- existing Hugging Face model cache
- Vite for bundling the TypeScript headless entry

No new package dependency was added.

## Deferred work / limitations

- headless cold-cache semantics
- Node vision fixture/rasterization path
- explicit artifact schema field for execution host if later needed
- llama.cpp or other local runtime adapters
- performance-equivalence conclusions until the same candidates are run in both Chrome and Node

## Resulting state

BML now has one benchmark core with two execution hosts: browser Web Worker/WebGPU and headless Node/WebGPU.

## Suggested next step

Run:

```sh
pnpm benchmark:node-ai -- --machine mac-m4 --candidate qwen3-0.6b-q4f16-control --test all --budget all --cached
```

If Qwen3 completes successfully, run the full active card set and compare Node versus Chrome initialization time, TTFT, throughput, validity, and scoring.
