# Active model cards

Every `*.json` file in this directory is an active Browser Model Lab candidate.

- `--candidate all` runs every card here in `runOrder`, then candidate-ID order.
- Add a card here to include a model in normal runs.
- Move a card to `../archive/` to remove it from normal runs without deleting its specification.
- Move an archived card back here to reactivate it.
- Exactly one card may set `"default": true`. If none does, the first sorted card is the default.
- Do not place unrelated JSON files in this directory.

Model cards reference a compatibility profile implemented by BML. Adding another model that fits an existing profile requires no source-code change. A genuinely new runtime/chat/tool protocol may require a new compatibility profile or adapter.

## Browser character candidates

- `170-gemma4-e2b-roleplay-q4f16.json`: [Gemma 4 E2B SFW Roleplay](https://huggingface.co/skillsafe-ai/gemma-4-E2B-it-roleplay-ONNX). Published Transformers.js `text-generation` + WebGPU `q4f16` recipe; real inference in BML remains unverified.
- `180-violet-1b4-chat-q8.json`: [Violet 1B4 Chat](https://huggingface.co/zakarth/violet-1b4-chat-onnx). GPT-NeoX `model_quantized.onnx` with direct-model WebGPU `q8` and explicit custom dialogue markers including `<|violet_mood|>`. Inference requires local validation.

These are intentionally part of the active testing set. A runtime initialization failure is recorded as such, not as proof the model lacks roleplay capability. Violet has a fixed Victorian character, so use its outputs to assess the model's specific character fidelity rather than treating it as a neutral general assistant.
