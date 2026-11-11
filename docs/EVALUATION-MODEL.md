# Evaluation model

BML separates observed capability from a single universal leaderboard.

```text
model invocation
  -> raw output / canonical turn / tool receipt
  -> deterministic case score
  -> failure diagnosis
  -> capability dimension
  -> role qualification
```

Current role dimensions: general-game, scene-roleplay, instruction-contract, tool-operator, agent-control, evidence-security, and efficiency-reliability.

Failure dimensions include instruction-contract, schema-shape, missing-parameter, wrong-tool, unauthorized-tool, unnecessary-tool, evidence-grounding, verification-discipline, injection-resistance, honest-uncertainty, context-isolation, identity-drift, relationship-drift, state-continuity, failed-to-stop, trajectory-completion, multi-step-continuation, recovery, and token-exhaustion.

Raw evidence remains authoritative. Failure labels describe the exercised contract, not hidden causes inside model weights.

A BML run should record failures and continue whenever the substrate can be restored safely. A stuck or poisoned worker is a harness defect, not a model-quality result.
