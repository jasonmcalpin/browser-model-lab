---
name: regression-fix
description: Diagnose and fix an observable behavior regression while preserving established contracts and adding appropriate recurrence protection. Not for new features.
---

# Regression fix
1. Establish expected versus actual behavior, triggering conditions, and evidence for the expected contract.
2. Trace the causal path and confirm the suspected cause.
3. If practical, add a focused reproduction that fails before the fix. Otherwise document reproducible manual steps.
4. Correct the cause while reviewing impacted callers, state, persistence, and error semantics.
5. Run the regression and relevant nearby tests. Ensure tests really exercise the reported failure.
6. Summarize cause, patch, verification, and any remaining uncertainty.

Do not use a passing test as evidence for behaviors it does not exercise.
