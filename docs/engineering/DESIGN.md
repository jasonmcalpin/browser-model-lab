# Design rationale

## Layers

- **Always-on rules (`AGENTS.md`):** short behavior defaults that apply to most engineering tasks.
- **Task skills (`SKILL.md`):** narrowly triggered procedures with specific inputs and outputs.
- **Project context:** authoritative architecture, commands, domain concepts, and acceptance contracts remain in the target repository.

Do not copy skills into `AGENTS.md`; that would burden every interaction with irrelevant procedural detail.

## Adaptation decisions

This adaptation is inspired by the four principles in [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills), but makes two intentional shifts:

1. **Simplicity means conceptual integrity**, including justified abstractions for long-lived systems, rather than minimizing line count by default.
2. **Surgical scope is dependency-aware.** Contract changes may correctly require coordinated updates across callers, tests, persisted formats, and documentation.

A fifth emphasis—respecting established architectural decisions—reduces silent model-driven design drift.

## Requirements completeness before design

The `requirements-review` skill checks whether a substantial request omits conditions necessary to achieve its intended destination. It classifies findings as required, recommended, or optional, and does not authorize unrequested scope expansion. This complements `architecture-review` (evaluating design choices), `regression-fix` (diagnosing failures), and `change-verification` (checking delivered behavior). It is not a mandatory gate for routine changes.

## Architectural fitness during feature evolution

A first implementation can be intentionally simple and correct for its original requirements. As responsibilities accumulate, that structure can stop matching the feature. For substantial extensions, the always-on guidance requires a proportional fitness assessment; the `refactoring` skill supplies the detailed procedure when real structural pressure exists.

The decision is **not** automatically to refactor: retain the current structure when it still fits. When it does not, integrate bounded, behavior-preserving restructuring into feature work, keeping intentional new behavior separately specified and verified. This preserves the distinction between structural refactoring and wider feature delivery or optimization.

## Non-goals

- Enforcing security boundaries, permissions, or CI policy.
- Replacing project architecture documentation or developer review.
- Making every trivial edit follow a heavyweight checklist.
- Automatically synchronizing guidance or skills across repositories.

## Quality signals

Review whether changes have a traceable reason, match acceptance criteria, avoid irrelevant refactors, preserve documented contracts, and provide truthful verification evidence. Evaluate on representative real tasks; do not assume improved outcomes simply because the text is installed.
