# Active model cards

Every `*.json` file directly in this directory is an active Browser Model Lab candidate. Subdirectories are not included in automatic benchmark discovery.

- `--candidate all` runs every card here in `runOrder`, then candidate-ID order.
- Add a card here to include a model in normal runs.
- Move a card to `../archive/` to remove it from normal runs without deleting its specification.
- Move an archived card back here to reactivate it.
- Exactly one card may set `"default": true`. If none does, the first sorted card is the default.
- Do not place unrelated JSON files in this directory.

Model cards reference a compatibility profile implemented by BML. Adding another model that fits an existing profile requires no source-code change. A genuinely new runtime/chat/tool protocol may require a new compatibility profile or adapter.

## Character comparison candidates

- `140-qwen3-4b-q4f16-character.json`: active Qwen3-4B ONNX `q4f16` card. Uses the existing declarative Qwen3 non-thinking profile; real browser inference is still to be measured.
- `pending/150-luna-7b-a4b-roleplay.json`: roleplay-focused Luna 7B/A4B, pending a supported runtime and exact compatible weights.
- `pending/160-infinityrp-v1-7b.json`: InfinityRP 7B, pending a supported runtime and its Extended Alpaca prompt contract.

See [pending candidate criteria](pending/README.md). The two pending
specialists remain in the testing selection set, but are **not** passed to
`benchmark:plan` until their backend contracts are implemented and verified.
