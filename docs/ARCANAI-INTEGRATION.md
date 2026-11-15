# ArcanAI as BML's model execution engine

## Ownership

ArcanAI now implements the Transformers.js runtime adapters for BML's browser worker and Node benchmark paths. The provider plugin handles:
- Declarative pipeline and direct-model loading, including tokenizer/processor and quantization configuration
- Model inference, structured request settings, cancellation and streamed token observation
- Vision-capable Qwen3.5 processor and image preprocessing
- Runtime disposal and provider-specific implementation details

BML remains responsible for benchmark definitions, fixtures, scoring, telemetry/evidence, worker lifecycle, run artifact generation, and comparison/qualification. It does not own vendor-specific model loader implementations.

## Cards during the migration

ArcanAI owns the canonical execution-card contract. BML historical v3 candidate cards remain available for reproducibility. `arcanaiCardBridge.ts` maps their execution settings into a validated ArcanAI v1 execution card (including a declarative `runtime` section). This is a temporary data migration bridge; do not expand it into another model engine.

The browser and Node runners use a pinned Git revision of ArcanAI recorded in package.json and pnpm-lock.yaml. Dependencies are always maintained by the project owner with pnpm. ArcanAI does not install or upgrade plugins. Aether will later consume the same cards and plugins without importing BML.

## Running BML

Normal Node execution (ArcanAI is the default):

```sh
pnpm benchmark:node-ai -- --cards-dir experiments/mara-dialogue --candidate all --test production --budget 256 --cached --machine mac-m4
```

Normal browser/WebGPU execution (ArcanAI is the default for text and vision):

```sh
pnpm benchmark:browser-ai -- --candidate qwen35-0.8b-multimodal --test vision --cached --machine mac-m4
```

Node's explicit `--executor native` remains as a rollback/comparison route and uses the same ArcanAI-loaded runtime instance while bypassing ArcanAI dispatch; it is **not** a second BML-owned model engine.

## Validation contract

- All current text and vision fixtures must preserve scoring semantics and required observable fields.
- Exercise success, unsupported capability, abort, malformed model output, and recovery followed by another request.
- Confirm the same card/profile produces equivalent effective settings in browser and Node.
- Preserve immutable historical benchmark artifacts, and identify execution paths in new evidence.
- Check GPU execution on a real Mac before claiming end-to-end WebGPU/vision parity. CI's fake runtimes and browser build do not prove working device execution.

## Remaining migration

The current BML v3 card inventory and generic compatibility-profile invocation preparation remain in BML's migration bridge. The **destination** is a single ArcanAI-owned model-card execution schema and generic preparation/normalization logic, shared by BML and Aether. These should move without modifying benchmark scoring, historical raw evidence, or silently changing tool-call formats.

Aether integration is deliberately deferred until BML's end-to-end acceptance tests pass on the Mac.
