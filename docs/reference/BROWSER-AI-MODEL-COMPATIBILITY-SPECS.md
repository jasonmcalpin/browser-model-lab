# Browser AI Model Compatibility Specifications

## Purpose

This document freezes the integration target for every Browser AI Benchmark candidate **before** the compatibility/runtime framework is rebuilt.

The benchmark must distinguish:

1. **model-native requirements** — chat template, system-role behavior, tools, reasoning controls, generation settings, stop/EOS behavior;
2. **artifact/runtime requirements** — loader API, Transformers.js version, ONNX dtype/layout, WebGPU support;
3. **benchmark requirements** — semantic tasks, scorers, retry/trial policy, output ceilings.

A model does not receive a quality score until its compatibility profile passes conformance. Unknown settings remain `UNKNOWN`; they are not guessed.

## Compatibility profile shape

The implementation should converge on a versioned contract similar to:

```ts
interface ModelCompatibilityProfile {
  id: string;
  family: string;
  loader: {
    kind: "pipeline" | "direct-model";
    task?: string;
    modelClass?: string;
    processorClass?: string;
    dtype: unknown;
    minimumTransformersJs?: string;
  };
  chat: {
    template: "native" | "custom" | "prompted";
    systemRole: "native" | "fold-into-user" | "unknown";
    historyReasoning: "preserve" | "strip" | "template-managed" | "unknown";
  };
  tools: {
    mode: "native-template" | "prompted-protocol" | "unsupported" | "unknown";
    schemaInjection?: string;
    callFormat?: string;
    resultFormat?: string;
  };
  reasoning: {
    supported: boolean | "unknown";
    defaultMode?: "thinking" | "non-thinking" | "unknown";
    control?: string;
  };
  profiles: {
    general: GenerationProfile;
    tools?: GenerationProfile;
    reasoning?: GenerationProfile;
  };
  sources: CompatibilitySource[];
}
```

The profile is configuration, not benchmark logic. The benchmark sees normalized messages, tool calls, tool results, finals, metrics and validity.

## Candidate matrix

### Qwen3 0.6B — production control

**Runtime**
- ONNX/Transformers.js text-generation pipeline.
- Current browser artifact: `onnx-community/Qwen3-0.6B-ONNX`.
- q4f16/WebGPU remains the production comparison profile.

**Chat/system**
- Native tokenizer chat template supports a first system message.
- Native template also owns tool rendering and tool-result rendering.

**Tools**
- Pass function schemas through tokenizer `tools`.
- Template renders schemas inside `<tools>...</tools>`.
- Native calls are emitted inside `<tool_call>...</tool_call>` as JSON objects with `name` and `arguments`.
- Tool results are rendered by the template as `<tool_response>...</tool_response>`.

**Reasoning**
- Thinking is enabled by default by the upstream template.
- `enable_thinking=false` is the hard non-thinking switch.
- Production currently intends non-thinking behavior.

**Generation profiles**
- Non-thinking: temperature 0.7, top-p 0.8, top-k 20, min-p 0.
- Thinking: temperature 0.6, top-p 0.95, top-k 20, min-p 0.
- Upstream explicitly warns against greedy decoding for thinking mode.
- This means the current production/direct greedy profile is **not** the upstream recommended non-thinking profile and must be re-qualified.

**Sources**
- https://huggingface.co/Qwen/Qwen3-0.6B
- https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/tokenizer_config.json

### Qwen3 1.7B

Same family protocol as Qwen3 0.6B:
- native Qwen3 chat template;
- native system role;
- native tools via tokenizer `tools`;
- `enable_thinking` control;
- non-thinking 0.7/0.8/20 and thinking 0.6/0.95/20.

Quality remains unmeasured until its q4f16 ONNX artifact can initialize. The compatibility framework must retain `RUNTIME_BLOCKED` without converting it to a model-quality failure.

**Sources**
- https://huggingface.co/Qwen/Qwen3-1.7B

### DeepSeek-R1-Distill-Qwen 1.5B

**Runtime**
- text-generation pipeline on the tested ONNX artifact.

