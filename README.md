# Browser Model Lab

Browser Model Lab (BML) is a browser-local model qualification harness for testing small language models under real runtime constraints and determining what each model can reliably be trusted to do.

BML started as the Browser AI Benchmark inside [Code Gauntlet](https://github.com/jasonmcalpin/code-gauntlet). It is being extracted into an independent project so model runtime, compatibility, evaluation, diagnostics, recovery, and role qualification can evolve without being coupled to a game.

## Goals

BML answers more than "which model scored highest?"

It is designed to establish:

- whether a model can run in the target browser/WebGPU environment;
- which native chat and tool contracts the model actually uses;
- which tasks it performs reliably;
- why it fails particular tasks;
- whether failures are model, adapter, runtime, environment, tool, or harness failures;
- whether the runtime can recover cleanly after errors;
- the lowest useful generation budget for a capability;
- which roles a model is qualified for.

Example role dimensions include general interaction, scene/roleplay, instruction contracts, tool operation, agent control, evidence/security, and efficiency/reliability.

## Architecture

The intended dependency direction is:

```text
Evaluation suites
      |
      v
BML core contracts
      |
      v
Browser Model Runtime
      |
      v
Compatibility profile / adapter
      |
      v
Transformers.js + WebGPU model

Evidence
  -> deterministic scoring
  -> failure diagnostics
  -> role qualification
  -> artifacts and reports
```

Project-specific suites depend on BML. BML core must not depend on Code Gauntlet, Pantheon, or another consumer.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository status

BML is currently being extracted from Code Gauntlet. Until parity is demonstrated, Code Gauntlet remains the reference implementation.

Migration source:

- repository: `jasonmcalpin/code-gauntlet`
- benchmark subsystem: `apps/client/src/features/browser-ai-benchmark/`
- extraction baseline: recorded in [docs/MIGRATION.md](docs/MIGRATION.md)

The first milestone is behavioral parity: the standalone BML runner should produce equivalent qualification evidence for the same model set before the embedded Code Gauntlet implementation is removed.

## Run locally

Requirements: Node.js 22+, pnpm 10, Chrome, and a browser/device with WebGPU support for live model runs.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

## Model-card inventory

The active benchmark set is data-owned:

- `testing/*.json` — every JSON file is an active model card and is run by `--candidate all`;
- `archive/*.json` — inactive historical cards retained for later experiments or reuse;
- `schemas/model-card.schema.json` — the model-card contract.

Adding a model that uses BML's existing finite runtime/chat/tool primitives requires no registry or CLI code change: put the complete declarative adapter and generation settings in its card under `testing/`. Removing it from the active run means moving the card to `archive/`. Moving it back reactivates it.

A new model family or native protocol may still require a compatibility profile/adapter implementation; that runtime behavior remains code rather than per-model data.

Run every active card (the default behavior):

```sh
pnpm benchmark:browser-ai -- --machine mac-m4 --test all --budget all --cached
```

Run an arbitrary folder as a temporary test set without moving cards:

```sh
pnpm benchmark:browser-ai -- --machine mac-m4 --cards-dir experiments/my-three --test all --budget all --cached
```

The selected folder may be any repository subdirectory containing model-card JSON files.

Or run one active card by its candidate ID:

```sh
pnpm benchmark:browser-ai -- --machine mac-m4 --candidate qwen3-0.6b-q4f16-control --test all --budget all --cached
```

Artifacts are written under `docs/benchmarks/runs/`.

## Engineering guidance

This repository uses project-local Codex engineering guidance and task skills under `.agents/skills/`. They are adapted from [codex-engineering-guidelines](https://github.com/jasonmcalpin/codex-engineering-guidelines).

See [AGENTS.md](AGENTS.md) and [docs/ENGINEERING-GUIDANCE.md](docs/ENGINEERING-GUIDANCE.md).

## License

MIT. See [LICENSE](LICENSE).
