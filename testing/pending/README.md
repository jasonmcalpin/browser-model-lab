# Pending character model candidates

These records document selected models for evaluation without misrepresenting their runtime compatibility.

The active BML inventory intentionally reads only direct `testing/*.json` model cards
(schema 3). Records in this folder are **not** runnable model cards and are **not**
included in `--candidate all` or evaluation plans pointing at `cardsDir: "testing"`.

| Candidate | Role | Current upstream artifact | Browser BML status |
| --- | --- | --- | --- |
| [Luna-7B-A4B](https://huggingface.co/beyoru/Luna-7B-A4B) | Roleplay and character dialogue | Qwen3 MoE safetensors | Pending compatible ONNX/runtime |
| [InfinityRP-v1-7B](https://huggingface.co/Endevor/InfinityRP-v1-7B) | Roleplay with player-agency focus | Mistral safetensors; separate third-party GGUF quantizations | Pending compatible ONNX/runtime and prompt protocol |

A pending record must **not** be copied into the active folder as a fictional
`q4f16` card: the default browser runtime would attempt ONNX downloads
that do not exist for that repository. Nor should the roleplay specialist be
silently replaced with a different model and reported under the original ID.

## Promotion contract

1. Verify an actual runnable checkpoint and its provenance (original weights,
   a compatible ONNX export, or the exact quantized variant).
2. Confirm inference backend, architecture, tokenizer/chat template and prompt
   format; the InfinityRP checkpoint specifically documents Extended Alpaca.
3. Add the corresponding runtime adapter if the backend is not yet supported
   by BML. Do not claim GGUF support through the existing Transformers.js
   pipeline.
4. Promote a valid schema-3 model card to the direct `testing/` folder, with
   adapter-specific generation profiles and a stable candidate ID.
5. Validate with a local inference run before comparing character scores.

The existing `experiments/mara-dialogue/` cards and evaluation plans remain
unchanged.
