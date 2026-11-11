# Browser Model Lab architecture

## Destination

BML qualifies browser-local language models against explicit runtime, compatibility, behavioral, recovery, and role contracts. It is independently runnable and reusable by consumers without importing consumer application code.

## Layers

```text
CLI / Browser UI
      |
Evaluation orchestration
      |
generic suites + consumer suites
      |
Canonical BML contracts
      |
Compatibility profile / adapter
      |
Browser Model Runtime
      |
Transformers.js + WebGPU

Observed evidence
  -> deterministic scorers
  -> failure diagnostics
  -> role qualification
  -> versioned artifact + human summary
```

## Ownership

**Core contracts** own canonical messages, tools, turns, settings, trial evidence, failure classes, roles, and artifact schema.

**Browser Model Runtime** owns initialization, WebGPU execution, workers, cancellation/cleanup, cache ownership, and environment observation. It never decides semantic success.

**Compatibility** owns model-family prompt placement, native templates, tokenizer options, tool syntax, reasoning controls, and normalization back to canonical turns. Adapters translate syntax, not semantics.

**Suites** own task semantics, deterministic fixtures, scorers, and role evidence. Generic suites use domain-neutral concepts. Consumer suites may use their own vocabulary but depend only on public BML contracts.

**Diagnostics** are deterministic projections over stored evidence. They do not infer hidden model reasoning.

**Reporting** owns stable artifacts and summaries and must distinguish quality from integration, resource, environment, and harness failures.

## Planned multi-runtime extension

Keep browser/WebGPU as the default, but define backend-neutral benchmark execution and canonical adapter lifecycle for Ollama, llama.cpp, and OpenAI-compatible endpoints. Runtime identity, wire protocol, endpoint configuration, and model identity are separate concepts. External runtimes must preserve existing deterministic suite semantics, failure attribution, and evidence comparability.

BML generates a single versioned capability catalog from model cards, discovered metadata, and benchmark evidence. Pantheon consumes it for routing; Aether consumes selected execution profiles. Neither consumer's policy belongs in BML.

See [runtime adapter contract](RUNTIME-ADAPTER-CONTRACT.md) and [capability catalog contract](CAPABILITY-CATALOG.md). These are planned interfaces, not implemented runtime features.

## Failure invariant

A failed case must not corrupt the execution substrate for later cases.

```text
dispatch -> observe -> classify -> cleanup -> retry/recover/reroute -> continue
```

Classify at least MODEL_FAILURE, RESOURCE_FAILURE, ADAPTER_FAILURE, TOOL_FAILURE, and HARNESS_FAILURE. Retryability is separate.

## Consumer boundary

Code Gauntlet and Pantheon may consume BML artifacts or provide suites, but BML must not encode their routing policy or orchestration internals.