**Chat/system**
- Upstream explicitly recommends **no system prompt**.
- Fold all task instructions into the user turn.

**Reasoning**
- Reasoning is fundamental to the model behavior.
- Upstream recommends forcing the response to begin with `<think>\n` because some runs otherwise skip reasoning.
- Reasoning must be separated from final output by the adapter.

**Generation**
- temperature 0.6 recommended; documented range 0.5–0.7.
- top-p 0.95.
- generation config sets sampling on.
- multiple trials are explicitly recommended by upstream.

**Tools**
- No model-card-native tool serialization contract was found for the Distill model.
- Do **not** pretend it has Qwen3 native tool calling merely because its base architecture is Qwen.
- Initial compatibility status for tools: `prompted-protocol`, with conformance proving that the prompted protocol is parseable and stable.

**Sources**
- https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B
- https://huggingface.co/deepseek-ai/DeepSeek-R1
- generation_config.json in the Distill repository

### SmolLM2 1.7B Instruct

**Runtime**
- Transformers.js text-generation.
- q4/q4f16 ONNX support is published in the Hugging Face repository.

**Chat/system**
- Use the native chat template.
- System prompts are supported.

**Tools**
- Upstream publishes an explicit function-calling system prompt.
- Functions are serialized in `<tools>...</tools>`.
- Calls are emitted as:
  `<tool_call>[{"name":"...","arguments":{...}}]</tool_call>`.
- The model card explicitly requires no extra text around that tool-call payload.
- This is a native/documented prompted tool protocol and should not be replaced with generic canonical JSON.

**Generation**
- Upstream example: temperature 0.2, top-p 0.9, sampling enabled.
- generation_config itself mostly defines BOS/EOS/PAD and does not override these example settings.

**Sources**
- https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct
- function-calling section in its README

### Gemma 3 1B IT

**Runtime**
- Transformers.js text-generation.
- Browser ONNX examples use q4.
- The GQA browser artifact demonstrates direct `pipeline("text-generation", ...)`.

**Chat/system**
- Use the native chat template.
- Published examples include a system message.

**Generation**
- Browser example uses deterministic generation (`do_sample: false`) with a 512-token ceiling.
- Treat that as a documented browser example, not a universal quality optimum.

**Tools**
- No authoritative Gemma 3 1B native tool template was found in the harvested sources.
- Initial tool mode: `unknown` / `prompted-protocol` only after compatibility qualification.
- Do not score failed generic tool formatting as native tool-call weakness.

**Sources**
- https://huggingface.co/google/gemma-3-1b-it
- https://huggingface.co/onnx-community/gemma-3-1b-it-ONNX-GQA

### Qwen3.5 0.8B

**Runtime**
- Do **not** use the generic pipeline abstraction used by Qwen3.
- Official Transformers.js browser example uses:
  - `AutoProcessor`
  - `Qwen3_5ForConditionalGeneration`
  - `processor.apply_chat_template()`
  - direct `model.generate()`.
- Published WebGPU dtype map:
  - `embed_tokens: q4`
  - `vision_encoder: fp16`
  - `decoder_model_merged: q4`.
- The ONNX model card currently demonstrates `@huggingface/transformers@next`; framework compatibility must be probed against the pinned runtime rather than assumed.

**Chat/system**
- Processor chat template is authoritative.
- Historical thinking content should not be fed back into later turns; the provided template manages stripping it.

**Reasoning**
- Supports thinking and non-thinking.
- 0.8B defaults to non-thinking.
- Qwen3-style soft `/think` / `/nothink` switching is not supported.

**Generation profiles**
For text:
- non-thinking general: temperature 1.0, top-p 1.0, top-k 20, min-p 0, presence penalty 2.0, repetition penalty 1.0;
- thinking general: temperature 1.0, top-p 0.95, top-k 20, min-p 0, presence penalty 1.5, repetition penalty 1.0.
The 0.8B model is specifically noted as susceptible to thinking loops.

