---
name: requirements-review
description: Identify consequential omissions in substantial engineering requests before implementation, separating requirements essential to the intended outcome from justified improvements and optional ideas.
---

# Requirements review

Use for new capabilities, multi-component changes, unclear operational dependencies, or requests where satisfying the literal wording may not achieve the stated destination. Skip routine edits with well-defined contracts.

1. Establish the intended outcome, chosen destination, existing architecture, decisions, constraints, and authority. Read relevant project documentation and code when available. Do not replace the user's destination with an alternative.
2. Restate what is explicitly requested. Search the relevant authoritative contracts and their owners (including adjacent repositories/adapters when available) before declaring anything missing. Distinguish a contract that exists from evidence that its implementation or deployment satisfies it. Separate verified facts, assumptions, inaccessible sources, and unknowns; do not invent requirements.
3. Ask: **What necessary condition for achieving this outcome has not been requested?** Inspect interfaces and consumers, state and migrations, trust and authorization, configuration and deployment, runtime discovery, capacity, resource ownership and cleanup, failure and recovery paths, compatibility, and observable verification. Examine only categories relevant to the change.
4. First classify each candidate's **coverage status**, citing the source or evidence limit:
   - **Genuinely missing:** No applicable authoritative contract establishes the necessary behavior after checking available sources. If a relevant owner/source is inaccessible, mark the gap **unknown**, not missing.
   - **Existing but unverified:** An applicable contract exists, but implementation, integration, or deployed behavior has not been established. Request verification, not a duplicate specification.
   - **Already satisfied:** The applicable contract and relevant evidence establish the condition; do not restate it as new work.
   - **Unknown:** Relevant sources or evidence are unavailable or contradictory. Identify the owner and the narrow check needed to resolve uncertainty.
5. Separately classify any **remaining action** by priority:
   - **Required:** Without it, the requested outcome or an existing invariant fails. Identify the concrete failure mode and owning component.
   - **Recommended:** Justified by long-term operability or maintainability, but not required for the stated outcome. Explain the tradeoff.
   - **Optional:** A possible enhancement outside the current goal; do not inflate scope.
6. For genuinely missing required conditions, propose the smallest coherent addition to the requirements, with dependency owner, contract/invariant, and acceptance evidence. For existing-but-unverified conditions, propose only the necessary verification. For already-satisfied conditions, acknowledge them briefly or omit them from the findings. Surface material decisions before implementation; ask only when an unresolved choice changes the result.
7. Hand off architectural alternatives to `architecture-review`, observable regressions to `regression-fix`, and implementation evidence to `change-verification`. This review identifies missing requirements; it is not an approval gate or permission to implement extra features.

Deliver a concise set of findings with **coverage status** (missing / existing but unverified / already satisfied / unknown) and, where action remains, **priority** (required / recommended / optional), supporting evidence, consequence, owner, and acceptance criteria. Explicitly say when no material omissions were found. Avoid generic best-practice lists, speculative systems, and ceremonial process.
