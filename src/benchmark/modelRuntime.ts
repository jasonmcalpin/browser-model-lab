import { compatibilityProfileFor } from "./compatibilityProfiles";
import type { BrowserModelCandidate, ModelMessage } from "./types";

export interface BrowserModelRuntime {
  readonly tokenizer: unknown;
  readonly templateSource: string | undefined;
  renderPrompt(messages: readonly ModelMessage[], tokenizerOptions?: Readonly<Record<string, unknown>>): string;
  generate(messages: readonly ModelMessage[], options: Record<string, unknown>): Promise<unknown>;
  generateVision?(imageUrl: string, prompt: string, options: Record<string, unknown>): Promise<unknown>;
  dispose(): Promise<void>;
}

function templateSource(tokenizer: unknown): string | undefined {
  const value = (tokenizer as { chat_template?: unknown } | undefined)?.chat_template;
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return undefined;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function renderTokenizerPrompt(tokenizer: unknown, messages: readonly ModelMessage[],
  tokenizerOptions: Readonly<Record<string, unknown>> = {}): string {
  const apply = (tokenizer as { apply_chat_template?: (...args: any[]) => unknown } | undefined)?.apply_chat_template;
  if (typeof apply !== "function") throw new Error("Tokenizer does not expose apply_chat_template.");
  const rendered = apply.call(tokenizer, messages, { ...tokenizerOptions, add_generation_prompt: true, tokenize: false });
  return typeof rendered === "string" ? rendered : JSON.stringify(rendered);
}

type TransformersRuntime = typeof import("@huggingface/transformers");

type Progress = (progress: { status?: string; file?: string; loaded?: number }) => void;

class PipelineModelRuntime implements BrowserModelRuntime {
  constructor(private readonly pipeline: ((messages: readonly ModelMessage[], options: Record<string, unknown>) => Promise<unknown>) & {
    readonly tokenizer: unknown; dispose(): Promise<void>;
  }) {}
  get tokenizer(): unknown { return this.pipeline.tokenizer; }
  get templateSource(): string | undefined { return templateSource(this.pipeline.tokenizer); }
  renderPrompt(messages: readonly ModelMessage[], tokenizerOptions?: Readonly<Record<string, unknown>>): string {
    return renderTokenizerPrompt(this.pipeline.tokenizer, messages, tokenizerOptions);
  }
  generate(messages: readonly ModelMessage[], options: Record<string, unknown>): Promise<unknown> {
    return this.pipeline(messages, options);
  }
  dispose(): Promise<void> { return this.pipeline.dispose(); }
}

class Qwen35DirectRuntime implements BrowserModelRuntime {
  constructor(private readonly processor: any, private readonly model: any, private readonly RawImage: any) {}
  get tokenizer(): unknown { return this.processor.tokenizer; }
  get templateSource(): string | undefined { return templateSource(this.processor.tokenizer); }
  renderPrompt(messages: readonly ModelMessage[], tokenizerOptions: Readonly<Record<string, unknown>> = {}): string {
    const rendered = this.processor.apply_chat_template(messages, {
      ...tokenizerOptions, add_generation_prompt: true, tokenize: false,
    });
    return typeof rendered === "string" ? rendered : JSON.stringify(rendered);
  }

  async generate(messages: readonly ModelMessage[], options: Record<string, unknown>): Promise<unknown> {
    const text = this.processor.apply_chat_template(messages, { add_generation_prompt: true });
    const inputs = await this.processor(text);
    return this.model.generate({ ...inputs, ...options });
  }

  async generateVision(imageUrl: string, prompt: string, options: Record<string, unknown>): Promise<unknown> {
    const image = await (await this.RawImage.read(imageUrl)).resize(448, 448);
    const conversation = [{
      role: "user",
      content: [{ type: "image" }, { type: "text", text: prompt }],
    }];
    const text = this.processor.apply_chat_template(conversation, { add_generation_prompt: true });
    const inputs = await this.processor(text, image);
    return this.model.generate({ ...inputs, ...options });
  }

  async dispose(): Promise<void> {
    if (typeof this.model?.dispose === "function") await this.model.dispose();
  }
}

export async function createBrowserModelRuntime(runtime: TransformersRuntime, candidate: BrowserModelCandidate,
  progressCallback: Progress): Promise<BrowserModelRuntime> {
  const profile = compatibilityProfileFor(candidate);
  if (profile.runtime.kind === "pipeline") {
    if (typeof profile.runtime.dtype !== "string" || profile.runtime.dtype === "mixed")
      throw new Error(`Pipeline runtime requires a scalar Transformers.js dtype: ${profile.id}`);
    const pipelineTask = profile.runtime.pipelineTask === undefined || profile.runtime.pipelineTask === "auto"
      ? "text-generation" : profile.runtime.pipelineTask;
    const pipeline = await runtime.pipeline(pipelineTask, candidate.modelId, {
      device: "webgpu",
      ...(profile.runtime.dtype === "auto" ? {} : { dtype: profile.runtime.dtype }),
      revision: candidate.revision,
      progress_callback: progressCallback,
    }) as unknown as ConstructorParameters<typeof PipelineModelRuntime>[0];
    return new PipelineModelRuntime(pipeline);
  }

  if (profile.runtime.modelClass === "Qwen3_5ForConditionalGeneration"
    && profile.runtime.processorClass === "AutoProcessor") {
    const AutoProcessor = (runtime as any).AutoProcessor;
    const ModelClass = (runtime as any).Qwen3_5ForConditionalGeneration;
    const RawImage = (runtime as any).RawImage;
    if (!AutoProcessor || !ModelClass || !RawImage)
      throw new Error("Transformers.js runtime does not expose the required Qwen3.5 multimodal classes.");
    const processor = await AutoProcessor.from_pretrained(candidate.modelId, {
      revision: candidate.revision,
      progress_callback: progressCallback,
    });
    const directDtype = profile.runtime.dtype === "auto" ? undefined : profile.runtime.dtype;
    const model = await ModelClass.from_pretrained(candidate.modelId, {
      revision: candidate.revision,
      device: "webgpu",
      ...(directDtype === undefined ? {} : { dtype: directDtype }),
      progress_callback: progressCallback,
    });
    return new Qwen35DirectRuntime(processor, model, RawImage);
  }

  throw new Error(`Unsupported model runtime profile: ${profile.id}`);
}