**Tools**
- Qwen3.5 is trained/evaluated for agent behavior, but the harvested Transformers.js example does not document a browser-native tool serialization API.
- Tool contract must be read from its processor/chat template before declaring native support.
- Until verified: `UNKNOWN`, not generic-chat.

**Sources**
- https://huggingface.co/onnx-community/Qwen3.5-0.8B-ONNX
- https://huggingface.co/Qwen/Qwen3.5-0.8B


### Qwen3.5 0.8B multimodal comparison

The shootout now retains **two separate 0.8B Qwen3.5 candidates**:

- `onnx-community/Qwen3.5-0.8B-Text-ONNX` — text-only pipeline candidate for the lowest-overhead language comparison;
- `onnx-community/Qwen3.5-0.8B-ONNX` — full multimodal direct-model candidate using `AutoProcessor`, `Qwen3_5ForConditionalGeneration`, and the mixed q4/fp16 dtype map.

The multimodal candidate uses a separate non-thinking VL workload profile:
- temperature 0.7
- top-p 0.8
- top-k 20
- min-p 0
- presence penalty 1.5
- repetition penalty 1.0

This VL profile is independent of the model's text profile. Text quality remains directly comparable between the two candidates, while visual capability is reported on a separate axis.

The vision probe uses the committed Code Gauntlet artifact `/artifacts/testing/oracle-dispute-chart.svg`, rasterized in-browser to PNG. It performs:
- **V1 OCR** — recover the exact bottom statement;
- **V2 layout reasoning** — identify the column whose reproduction and source-match checks both fail.

Each case runs three sampled attempts and passes by majority. Raw outputs, metrics, and exact vision invocations are retained. Vision failures do not zero or invalidate the text score.

### Qwen3.5 2B

Same family rules as Qwen3.5 0.8B:
- direct model/processor loader, not the unsupported `image-text-to-text` pipeline;
- processor-owned chat template;
- defaults to non-thinking;
- no Qwen3 soft thinking switch;
- preserve only final output in conversational history.

**Generation profiles**
- non-thinking text: temperature 1.0, top-p 1.0, top-k 20, min-p 0, presence penalty 2.0, repetition penalty 1.0;
- thinking text: temperature 1.0, top-p 0.95, top-k 20, min-p 0, presence penalty 1.5, repetition penalty 1.0.

The exact ONNX loader/dtype map must be verified against the 2B artifact/processor. Do not blindly copy 0.8B file names if the artifact differs.

**Sources**
- https://huggingface.co/Qwen/Qwen3.5-2B
- https://huggingface.co/onnx-community/Qwen3.5-2B-ONNX

### Llama 3.2 1B Instruct

**Runtime**
- text-generation pipeline is officially supported.
- Use native chat template.

**Chat/system**
- Upstream example uses explicit `system` and `user` roles.
- System prompts therefore remain native rather than folded into user content.

**Generation**
- Upstream example specifies max_new_tokens but does not prescribe a universal temperature/top-p profile.
- Initial generation settings should therefore inherit artifact generation config/defaults where possible, with benchmark overrides recorded explicitly.

**Tools**
- No authoritative native function-calling template for this exact 1B Instruct model was found in the harvested sources.
- Treat tools as `UNKNOWN` until tokenizer-template inspection proves otherwise.
- Do not punish it for failing another family's tool syntax.

**Sources**
- https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct
- ONNX community Llama 3.2 artifact

### Falcon3 1B Instruct

**Runtime**
- ONNX community publishes a Transformers.js text-generation artifact.
- Architecture is exposed through the Llama model implementation.

**Chat/system**
- Use the model's native chat template.
- Upstream usage relies on `tokenizer.apply_chat_template(..., add_generation_prompt=true)`.

**Generation**
- Base generation config only defines BOS/EOS and does not publish a preferred temperature/top-p pair.
- Standard upstream example uses ordinary `generate(max_new_tokens=...)`.
- Do not invent sampling settings.

**Tools**
- Model training includes function-call data, but no authoritative native tool schema/result serialization was found in the harvested model card.
- Tool mode starts `UNKNOWN`; qualification should inspect the tokenizer template before choosing prompted or native behavior.

