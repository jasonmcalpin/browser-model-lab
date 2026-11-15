# Browser AI Benchmark V2 Run Summary

- Generated: 2026-11-15T02:02:20.217Z
- Machine: mac-m4
- Commit: 47c64abbdca704accfb3c34abd0e43ac16cca45c
- WebGPU device: ready

| Candidate | Runtime | Compatibility | Validity | Vision | Envelope | Production | G1 | 256 | 512 | 768 | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| qwen3-0.6b-q4f16-control | text-generation / q4f16 | COMPATIBLE | VALID | not run | 7/7 hard; 2 unknown | 60/120 | not run | not run | not run | not run | none |

## Role and failure diagnostics

- **qwen3-0.6b-q4f16-control** — probes not run; general-game=PARTIAL(0.5/1); scene-roleplay=WEAK(1/4); instruction-contract=STRONG(1/1); tool-operator=UNMEASURED(0/0); agent-control=UNMEASURED(0/0); evidence-security=WEAK(1/4); efficiency-reliability=UNMEASURED(0/0); failure dimensions: context-isolation×1, verification-discipline×1, state-continuity×1, evidence-grounding×1, honest-uncertainty×1, instruction-negation×1
