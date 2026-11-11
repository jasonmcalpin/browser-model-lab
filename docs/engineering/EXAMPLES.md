# Examples of task contracts

These examples describe desired outcomes, not prescribed implementations.

## Regression: region completion

**Goal:** A player who finishes a region can advance to the next available region without a refresh.

**Constraints:** Existing saves continue to load; locked regions remain inaccessible; progress reconciliation remains deterministic.

**Evidence:** Regression reproduces before fix; completion CTA appears after final step; advance works; locked-region and legacy-save tests pass.

## Architecture: change an API response contract

**Goal:** Introduce a new response representation across service and client components.

**Constraints:** Define versioning and compatibility, document error semantics, identify all consumers and stored-state implications, plan migration and rollback.

**Evidence:** Contract tests, compatibility tests, integration checks, and documentation changes correspond to the agreed design.

## Refactor: shared persistence module

**Goal:** Consolidate duplicate persistence logic without changing existing saved-state behavior.

**Constraints:** Keep serialization, recovery, failure handling, and caller-visible API invariant.

**Evidence:** Characterization tests before/after, diff review, and targeted integration verification.

## Extend a feature that outgrew its original component

**Goal:** Extend a simple local form to support asynchronous validation, persistent drafts, and undo.

**Fitness decision:** Inspect whether the existing component still coherently owns all these responsibilities. If UI presentation, persistence policy, and async orchestration are accumulating together, identify where those concerns belong under the repository's current architecture. Do not introduce a framework merely because more state was added.

**Preserved contract:** Existing field behavior, validation messages, draft compatibility, accessibility, and error semantics remain stable unless explicitly changed.

**Intentional new behavior:** Asynchronous validation, saved drafts, and undo are specified and tested separately from the structural extraction.

**Evidence:** Existing behavior characterization; targeted contract and integration tests; save/reload and failure-path tests; an inspectable diff distinguishing structural moves from new behavior. If the original structure still fits, implement the feature without restructuring and document the reason.

## Verify a persistence consistency fix

**Goal:** Confirm a recovery operation persists a complete next-state snapshot and only publishes it to the application after successful persistence.

**Constraints:** The repository contract must say whether a rejected save leaves the old durable state intact. Current adapter behavior alone is insufficient evidence for all future implementations.

**Evidence:**
- A regression that demonstrably fails against the old split-write behavior.
- Successful save: the published state matches the durable snapshot.
- Rejected save: the old durable state and in-memory progression remain unchanged; pending-operation state resets. Where a backend can partially commit or return an ambiguous result, explicitly test or document its handling.
- Fresh application/repository initialization: serialization, schema validation, reconciliation, and hydration preserve recovery costs, accepted keys, progression, and assessment status.
- A test run whose overall status is reported truthfully even if unrelated tests or environment prerequisites fail.

**Review outcome:** Distinguish a production defect from a missing negative-path test, undocumented repository guarantee, or unverified reload path.

## Requirements review: missing runtime registration

**Goal:** Add a new set of MCP tools to an existing service.

**Potential omission:** Tool implementation does not imply deployment registration, authorization, or discoverability. Verify the intended runtime catalog and policy boundaries without creating an unrelated approval workflow.

**Evidence:** Compare the declared catalog to authenticated runtime discovery after deployment; test both authorized and denied invocations.

**Negative control:** A routine private variable rename should not trigger a substantial requirements review. A complete request should produce no invented requirements.

See [cross-project acceptance cases](REQUIREMENTS_REVIEW_CASES.md) for retrospective Taro, AI Gateway, AI Gateway Proxy, and Code Gauntlet scenarios and evaluation criteria.
