# Browser Model Lab engineering instructions

## Project authority

Browser Model Lab (BML) is a standalone browser-local model qualification harness. Its core responsibilities are runtime compatibility, deterministic evaluation, failure diagnosis, recovery evidence, role qualification, and artifact/report generation.

The project must remain consumer-independent:
- BML core must not import Code Gauntlet, Pantheon, or project-specific domain packages.
- Consumer-specific semantics belong in suites/fixtures that depend on public BML contracts.
- Model-family syntax belongs in compatibility profiles/adapters, never in semantic test cases.
- Raw evidence is authoritative; derived diagnoses and role ratings must remain reproducible projections over stored evidence.
- An unscored probe must never poison or abort scored evaluation. Every generation/tool/test path must restore worker/runtime state on success, cancellation, parser failure, adapter failure, model error, or runtime exception.
- Distinguish MODEL_FAILURE, RESOURCE_FAILURE, ADAPTER_FAILURE, TOOL_FAILURE, HARNESS_FAILURE, and retryability rather than collapsing them into a generic failure.
- Preserve historical artifact comparability. Schema changes are explicit and old artifacts are never rewritten in place.
- Extraction from Code Gauntlet is copy-first. Do not remove the Code Gauntlet implementation until standalone parity is demonstrated and accepted.

## Verification expectations

For runtime/harness changes, exercise at least successful generation followed by another generation; thrown generation followed by another generation; token-limit completion followed by another generation; malformed model/tool output followed by another case; and cancellation/recoverable failure followed by another generation where supported.

For evaluation changes, distinguish semantic task changes from scorer/projection/reporting changes. New diagnostic probes should be unscored unless deliberately promoted through a documented benchmark revision.

## General engineering defaults

Use these defaults unless a more specific repository instruction or explicit user requirement supersedes them. Apply effort proportional to risk.

### Establish intent before implementation
- Identify the requested outcome, architectural boundaries, contracts, invariants, and existing decisions.
- Inspect relevant code and tests before claiming how the system behaves.
- Separate facts from assumptions and unresolved decisions.
- Ask only when ambiguity materially changes the result and cannot be resolved from existing context.
- For substantial requests, surface consequential omissions needed to reach the stated outcome without silently expanding scope.

### Preserve conceptual integrity
- Prefer the least complex design satisfying lifetime and maintenance requirements, not the fewest lines of code.
- Reuse established vocabulary, ownership, interfaces, and error handling.
- Avoid speculative abstractions and configuration without a concrete need.
- Reassess architecture when feature responsibilities materially expand.

### Control scope while preserving dependencies
- Every changed artifact must trace to the goal or a necessary dependency.
- Avoid opportunistic cleanup and unrelated refactors.
- When changing a contract, examine callers, persisted data, tests, documentation, migration, runtime registration, and operational prerequisites.
- Own temporary resource lifecycles and cleanup paths.
- Never silently break observable behavior or compatibility.

### Deliver verifiable outcomes
- Define acceptance criteria before substantial implementation, including failure cases and compatibility where relevant.
- Reproduce bugs with a failing test when practical.
- Run relevant checks and inspect outputs; never claim verification that was not executed.
- Distinguish successful builds from verified runtime availability.

Task-specific skills in `.agents/skills/` supplement, not supersede, these defaults.