**Sources**
- https://huggingface.co/tiiuae/Falcon3-1B-Instruct
- https://huggingface.co/onnx-community/Falcon3-1B-Instruct

### Granite 4.0 1B

**Runtime**
- ONNX community publishes a Transformers.js text-generation WebGPU artifact.
- q4/q4f16 external-data layouts are explicitly described in artifact metadata.

**Chat/system**
- Use the native Granite chat template and role tokens.

**Tools**
- Native tool support is explicitly documented.
- Pass tool schemas through `tools` to the chat template.
- Template injects schemas inside `<tools>...</tools>`.
- Calls are JSON inside `<tool_call>...</tool_call>`.
- The template itself creates the system tool instructions.
- The previous generic canonical-JSON adapter is therefore invalid for judging Granite.

**Generation**
- Published examples use normal `generate(max_new_tokens=...)` without a required sampling profile.
- Preserve generation-config/default behavior until a documented workload profile says otherwise.

**Sources**
- https://huggingface.co/ibm-granite/granite-4.0-1b
- https://huggingface.co/onnx-community/granite-4.0-1b-ONNX-web

### LFM3 1.7B

**Runtime**
- ONNX community explicitly requires Transformers.js 4.3.2+.
- text-generation pipeline with q4f16/WebGPU is documented.

**Chat/system**
- ChatML template.
- Native system role is supported.
- Pipeline automatically applies the chat template.

**Reasoning**
- Thinking is enabled by default.
- `tokenizer_encode_kwargs: { enable_thinking: false }` disables it for the documented browser example.
- Earlier-turn reasoning is removed unless explicitly preserved.

**Tools**
- Pass function schemas via the chat template's `tools`.
- Native tool calls use XML function/parameter blocks inside `<tool_call>`.
- Tool-result formatting should be delegated to the native template.
- Our current generic canonical-JSON adapter is invalid for judging LFM3 tool behavior.

**Generation profiles**
General/chat/tool/agents:
- temperature 0.1
- top-k 50
- repetition penalty 1.1

Math/STEM:
- temperature 1.0
- top-p 0.95
- top-k 20

The browser ONNX example uses the general profile with thinking disabled.

**Sources**
- https://huggingface.co/LiquidAI/LFM3-1.7B
- https://huggingface.co/onnx-community/LFM3-1.7B-ONNX

### Bonsai 1.7B

**Runtime**
- ONNX community publishes Transformers.js text-generation artifacts, including q4 external-data weights.
- Architecture is Qwen3-1.7B-derived, but Bonsai has its own shipped tokenizer/chat template and should use it.

**Chat/system**
- Native template supports system messages.

**Tools**
The ONNX tokenizer template explicitly defines:
- tool schemas inside `<tools>...</tools>`;
- JSON tool calls inside `<tool_call>...</tool_call>`;
- tool results inside `<tool_response>...</tool_response>`;
- assistant/tool multi-turn handling.
Use this native template rather than generic canonical JSON.

**Reasoning**
- The shipped template handles `<think>` content and, for a fresh generation prompt, emits an empty thinking section before the final response.
- Treat this behavior as template-owned rather than assuming plain Qwen3 defaults.

**Generation**
Prism's deployment guidance for Bonsai suggests:
- temperature 0.5 (range 0.5–0.7)
- top-k 20 (range 20–40)
- top-p 0.9 (range 0.85–0.95)
- repetition penalty 1.0.
These settings come from the Bonsai deployment guidance, not the ONNX artifact itself; provenance must remain explicit.

**Sources**
- https://huggingface.co/onnx-community/Bonsai-1.7B-ONNX
- its tokenizer_config.json
- https://huggingface.co/prism-ml/Bonsai-1.7B-gguf

## Compatibility qualification suite

Before quality scoring, every candidate must pass or explicitly classify these checks:

