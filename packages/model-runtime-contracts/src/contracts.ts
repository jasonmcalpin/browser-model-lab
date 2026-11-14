/**
 * Portable plugin contracts. This module MUST NOT import BML, Aether, Node,
 * browser globals, or any inference vendor. Host transports implement these
 * logical contracts separately.
 */
export type PluginKind = "engine" | "protocol" | "loader";
export type ExecutionEnvironment = "browser-worker" | "node-worker" | "external-service";
export type Capability = "text" | "vision" | "audio-input" | "audio-output"
  | "streaming" | "tool-calling" | "tokenization" | "cancellation";
export type Permission = "network" | "gpu" | "filesystem-read" | "filesystem-write"
  | "subprocess" | "secrets";

export interface PluginManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly apiVersion: 1;
  readonly kind: PluginKind;
  readonly entrypoint: string;
  readonly environment: ExecutionEnvironment;
  readonly capabilities: readonly Capability[];
  readonly permissions: readonly Permission[];
  readonly configSchema?: string;
  readonly description?: string;
}

export interface CapabilityDescriptor {
  readonly supported: readonly Capability[];
  readonly modelFormats: readonly string[];
  readonly quantizations: readonly string[];
  readonly maxContextTokens?: number;
  readonly models?: readonly string[];
}

export interface ModelIdentity {
  readonly modelId: string;
  readonly revision?: string;
  readonly format?: string;
  readonly quantization?: string;
}

export interface GenerationSettings {
  readonly maxOutputTokens: number;
  readonly temperature?: number;
  readonly topP?: number;
  readonly seed?: number;
}

export type MessageRole = "system" | "developer" | "user" | "assistant" | "tool";
export type ContentPart =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly assetRef: string; readonly mimeType: string };

export interface ConversationMessage {
  readonly role: MessageRole;
  readonly content: readonly ContentPart[];
  readonly toolCallId?: string;
}

export interface ToolDeclaration {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export interface GenerationRequest {
  readonly messages: readonly ConversationMessage[];
  readonly settings: GenerationSettings;
  readonly tools?: readonly ToolDeclaration[];
  readonly responseFormat?: "text" | "json";
}

export type GenerationEvent =
  | { readonly type: "text-delta"; readonly text: string }
  | { readonly type: "tool-call"; readonly id: string; readonly name: string; readonly arguments: unknown }
  | { readonly type: "usage"; readonly inputTokens?: number; readonly outputTokens?: number;
      readonly elapsedMs?: number }
  | { readonly type: "complete"; readonly finishReason: "stop" | "length" | "tool-calls" | "cancelled" | "unknown" };

export interface ModelLoadRequest {
  readonly model: ModelIdentity;
  readonly contextTokens?: number;
  readonly options?: Readonly<Record<string, unknown>>;
}
export interface PluginEnvironment {
  readonly engineId: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly grantedPermissions: readonly Permission[];
}

export interface ModelSession {
  generate(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<GenerationEvent>;
  tokenize?(messages: readonly ConversationMessage[]): Promise<number>;
  dispose(): Promise<void>;
}

export interface InferenceEngine {
  probe(): Promise<CapabilityDescriptor>;
  load(request: ModelLoadRequest): Promise<ModelSession>;
  dispose(): Promise<void>;
}
export interface EnginePlugin {
  readonly manifest: PluginManifest & { readonly kind: "engine" };
  create(environment: PluginEnvironment): Promise<InferenceEngine>;
}

export interface ProtocolAdapter {
  encode(messages: readonly ConversationMessage[], tools?: readonly ToolDeclaration[]): string;
  decode(raw: string): {
    readonly text: string;
    readonly toolCalls?: readonly { readonly name: string; readonly arguments: unknown }[];
    readonly metadata?: Readonly<Record<string, unknown>>;
  };
}
export interface ProtocolPlugin {
  readonly manifest: PluginManifest & { readonly kind: "protocol" };
  create(environment: PluginEnvironment): Promise<ProtocolAdapter>;
}

export interface ModelLoader {
  supports(model: ModelIdentity): boolean;
  resolve(model: ModelIdentity): Promise<ModelLoadRequest>;
}
export interface LoaderPlugin {
  readonly manifest: PluginManifest & { readonly kind: "loader" };
  create(environment: PluginEnvironment): Promise<ModelLoader>;
}

export type PluginModule = EnginePlugin | ProtocolPlugin | LoaderPlugin;
