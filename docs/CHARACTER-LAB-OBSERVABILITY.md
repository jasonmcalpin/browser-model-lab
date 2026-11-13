# Character Lab observability — experiment contract

## Goal

Expose what Mara's local model **actually received, generated, and retained** without adding instrumentation noise to the browser console or altering Code Gauntlet. Recorded evidence is inspected in the Character Lab UI and exported as JSON.

## User-visible behavior

- Every assistant turn can open an inspector with wall-clock started/completed timestamps, generated token count, first-token latency, generation latency, tokens/s, and model termination classification.
- The inspector preserves exact request messages, the model-specific rendered tokenizer prompt when accessible, tokenizer prompt token count when `encode` succeeds, applied generation settings, requested lab settings, and a timestamped sequence of context assembly/tokenization/generation/compression events.
- Per-section role/summary/recent-user allocations are labelled **estimates** (characters/4). The rendered-prompt token count, if available, covers the actual chat template and is distinct from those estimates. When tokenizer counts are unavailable, the UI says so; no estimates are falsely called exact.
- Recent-only memory retains at most the configured recent exchange pairs; rolling memory compresses older turns; full memory uses the full transcript; none sends only the role and current input.\n- The lab has a configurable **context target**. This is a preflight budget guard, **not a runtime context-window reconfiguration**. If model tokenization returns an exact count exceeding the target after output reserve, inference is rejected; even if within target, runtime/device capacity is not guaranteed.
- Character contract, summary, recent turns, current input, and output reserve have distinct UI accounting. A role or summary allocation smaller than the estimated text fails preflight rather than quietly truncating the authored character or memory.
- Controls include output budget, temperature, top-p, top-k, min-p, repetition/presence penalties, sampled/greedy decoding, supported thinking-mode override, memory strategy (rolling/full/recent/none), compression interval, recent exchange count, context/role/summary allocations, summary output cap, and manual/automatic compaction.
- The same model generates the summary. Summary text can be examined and deliberately edited. Short-term and long-term memory can be reset independently without rewriting the full review transcript.
- Import a previous experiment JSON and either inspect its saved session or replay its user prompts sequentially through the **currently loaded** model and **current** controls. Replay generates a new transcript; it does not silently reuse previous assistant replies. The UI offers a side-by-side comparison of imported and regenerated responses.
- Export includes model card identity, all settings, transcript, memory, generated trace, load metrics, and timeline events. Browser refresh still drops the active session unless exported.

## Deliberately not fabricated

- Stable random seed (no adapter contract or backend control yet)
- Precise GPU/CPU peak allocation (not instrumented)
- Separate prefill measurement (current runtime only returns first-token and total generation latency)
- True configurable model context allocation (model/device-specific)
- Exact per-section tokenizer counts (only per-request rendered-prompt count can be measured; section estimates remain estimates)
- Guaranteed sampling knob support: the adapter passes the controls to Transformers.js; a particular model may reject or ignore them. Applied invocation is captured for investigation.
- Thinking-mode override is available only for model profiles exposing the `enable_thinking` tokenizer setting. Unsupported profiles reject the override rather than silently applying it.

## Correctness and safety

No new `console.log` calls are required. The trace store is session-local, not a remotely published telemetry feed. Player claims, model summaries and generated responses are non-authoritative. Existing code-gauntlet validators, progression, AI character host, and character-memory design remain unchanged.

## Verification

Automated contracts test memory strategy selection, transparency/provenance of estimated versus measured values, boundary checking, and trace retention. CI checks typecheck/test/build. Real WebGPU model behavior, exact tokenizer availability, GPU memory envelope, and UI ergonomics still require local Mac testing.

## Dependencies

This PR is stacked on the earlier interactive lab PR #12. Merge #12 first, then rebase/retarget this branch onto main before merging. The experiment card PR #11 is independent.