1. **C1 Loader** — exact loader API can initialize the artifact.
2. **C2 Template** — canonical system/user conversation renders through the intended native template.
3. **C3 System role** — system instructions are native, folded, or explicitly unsupported as specified.
4. **C4 Reasoning mode** — intended thinking/non-thinking profile is actually selected.
5. **C5 Native tool schema** — when native tools exist, schemas render exactly through the model template.
6. **C6 Tool-call parser** — one known native call normalizes to the canonical internal `ModelTurn`.
7. **C7 Tool result** — a deterministic receipt is fed back using the model's native result format.
8. **C8 Multi-turn continuation** — the model can continue after a tool receipt without template corruption.
9. **C9 Generation profile** — runtime settings equal the selected documented workload profile.
10. **C10 Stop/history behavior** — EOS/stop handling and reasoning-history policy match the profile.

Possible qualification states:
- `COMPATIBLE`
- `COMPATIBLE_WITH_PROMPTED_TOOLS`
- `NO_NATIVE_TOOL_CONTRACT`
- `INVALID_INTEGRATION`
- `RUNTIME_BLOCKED`
- `UNSUPPORTED_RUNTIME`

Only the first three can proceed to quality scoring, and the resulting report must distinguish native tool capability from prompted tool-following capability.

## Framework boundary to build next

```text
Benchmark semantic task
        |
        v
CompatibilityProfileRegistry
        |
        +--> ChatTemplateAdapter
        +--> ToolProtocolAdapter
        +--> ReasoningAdapter
        +--> GenerationProfile
        |
        v
ModelRuntime
        |
        +--> PipelineRuntime
        +--> DirectModelRuntime
        |
        v
Normalized turn / metrics / raw evidence
        |
        v
Deterministic benchmark scorer
```

### Invariants

- Benchmark tasks never contain model-family formatting.
- Runtime never decides what constitutes benchmark success.
- Compatibility adapters may translate syntax, never semantics.
- Native model templates win over hand-written emulation when available.
- Unknown upstream behavior remains unknown.
- Profile changes create a new benchmark revision.
- Raw rendered prompt/template inputs and raw model outputs are retained for qualification runs.
- The incumbent receives the same compatibility requalification as every challenger.
- No model is tuned against benchmark answers. Settings may be tuned only against protocol correctness, documented operating guidance, runtime stability and non-task-specific sanity probes.


## Implemented framework mapping

The compatibility framework now implements this specification as executable configuration.

- Candidates reference immutable `compatibilityProfileId` values.
- Compatibility profiles own runtime kind, chat/system placement, native-vs-prompted tool mode, reasoning control, generation profiles, and source provenance.
- Runtime backends are separated into `pipeline` and `direct-model` paths.
- Benchmark tool loops preserve canonical multi-turn history as system/user/assistant/tool messages. Adapters translate this history into native model syntax or an explicitly labeled prompted fallback.
- Quality scoring is gated by a compatibility qualification state and never runs after invalid integration or runtime blockage.
- Schema 9 records the selected compatibility profile and qualification alongside model results.

### Qwen3.5 runtime split

For the text-only benchmark, Qwen3.5 0.8B now uses the dedicated `onnx-community/Qwen3.5-0.8B-Text-ONNX` artifact through the ordinary text-generation pipeline. This avoids loading an unnecessary vision tower.

Qwen3.5 2B retains the direct `AutoProcessor` + `Qwen3_5ForConditionalGeneration` runtime path because a comparable official text-only ONNX browser artifact was not established during this implementation pass. Its recorded dtype is therefore the model's mixed q4/fp16 map rather than a false q4f16 label.

## Implications for the previous shootout

The prior schema-v7 scores are useful as historical evidence but should **not** be treated as final rankings.

Known integration mismatches include:
- Qwen3 control used greedy decoding for production/direct despite upstream non-thinking sampling guidance.
- Granite native tool template was bypassed.
- LFM3 native tool/template protocol was bypassed.
- Qwen3.5 used an unsupported generic pipeline instead of its direct processor/model API.
- Bonsai native Qwen-derived tool template was bypassed.
- Gemma/Llama/Falcon tool scores may represent prompted-protocol fitness, not native tool capability.

After the compatibility framework is implemented, rerun **all registered candidates** under a new benchmark revision.
