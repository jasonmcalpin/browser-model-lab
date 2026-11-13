# Mara dialogue: model size, output budget, context, and quantization

## Goal

Find a model capable of portraying Mara Venn in Code Gauntlet, with credible independent character behavior, accurate memory and knowledge boundaries, without requiring a hosted chat service. **Technical/tool scores are not a proxy for roleplay quality.** This is a deliberately separate evaluation track; no change to production model selection or Code Gauntlet behavior is authorized by a benchmark.

## Current baseline (2026-11-13 Mac M4)

Source: `docs/benchmarks/runs/20261113T140647Z_mac-m4_5f18d90809c2.json`, using MR1.

| Candidate | Technical fitness /120 | MR1 qualitative observation |
| --- | ---: | --- |
| Qwen3 0.6B | 70 | Repeats essentially the same response five times |
| SmolLM2 1.7B | 50 | Conversational but adopts false identity and altered absence |
| Qwen3.5 0.8B | 30 | Loses speaker/record perspective and identity |
| LFM3 1.7B | 80 | Strongest dialogue; verbose and occasionally treats false record as accepted |
| Bonsai 1.7B | 60 | Conflates player and character; stilted repetition |

These are single sampled transcripts, not statistically qualified roleplay rankings. MR1 currently uses **256 max new tokens per response**, irrespective of the ordinary CLI `--budget` flag. `--budget 512` alone therefore **does not test** whether more tokens improve Mara. Preserve this limitation in comparisons.

## Candidate experiment cards

`experiments/mara-dialogue/` contains pinned-in-repo experimental cards (distinct from active `testing/`).

- Qwen3 0.6B: small-model control; previous repetition failure.
- LFM3 1.7B: strongest current character candidate.
- SmolLM2 1.7B: baseline for identity drift.
- Qwen3.5 2B: archived candidate promoted into the *experiment only* to check whether larger capacity helps its weak 0.8B family.
- SmolLM3 3B q4f16: new 3B ONNX candidate; **loader/template compatibility and output quality are not yet verified**.
- Qwen3 4B q4f16: next-size 4B ONNX candidate; approximately 2.8 GB model weights, **resource and runtime fit unverified**.

All larger candidates are research candidates. The 3–4 GB **download or install footprint** does not equal live memory required: weights, activations, KV cache, runtime overhead, and GPU buffer limits contribute. The browser may fail even with ample system RAM; `std::bad_alloc` previously affected a smaller model. Test one model per worker/session and dispose it before loading another. A packaged desktop inference backend may eventually differ from browser WebGPU. Preserve actual backend identity in results.

### Current runnable baseline

From the repository root, after checking out this branch:

```sh
pnpm benchmark:browser-ai -- --machine mac-m4 --cards-dir experiments/mara-dialogue --candidate lfm3-1.7b-q4f16 --test production --cached
```

For each larger model, use the same command with its exact candidate ID. The current `production` suite includes the five-turn MR1 human-review transcript but **also executes the other production-fitness cases**. Start with LFM3 and test one new model at a time; large model downloads may be significant. The historical archived Qwen3.5 2B artifact may need a compatible worker/device and is not automatically considered qualified. Captured MR1 transcripts are in the full JSON artifact under `candidates[].productionFitness.maraRoleplaySample`.

### Experimental design needed to answer the causal question

**This is a specification for a dedicated character-profile runner, not functionality implemented by these model cards.** It should reuse the existing BML runtime clients, preserve the standard 120-point suite, and publish independently versioned roleplay artifacts. Do not fold subjective scores into production fitness.

Control for three factors independently:

| Dimension | Levels | Question |
| --- | --- | --- |
| Output budget | 128, 256, 512, 768 new tokens | Is the response being truncated or unable to finish? |
| Character context | A: current canon contract; B: structured identity, record, scene, relationship, epistemic boundaries; C: B plus short canonical dialogue examples | Does stronger conditioning reduce drift without formulaic repetition? |
| Model/artifact | same model at matched budget/context; then small 0.6–1.7B vs 2–4B | Does additional capacity buy role quality? |
| Quantization (secondary) | Same exact model/revision at q4 vs higher precision if an artifact/runtime exists | Is quantization responsible, independently of architecture? |

Use a fixed multi-turn MR1 conversation and at least one additional unseen scenario so few-shot examples do not trivially teach the answers. Keep response budget distinct from *input context-window capacity*. Report input tokens, context truncation, output token ceiling, time to first token, throughput, memory (when instrumented), load failure, per-turn output and conditioning template.

Keep the selected model's own sampling settings unchanged within a controlled comparison. Run multiple stochastic trials, with separate role-neutral reviewer notes and hard-rule checks; do not average incomparable technical scores. Hard failures: false acceptance of changed identity or 2-day absence, claims of unknown office operator, invented authority to unlock/progress, and loss of player-vs-Mara perspective. Qualitative rubrics: voice, responsiveness, independent agency, memory, pacing, in-world believability, and coherence. Record all unscored transcripts, including failures.

**Release decision:** promote a model to candidate character runtime only after it passes reveal/authority invariants, repeated multi-turn review and supported desktop/browser hardware envelope. Maintain authored dialogue and a fallback that works without any model.

## Follow-on implementation contract

Build a dedicated `character` benchmark mode with the above configurable matrix and explicit artifact identity (fixture revision, scenario, context-profile ID, output budget, model revision/quantization, trial number, backend), plus unit tests of context builders and run plans. This experiment card PR intentionally does not fabricate the ability to vary MR1 budgets through the existing CLI flag.

External model source references:
- https://huggingface.co/HuggingFaceTB/SmolLM3-3B-ONNX/tree/main/onnx
- https://huggingface.co/onnx-community/Qwen3-4B-ONNX/tree/main/onnx
