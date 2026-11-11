---
name: refactoring
description: Assess architectural fitness and restructure existing code when maintaining or materially extending a feature, modernizing an implementation, or optimizing behavior; also use for standalone behavior-preserving refactoring. Avoid speculative cleanup.
---

# Refactoring and architectural fitness

## Choose the mode
- **Standalone:** the requested outcome is improved structure with no intended observable behavior change.
- **Integrated:** the requested outcome is a feature extension, modernization, or performance change that may make the existing structure unfit. Assess the current design before deciding whether to refactor.
- For a trivial localized change without structural pressure, leave the design alone. Do not force a refactor.

## Assess fitness against the destination
1. Identify the new or existing capabilities and their lifecycle requirements. Read applicable project architecture, decisions, and code.
2. Inspect current responsibility ownership, data flow, public interfaces, persistence, callers, dependencies, and tests.
3. Check for evidence of structural pressure: multiple unrelated responsibilities, duplicated behavior, special-case proliferation, crossing ownership boundaries, dependency inversion, difficult extension points, or incompatible operational needs.
4. Decide **retain**, **extend within existing boundaries**, or **refactor as part of the requested change**. Explain the actual pressure and the smallest coherent target architecture. Do not optimize for line count or hypothetical future requirements.

## Execute with explicit behavior boundaries
5. Define a preservation contract for existing behavior: APIs, persisted formats and migrations, errors, performance constraints, and user-visible outcomes. For integrated work, separately enumerate the intentional new or changed behavior.
6. Add characterization/contract coverage where existing invariants are exposed to risk. Where practical, distinguish mechanical restructuring from behavioral changes in commits or reviewable diff sections; coordinated changes can remain in one PR when necessary.
7. Make only structural changes justified by the destination and its dependencies. Preserve external compatibility unless explicitly authorized; if behavior must change, document it as a contract change rather than calling it refactoring.
8. Verify old behavior, new capabilities (integrated mode), interfaces, migrations, and relevant performance metrics where applicable. Inspect the complete diff for accidental or unrelated changes.
9. Report the structural decision, changed ownership or dependencies, intentional behavioral differences, verification evidence, and unresolved risk. If no refactor was warranted, say why.

Do not equate modernization with replacing libraries or adding abstractions. A working feature can still require restructuring when its responsibilities change; an initially simple implementation does not automatically require it.
