# Active model cards

Every `*.json` file in this directory is an active Browser Model Lab candidate.

- `--candidate all` runs every card here in `runOrder`, then candidate-ID order.
- Add a card here to include a model in normal runs.
- Move a card to `../archive/` to remove it from normal runs without deleting its specification.
- Move an archived card back here to reactivate it.
- Exactly one card may set `"default": true`. If none does, the first sorted card is the default.
- Do not place unrelated JSON files in this directory.

Model cards reference a compatibility profile implemented by BML. Adding another model that fits an existing profile requires no source-code change. A genuinely new runtime/chat/tool protocol may require a new compatibility profile or adapter.
