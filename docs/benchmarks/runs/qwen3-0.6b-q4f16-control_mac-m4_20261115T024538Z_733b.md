# Browser AI Benchmark V2 Run Summary

- Generated: 2026-11-15T02:45:38.091Z
- Machine: mac-m4
- Commit: f0d2de8189ce86b60a8da8b9e6216994f0bf733b
- WebGPU device: ready

| Candidate | Runtime | Compatibility | Validity | Vision | Envelope | Production | G1 | 256 | 512 | 768 | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| qwen3-0.6b-q4f16-control | text-generation / q4f16 | COMPATIBLE | VALID | not run | 7/7 hard; 2 unknown | 90/120 | not run | not run | not run | not run | none |

## Role and failure diagnostics

- **qwen3-0.6b-q4f16-control** — probes not run; general-game=STRONG(0.75/1); scene-roleplay=STRONG(4/4); instruction-contract=STRONG(1/1); tool-operator=UNMEASURED(0/0); agent-control=UNMEASURED(0/0); evidence-security=WEAK(1/4); efficiency-reliability=UNMEASURED(0/0); failure dimensions: verification-discipline×1, evidence-grounding×1, honest-uncertainty×1
