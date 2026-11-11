# Requirements-review acceptance cases

These cases are drawn from engineering work across Taro, AI Gateway, AI Gateway Proxy, and Code Gauntlet. They are **retrospective scenarios**, not proof that the new skill would have prevented the incidents. Prompts are reconstructed to isolate decision points; they are not claimed to be verbatim historical prompts. The observations are known from project discussions and deployment diagnostics, not from an independent audit of each repository.

Use each case as an evaluation prompt **before revealing the omission and expected findings**. Check whether the agent identifies a consequential requirement, names its owner and failure mode, proposes observable acceptance evidence, and avoids speculative scope expansion. It must first check existing authoritative contracts: **missing**, **existing but unverified**, **already satisfied**, and **unknown** are distinct coverage states. Only remaining actions receive required/recommended/optional priority.

## Case A — Taro MCP: feature implemented but absent at runtime

**Prompt to evaluate:** "Expose the next ten Taro MCP capabilities, including Vision lifecycle, history, comparison, and Knot restoration, using the existing deployment profile."

**Observed outcome:** New tools were implemented, but a running deployment still reported 22 registered tools. Registration of unrelated history/Knot capabilities was coupled to a creator-Vision feature flag.

**Expected required findings:**
- The authoritative tool catalog and feature registration must not accidentally depend on unrelated authorization policy.
- The deployment must reconcile the intended tool set with authenticated `tools/list` and fail visibly on missing required capabilities.
- Authorization must remain enforced at invocation, independently of whether the tool is registered.

**Evidence to seek:** Declared catalog versus authenticated runtime catalog, release diagnostics, and tests for creator-disabled versus creator-enabled behavior. A healthy `/health` response or successful build alone is insufficient.

**Out of scope:** A new permission model or a second approval workflow.

## Case B — AI Gateway deployment: temporary files exhaust inodes

**Prompt to evaluate:** "Add comprehensive integration tests and deployment packaging for Taro."

**Observed outcome:** Deployment failed with `No space left on device` although the SSD had ample free bytes. `/tmp` was at roughly 99% inode usage, with approximately 686,000 entries under `/tmp/taro-curation-locks`. The precise leak mechanism was not yet established.

**Expected required findings:**
- Temporary test fixtures, staging trees, and coordination resources need explicit lifecycle ownership and bounded accumulation.
- Tests and deployments must clean up on success and recoverable failure; crash-surviving locks need a safe reclamation contract.
- Packaging preflight should consider the filesystem and both byte and inode capacity.

**Evidence to seek:** Repeated-run before/after inode and entry counts, failure-path cleanup, concurrency-safe lock tests, deployment capacity checks.

**Out of scope:** Blind deletion of active locks or canonical state; asserting an unverified root cause.

## Case C — AI Gateway Proxy: multi-layer request limits

**Prompt to evaluate:** "Increase the MCP proposal-decision request size to 128 KiB."

**Observed outcome:** A full decision preparation exceeded a 64 KiB request limit; a smaller bounded preparation succeeded.

**Expected required findings:**
- Trace limits through the client, gateway/proxy, HTTP parser, application, and downstream service rather than changing one constant.
- Preserve bounded request handling, explicit oversize errors, and existing security limits.
- Test below, at, and above the intended limit with representative payloads.

**Evidence to seek:** End-to-end boundary tests and actual deployed request handling.

**Out of scope:** Arbitrarily unbounded payloads or a new transport architecture.

## Case D — Code Gauntlet: completion without a next action

**Prompt to evaluate:** "Implement the final encounter and region completion for a character campaign."

**Observed outcome:** A completed region left the player without a clear call to action to continue to Region 1.

**Expected required findings:**
- Completion has a user-visible next-state contract: CTA, destination, and gating.
- Existing saves and region unlock rules must reconcile consistently.

**Evidence to seek:** End-to-end completion path, navigation, locked-region checks, and legacy-save behavior.

**Out of scope:** Reworking the campaign narrative or adding a new progression system.

## Case E — Code Gauntlet: cross-campaign deck contamination

**Prompt to evaluate:** "Make tools available through the player's deck in each language campaign."

**Observed outcome:** The deck was initially universal, permitting JavaScript tools to be imported into TypeScript or Python campaigns, producing inconsistent behavior.

**Expected required findings:**
- Deck ownership/compatibility is part of the campaign contract, including import and saved-state hydration.
- Cross-campaign tools must be rejected or reconciled explicitly.

**Evidence to seek:** Import boundary tests, compatibility checks, and legacy-save behavior.

**Out of scope:** A shared global inventory redesign without a stated need.

## Negative control F — routine edit

**Prompt to evaluate:** "Rename a private local variable without changing behavior."

**Expected result:** No substantial requirements review. Respect existing scope; avoid generating unrelated architectural requirements.

## Negative control G — complete substantial request

**Prompt to evaluate:** "Add an authenticated MCP read tool. The catalog declares it; registration is unconditional for this deployment profile; invocation authorization is enforced by the existing adapter; transport size and error contracts are unchanged; deployment verifies authenticated discovery against the catalog; tests cover success, denial, and runtime registration."

**Expected result:** Verify assumptions against the repository, then report no material omissions if supported. Do not invent another gateway, role, configuration flag, or approval step.

## Control H — existing contract, missing runtime evidence

**Prompt to evaluate:** "The MCP host already has a documented tool catalog and authenticated registration contract. Review whether exposing a new history tool is sufficiently specified; the deployed runtime has not yet been checked."

**Expected result:** If the catalog and registration contract are found, classify the registration requirement as **existing but unverified**, not missing. Recommend authenticated runtime discovery and comparison to the declared catalog; do not request a second catalog or new registration design. If the host repository is inaccessible, classify coverage as **unknown** and identify the necessary lookup.

## Control I — existing contract and verified runtime

**Prompt to evaluate:** "Review the registration requirements for a tool already declared in the authoritative catalog and verified by authenticated discovery in the running release."

**Expected result:** If the cited contract and runtime evidence support the claim, classify registration as **already satisfied**, not a required addition. Continue checking only genuinely uncovered requirements. Do not equate a user's assertion of verification with independent evidence.

## Evaluation record

For each case record: Codex version/date; whether `requirements-review` was explicitly invoked or naturally selected; installed guidance/skill paths; relevant project context provided; omissions identified; coverage status and required/recommended/optional priority for remaining actions; duplicate-contract requests; false positives; and verification evidence. Mark outcomes **observed**, **unverified**, or **blocked**. Do not infer automatic skill invocation from a well-written answer.
