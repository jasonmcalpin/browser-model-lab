# Interactive character lab — Mara

## Purpose

The benchmark page now includes a manually operated dialogue workspace that drives the same worker/runtime and model cards as ordinary browser benchmarking. It is **not** a change to Code Gauntlet, its authoritative character progression or the production actor transport. It supports the intended exploration of Mara as a damaged character whose short- and long-term memory can be altered experimentally.

## Controls

- Model selected from active BML cards, or paste an experimental/archived full v3 JSON card. One model worker is loaded at a time.
- Per-reply maximum new tokens (64–1536), temperature (0–2, zero means greedy), recent uncompressed exchange-pair count (0–12), compression threshold (1–24 exchange pairs), and independent summary-generation cap (64–1024).
- Optional additional character direction; canonical Mara context remains present as the authoritative system instruction.
- Buttons to load/restart model, reset just the conversation, export entire transcript, summary, settings and metrics.

These are **output** token caps. They do not change model context-window length, runtime tensor allocation or desktop backend. The baseline production-fitness benchmark still uses its original 256 max new tokens; lab controls do not alter scored results.

## Memory semantics

The lab starts with the authored Mara character contract. After each user/reply pair, the transcript appends both turns. If the uncompressed pair count has reached `compressAfterPairs` and exceeds `recentPairs`, the system asks the **same model** to summarize the older pairs and prior summary. On successful summary generation, only the retained most-recent pairs are passed as verbatim short-term memory on the next reply; the older pairs remain exclusively in the visible/exported transcript. Failed compression retains the previous context instead of discarding information. All summaries are explicitly fallible and untrusted relative to character/world policy.

This makes it possible to explore losing references, confusing claims, incomplete recollection, and short-term versus long-term limitations on purpose. The character is damaged; memory loss isn't automatically a bug. Breaking established source records or granting progression remains a model failure, not a feature.

## Limits and follow-up

- The lab is an interactive manual exploration surface, not yet an automated factorial sweep or scored comparative dialog evaluation. A future dedicated `character` CLI should accept independently controlled context profiles, budgets, models and trials, recording these in comparable artifacts.
- Running the main benchmark simultaneously with the lab can consume substantial GPU memory. Avoid concurrent large-model runs.
- The lab keeps data in React component memory only until you export it. Reloading loses the session; no persisted player save or persistent BML conversation is created.
- The full transcript is retained locally for review and export, but **only** rolling summary, recent turns and current message are included in model generation after successful compression.
- The input and generated summary still consume context window tokens; an 8K context limit is not established by a generation cap.
- Larger models are experimental: running 3–4B ONNX assets through browser WebGPU may fail on GPU memory/buffer limits. Desktop-native backend support is a separate decision.
- Since model-produced summaries are untrusted, they are never treated as game facts or engine decisions. The prototype does not implement a strict summarization acceptance policy beyond size/presence bounds; therefore it is not yet production-safe character memory.

## Verification

The memory boundary, transcript retention, compression threshold, zero-recent-turn scenario, and invalid settings have deterministic unit tests. UI and model-loading behavior require runtime browser verification after the PR.
