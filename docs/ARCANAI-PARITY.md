# ArcanAI six-model parity benchmark

**Status:** historical parity experiment. The subsequent [ArcanAI runner integration](ARCANAI-INTEGRATION.md) makes ArcanAI the default for text-generation on both browser and Node, with native rollback in Node. Historical comparisons remain valid.

## Why a shared runtime first?

This test isolates the cost of routing through ArcanAI, not the cost of changing model engines. In both modes, BML uses its existing Transformers.js version, initialized weights, tokenizer, model-card v3 compatibility profile, prompt rendering, tool parsing, task fixtures and scoring. The `--executor arcanai` path dispatches the prepared invocation through ArcanAI's canonical execution card and the `@arcanai/plugin-transformersjs` runtime port, then uses the same BML scorer. The adapter understands Transformers.js options, not individual model families.

This temporary bridge is a controlled transition: **ArcanAI is the eventual canonical execution-card owner**, but historical BML v3 cards and artifacts remain unchanged until semantic parity is established. Once verified, move their execution configuration into ArcanAI cards and have BML consume them directly. Do not maintain duplicate card inventories indefinitely.

## The six model candidates

Run against `experiments/mara-dialogue/`, which currently includes these six candidates:

| Model | Runtime |
| --- | --- |
| Qwen3 0.6B | Transformers.js pipeline / WebGPU |
| LFM3 1.7B | Transformers.js pipeline / WebGPU |
| SmolLM2 1.7B | Transformers.js pipeline / WebGPU |
| Qwen3.5 2B | Transformers.js direct-model / WebGPU |
| SmolLM3 3B | Transformers.js pipeline / WebGPU |
| Qwen3 4B | Transformers.js pipeline / WebGPU |

No plugin is installed or discovered automatically by either repo. The operator prepares both checkouts and their dependencies.

## Build the independent plugin

With adjacent local clones (`ArcanAI` and `browser-model-lab`):

```sh
cd ../ArcanAI
npm install
npm test
cd ../browser-model-lab
pnpm install
pnpm test
```

BML now pins the ArcanAI Git revision in package.json. There is no longer a sibling-checkout runtime loader or `BML_ARCANAI_ROOT` requirement; project dependency installation is handled by the normal `pnpm install` workflow. These commands record the earlier comparison methodology.

## Run paired trials

Start with one small candidate, then use `--candidate all` when the integration is known to work. Keep the same `--machine` and BML Git revision on both executions. Cached mode is required for the current Node runner.

```sh
# ArcanAI dependency is pinned in package.json; no environment path needed
pnpm benchmark:node-ai -- --cards-dir experiments/mara-dialogue --candidate qwen3-0.6b-q4f16-control --test production --budget 256 --cached --skip-catalog --machine mac-m4 --executor native --output-dir .artifacts/parity/native
pnpm benchmark:node-ai -- --cards-dir experiments/mara-dialogue --candidate qwen3-0.6b-q4f16-control --test production --budget 256 --cached --skip-catalog --machine mac-m4 --executor arcanai --output-dir .artifacts/parity/arcanai
```

The output filenames include model, machine, executor, timestamp and short commit. Each artifact also records its `environment.executor`. Repeat in alternated order (native → ArcanAI → ArcanAI → native, then repeat) to limit thermal/cache-order bias. Use `--candidate all` for the six-model matrix.

Compute a comparison by passing alternating native and ArcanAI artifact paths (at least one pair):

```sh
pnpm benchmark:arcanai:compare -- .artifacts/parity/native/<native-file>.json .artifacts/parity/arcanai/<arcanai-file>.json --output .artifacts/parity/comparison.json
```

The script reports per-model production score differences and percentage changes in measured model time. It rejects mismatched machines, revisions, candidate sets, card identities, and profiles. It does not rewrite scored evidence. Use repeated paired trials before concluding any causal performance penalty; stochastic models can change token counts and generated text across otherwise equivalent runs.

## What this establishes — and what it does not

- A matching generation profile is necessary for score comparability; it is not evidence that every sampled output will be byte-identical.
- Plugin overhead is primarily invocation preparation, validation and dispatch; inference dominates on many local models. Compare both absolute milliseconds and percentage deltas.
- These first runs measure the **Node headless WebGPU path**, not necessarily the browser worker path. A browser A/B run and real hardware validation are separate next steps.
- No live benchmarks were executed in CI. Tests cover card bridge semantics and comparator integrity, not six GPU model loads.
- A failed model load or unavailable WebGPU adapter is a runtime/environment failure, not an ArcanAI speed regression.
- Existing benchmark vision handling is unchanged. The six-model test measures the text-generation path.
