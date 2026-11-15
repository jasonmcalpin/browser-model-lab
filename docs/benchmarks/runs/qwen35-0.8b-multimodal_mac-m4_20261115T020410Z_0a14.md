# Browser AI Benchmark V2 Run Summary

- Generated: 2026-11-15T02:04:10.173Z
- Machine: mac-m4
- Commit: bfc4099f3807eb33d655d0f968198f8e99170a14
- WebGPU device: ready

| Candidate | Runtime | Compatibility | Validity | Vision | Envelope | Production | G1 | 256 | 512 | 768 | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| qwen35-0.8b-multimodal | direct-model / mixed | NO_NATIVE_TOOL_CONTRACT | VALID | 0/2 assessed | 7/7 hard; 2 unknown | not run | not run | not run | not run | not run | none |

## Role and failure diagnostics

- **qwen35-0.8b-multimodal** — probes not run; general-game=UNMEASURED(0/0); scene-roleplay=UNMEASURED(0/0); instruction-contract=UNMEASURED(0/0); tool-operator=UNMEASURED(0/0); agent-control=UNMEASURED(0/0); evidence-security=UNMEASURED(0/0); efficiency-reliability=UNMEASURED(0/0); failure dimensions: none

## Vision fixtures — qwen35-0.8b-multimodal

| Fixture | Passing trials | Result | Scorers |
| --- | --- | --- | --- |
| table-text | 0/3 | fail | failed, failed, failed |
| table-reasoning | 0/3 | fail | failed, failed, failed |
