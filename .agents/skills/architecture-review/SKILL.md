---
name: architecture-review
description: Review multi-component designs or changes crossing architectural boundaries, including contracts, invariants, dependencies, compatibility, and migration. Not for trivial edits.
---

# Architecture review
1. Establish the destination, constraints, existing decisions, and authority. Read relevant code and architecture documentation.
2. Map component boundaries, data ownership, interfaces, trust boundaries, persistence, and failure semantics.
3. Distinguish current invariants from proposed changes, and identify consumers affected.
4. Compare viable designs against conceptual integrity, operability, maintenance, and migration cost.
5. Recommend one coherent design with dependency order, rollout or rollback strategy, and verification criteria.
6. Surface unresolved consequential decisions; state reasonable assumptions for minor uncertainty.

Deliver: recommendation, contract and invariant impact, dependencies, risks, and concrete validation criteria. Do not change code unless requested.
