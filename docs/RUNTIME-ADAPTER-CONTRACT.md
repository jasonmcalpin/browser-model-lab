# Runtime adapter and endpoint contract

## Goal and compatibility

BML retains its current browser/WebGPU benchmark path as the default. The same canonical benchmark definitions, evidence classification, and deterministic scorers must be usable against external inference services without making BML depend on Ollama, llama.cpp, or any consumer's orchestration.

This document specifies a future extension, **not an implemented CLI feature**. Existing `benchmark:browser-ai` behavior and model-card schema v3 remain unchanged until migration and parity tests are in place.

## Runtime selection

A run selects a **runtime profile**, a **model deployment**, and a **benchmark suite** independently.

- Default (no runtime flag): existing browser runner, active cards from `testing/*.json`, and existing test selection semantics.
- External runtime: explicitly select `ollama`, `llama-cpp`, or `openai-compatible`, an endpoint URL, and model identifier. Suite defaults to the existing standard suite.
- Runtime identity and wire protocol are separate: Ollama can expose its native or OpenAI-compatible protocol; llama.cpp may expose an OpenAI-compatible protocol.
- Endpoint URLs, credentials, hostnames, ports, and deployment-specific settings are **run configuration**, never intrinsic model-card identity. Store credentials in protected environment/secret references; redact them from evidence.

Illustrative future configuration (not currently accepted by the CLI):

```json
{
  "runtime": "ollama",
  "protocol": "ollama-native",
  "endpoint": "http://127.0.0.1:11434",
  "model": "qwen3:8b",
  "suite": "standard"
}
```

An external endpoint must be explicitly configured and permitted by network policy. Validate URL schemes, redirect behavior, target allowlists, and timeouts; never let untrusted cards trigger arbitrary network requests. Prefer localhost by default; remote targets require explicit opt-in.

## Canonical adapter interface

A runtime adapter translates transport, formatting, and lifecycle mechanics without changing benchmark semantics:

- `discover(config) -> RuntimeInventory`: report reachable service, runtime/protocol version if available, model identifiers, and discovered capability claims with provenance.
- `prepare(config, model, requirements) -> Session`: validate capabilities, resolve effective settings, and initialize resources; unsupported requirements yield an explicit skip/unavailable result, not a model failure.
- `generate(session, canonicalTurn, generationConfig) -> CanonicalResponse`: map canonical messages, tool schemas, and optional structured-output contracts to the selected protocol, then normalize response/tool calls.
- `cancel(session, requestId)` and `dispose(session)`: enforce bounded cancellation, timeouts, resource ownership, and recovery between cases.
- `observe(session) -> RuntimeTelemetry`: report available timings, token counts, memory/resource metrics, and their measurement provenance; missing metrics remain unknown.

Native chat templates belong to the server when supported. Do not inject browser-specific delimiters into external runtime prompts by default. The adapter must distinguish unsupported features from malformed output and runtime/transport failures.

## Model cards and benchmark evidence

Keep model identity, model format/quantization, declarative compatibility information, and runtime support separate from deployment endpoints. Existing schema-v3 browser cards remain valid; evolve via an explicit versioned schema and migration rather than weakening v3 validation.

BML consumes most card data as configuration; the model only receives relevant task input, instructions, and tool/output contracts. Benchmark evidence records model revision/digest when available, runtime and protocol, adapter version, machine/hardware, effective inference settings, suite version, raw outputs, scorer version, and failure classification. Unknown specifications or untested capabilities must never be represented as demonstrated.

## Evaluation invariants

- Keep semantic test fixtures and scoring consistent across runtimes; record unavoidable runtime-specific deviations.
- Preserve distinctions between model failure, resource failure, adapter failure, tool failure, harness failure, unsupported capability, and unavailable endpoint.
- Never score connection failures or unsupported API features as model incompetence.
- Recovery tests must prove that a failed or cancelled case does not poison subsequent cases.
- Repeated runs are distinct evidence; do not collapse hardware-specific results into a universal score.

## Validation and acceptance

Before enabling the extension: retain browser baseline parity; test endpoint discovery, model selection, unsupported capabilities, native versus compatible protocols, auth/redaction, timeout/cancellation/recovery, malformed outputs, and deterministic scoring equivalence. Exercise at least one real Ollama or llama.cpp endpoint when available and label unverified adapters accurately.
