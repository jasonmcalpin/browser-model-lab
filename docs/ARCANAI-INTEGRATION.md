# ArcanAI as BML's execution runner

## Default behavior

ArcanAI now owns dispatch of **text-generation requests** in BML's Node benchmark client and browser worker. BML still owns its deterministic test definitions, scoring, worker lifetime, model cache, and benchmark evidence. The Transformers.js runtime/weights and compatibility-profile prompt preparation remain unchanged during the migration, so historical benchmarks are not rewritten.

The ArcanAI SDK and provider adapter are a **pinned Git dependency** in `package.json`. BML does not discover or install plugins at runtime. A project owner must run `pnpm install` to resolve that dependency and commit the refreshed `pnpm-lock.yaml` after dependency changes.

ArcanAI validates the generated v1 execution section and selects an explicitly registered `@arcanai/plugin-transformersjs` instance. BML's existing v3 cards continue supplying model-specific profiles through a temporary migration bridge. Once their execution semantics have full parity (including prompted tools and multimodal data), the execution portion of the cards should be authored in ArcanAI's canonical schema and BML should read it directly; do not maintain two active execution schemas indefinitely.

## Commands

Normal headless Node benchmark (ArcanAI is now the default):

```sh
pnpm benchmark:node-ai -- --cards-dir experiments/mara-dialogue --candidate all --test production --budget 256 --cached --machine mac-m4
```

Explicit native rollback/comparison:

```sh
pnpm benchmark:node-ai -- --cards-dir experiments/mara-dialogue --candidate qwen3-0.6b-q4f16-control --test production --budget 256 --cached --machine mac-m4 --executor native
```

The browser worker automatically uses ArcanAI for text generation via the normal `pnpm benchmark:browser-ai` command and normal web UI. Browser token events, normal scoring, and worker cancellation remain BML responsibilities.

## Ownership

| Concern | Owner |
| --- | --- |
| Canonical v1 model execution schema and validation | ArcanAI |
| Explicit provider registration, provider options, generation dispatch | ArcanAI |
| Model runtime implementation, model initialization and tokenizer | Transformers.js runtime port (temporary BML bridge) |
| Benchmark fixture data, scores, worker recovery, vision fixtures, artifacts | BML |
| Dependency installation, updates, Git revision pin and lockfile | Project owner |

## Known limitations

- **Vision requests remain native** while ArcanAI's message/content protocol supports only text. This is explicit, not a silent fallback. Do not claim browser vision coverage is routed through ArcanAI.
- The old BML card v3 format is still the input for benchmark inventories; the bridge constructs the ArcanAI execution section. Migrating card ownership will be a separate parity-preserving change.
- The optional `--executor native` CLI is a regression/rollback path, not a second new API.
- BML's model initialization is presently performed by BML and passed into the plugin through a runtime port; moving complete ownership into the plugin requires equivalent preparation/teardown and cache contracts.
- All previous raw benchmark artifacts are immutable. New artifacts identify the executor, and any old artifact without that field is a legacy native observation.
- Tests use synthetic runtimes and GitHub CI. Full six-model browser/WebGPU parity and actual hardware are to be verified on the target Mac before removing the native comparison path.
- The Git dependency is pinned; do not silently upgrade it or allow runtime code to install packages.

## Aether handoff

Once BML's ArcanAI path is validated, Aether should consume the **same ArcanAI public SDK and model cards**, register its own plugin instances, and own its jobs, agent orchestration, retries and recovery. Aether must not import BML's benchmark internals. Use the ArcanAI plugin contract and conformance tests rather than embedding a BML-specific adapter in Aether.
