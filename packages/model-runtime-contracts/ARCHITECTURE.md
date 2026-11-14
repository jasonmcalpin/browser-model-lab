# Plugin architecture and boundary contracts

## Ownership

- **SDK (public):** manifest syntax, plugin kinds, wire-neutral messages, typed
  events, engine sessions, capability negotiation and conformance.
- **Engine packages (public):** Transformers.js, LM Studio/OpenAI-compatible HTTP,
  llama.cpp and Ollama adapters. Engines manage resources, not scoring.
- **Protocol packages (public):** tokenizer templates, Qwen tool protocols,
  Extended Alpaca and Violet mood/dialogue formats. Protocols translate
  conversations, not model inference.
- **BML (public):** fixtures, benchmark planning, test execution, scoring,
  artifact writing and model capability catalog.
- **Aether (private):** agent lifecycle, tool execution, environment and secret
  policy. It consumes SDK contracts and BML qualification artifacts.
- **Pantheon/Taro:** orchestration and knowledge respectively, outside the SDK.

## Interface invariants

1. A plugin's manifest version and contract API version are separate.
2. A manifest never contains executable setup or arbitrary code fields.
3. Models, engines, protocols and evaluations have independent identities.
4. The same model can have several engine-specific execution profiles.
5. Capability declarations are not qualification results. BML must measure
   capabilities; unsupported/blocked/unmeasured/failed are distinct states.
6. A host rejects incompatible capability requirements before allocation.
7. Generation events preserve textual deltas, tool call boundaries,
   utilization and termination, without assuming a particular provider.
8. Content assets are referenced via `assetRef`; binary payload materialization
   belongs at the engine transport boundary, never in durable BML evidence.
9. Plugins cannot write evaluation plans or results. Only the host's evidence
   writer persists results.
10. The host enforces actual isolation and permissions. An in-process manifest
    parser is never itself a security boundary.
11. Plugin failures are isolated from other sessions, and the host must
    retain failure evidence and resource-cleanup information.
12. Engine-provided token metrics are tagged with tokenizer/engine provenance,
    since token counts across runtimes may not be comparable.

## Logical lifecycle

`discover -> validate -> authorize -> probe -> qualify -> load -> generate -> dispose`

- **Discover:** host resolves installed plugin from explicit allowlisted
  locations and signed/pinned package identity (transport implementation).
- **Validate:** manifest parser and JSON configuration schema.
- **Authorize:** user/organization policy grants least-privilege permissions.
- **Probe:** engine returns current capabilities and supported formats.
- **Qualify:** host verifies requested model, format and operations.
- **Load:** creates a bounded model session.
- **Generate:** cancellation-aware events; eventual usage and finish event.
- **Dispose:** sessions, engine and isolated worker/process are shut down.

## Distribution and compatibility

The shared package will ultimately be versioned independently with stable
`apiVersion`. Plugins declare supported environments. Major contract changes
require an explicit compatibility adaptor or a rejected load, never coercion.
Protocols should be configurable with declarative data when possible.
Executable protocol plugins are reserved for genuinely special behavior.

A plugin installed in BML should *not* become automatically executable by
Aether: Aether must independently authorize the module, grants and runtime
environment. BML capability catalogs are advisory input to Aether selection
policies, not authority to execute unknown code.

## First integrations

1. Wrap BML's existing Transformers.js runtime with the engine session contract
   (do not change test fixture or result schemas as part of this migration).
2. Implement generic OpenAI-compatible HTTP engine as a separately installable
   provider; LM Studio is the first deployment configuration.
3. Migrate Violet's prompt format and Qwen protocols behind protocol interfaces.
4. Add SDK conformance tests for provider plugins and publish capability
   qualification artifacts for Aether consumption.

**Not yet implemented:** executable third-party plugin discovery, sandboxed
workers/processes, signed distribution, real provider integration, or Aether
adaptation. This initial package provides contracts and host-side lifecycle
logic only; those components require their own verified implementations.
