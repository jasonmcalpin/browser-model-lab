# Runtime adapter and catalog architecture — 2026-11-11

## Goal
Extend BML's architecture to support benchmark execution against Ollama, llama.cpp, and OpenAI-compatible endpoints while preserving browser testing as the default.

## Completed work
Documented runtime/endpoint configuration, a canonical adapter lifecycle, portable model metadata, failure classification, and a single generated capability catalog.

## Findings and decisions
Current BML uses browser/WebGPU cards with schema v3 and a browser-only CLI. Avoid claiming external runtime support before implementation. Runtime and wire protocol are separate, and endpoints belong to deployment/run configuration, not model identity. BML owns evidence; Pantheon owns routing; Aether executes selected profiles.

## Significant files changed
docs/RUNTIME-ADAPTER-CONTRACT.md, docs/CAPABILITY-CATALOG.md, docs/ARCHITECTURE.md, README.md, AGENTS.md, and this worklog.

## Verification
Reviewed current README, architecture, AGENTS.md, model-card schema, and package scripts. Documentation-only changes; no executable tests run.

## Operational dependencies
Future external runtime support requires network access, service availability, credentials where configured, and endpoint security policy.

## Deferred work / limitations
No external adapter, new CLI flag, card schema migration, or catalog exporter implemented.

## Resulting state
Design documented for implementation after browser parity and contract validation.

## Suggested next step
Define versioned TypeScript interfaces and schema tests, then implement one external adapter without changing browser defaults.
