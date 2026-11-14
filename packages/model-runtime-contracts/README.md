# Model Runtime Contracts

**Status: pre-release contract package, staged for extraction to its own public repository.**

This package is intentionally independent of BML and Aether. It contains no
imports from either application and has no inference vendor or transport dependencies.
Its package entrypoint is `src/index.ts`. The declared contracts target browser
workers, Node workers, and external inference services.

The SDK defines three independently composable plugin kinds:

- **Engine**: probe available capabilities, load a model, stream generation,
  cancel work, tokenize when supported and dispose resources.
- **Protocol**: encode structured conversation into a model's prompt format
  and decode its output, including tool calls and character-specific metadata.
- **Loader**: recognize model formats and resolve model-specific load
  requirements. A loader is not an engine and cannot grant engine permissions.

A model card identifies the model, its quantization, preferred protocol, and
engine requirements; it never contains executable code. Plugin configuration
belongs in instance configuration (validated by its JSON Schema). Connection
secrets are supplied by the host, not embedded in a manifest, card or result.

## Registry behavior

`parsePluginManifest` rejects unknown schema/API versions, unknown fields,
unknown capability and permission names, unsafe entrypoint paths, and duplicate
declarations. `PluginRegistry` accepts **preloaded, trusted modules only**;
it does not dynamically import arbitrary code.

`checkEngineCapability` checks requested modalities, format, quantization,
and optional model availability *before* model loading. The engine may still
fail later; that is recorded as a runtime failure rather than a capability
qualification.

`PluginRegistry.openEngine` denies missing requested grants and returns an
`EngineLease`. The lease tracks and disposes sessions, including a best-effort
cleanup on failure. An engine can be held only through its lease.

**Important security boundary:** A manifest is a declaration, not a sandbox.
The in-process registry checks declared permissions, but cannot prevent an
untrusted JavaScript plugin from calling ambient APIs. The future plugin host
must enforce actual process/worker isolation, filesystem and network access,
credential scoping, and CPU/GPU quotas outside these contracts. Do not load
untrusted third-party plugins directly into the BML browser or Node process.

## Conformance

From BML's source tree, use `pnpm test`: the conformance tests in
`src/conformance.test.ts` are included in the ordinary CI suite. They verify
validation, grants, lifecycle, streaming and capability rejection using a fake
engine with no model downloads.

## Extraction

This folder is a temporary development home. To publish it independently,
move the directory to a new `model-runtime-contracts` repository, add a
package build/release workflow, and have BML depend on a pinned package
version. Aether should consume the **same** published contract rather than
importing anything from BML.

We intentionally have *not* linked BML's runtime code to this package yet.
The integration must implement a versioned adapter and preserve BML's existing
evaluation evidence and scoring invariants. No premature rewrite of the
Transformers.js runner is required.

See [Architecture](ARCHITECTURE.md).
