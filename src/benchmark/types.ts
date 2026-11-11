export type StructuredOutputMode = "native" | "json-fallback" | "unsupported";
export type BenchmarkReasoningBudget = 256 | 512 | 768;
export type BudgetKey = `${BenchmarkReasoningBudget}`;
export type BrowserAiBenchmarkTest = "production" | "advanced" | "t1" | "t2" | "all";
export type BrowserAiBenchmarkCacheMode = "cold" | "cached";
export type BenchmarkWorkload = "production" | "direct" | "tool";
export type ModelAdapterId = "qwen3" | "deepseek-r1" | "smollm2" | "generic-chat" | "granite4" | "lfm3" | "bonsai" | "qwen3.5";
export type RuntimeKind = "pipeline" | "direct-model";
export type ToolSupportMode = "native-template" | "prompted-protocol" | "unknown" | "unsupported";
export type CompatibilityQualificationState = "COMPATIBLE" | "COMPATIBLE_WITH_PROMPTED_TOOLS"
  | "NO_NATIVE_TOOL_CONTRACT" | "INVALID_INTEGRATION" | "RUNTIME_BLOCKED" | "UNSUPPORTED_RUNTIME";
export type PromptPlacement = "preserve-roles" | "user-only";
export type ToolCallFormat = "qwen-native" | "canonical-json" | "smollm2-native" | "lfm3-xml";
export type ResultValidity = "VALID" | "CONSTRAINED" | "UNMEASURED" | "INVALID_INTEGRATION" | "RUNTIME_BLOCKED";
export type ConstraintOwner = "MODEL" | "GAME" | "BENCHMARK" | "RUNTIME" | "HARDWARE" | "UNKNOWN";
export type GenerationTermination = "EOS" | "TOKEN_LIMIT" | "STOP_SEQUENCE" | "CANCELLED" | "RUNTIME_ERROR" | "UNKNOWN";
export type FailureClass = "model" | "adapter" | "runtime" | "benchmark" | "unknown";
export type EnvelopeStatus = "MET" | "NOT_MET" | "UNKNOWN" | "NOT_APPLICABLE";
export type EvalEventType = "invocation" | "model-output" | "normalized-turn" | "tool-call" | "tool-result" | "failure";
export interface EvalEvent {
  readonly sequence: number;
  readonly type: EvalEventType;
  readonly data: unknown;
}
export interface EvalCaseDescriptor {
  readonly id: string;
  readonly tags: readonly string[];
  readonly scorerRevision: string;
}
export interface EvalManifest {
  readonly manifestVersion: 1;
  readonly benchmarkRevision: string;
  readonly scorerRevision: string;
  readonly compatibilitySpec: string;
  readonly candidateIds: readonly string[];
  readonly selectedTests: readonly string[];
  readonly reasoningBudgets: readonly BenchmarkReasoningBudget[];
  readonly trialPolicy: { readonly deterministic: 1; readonly sampled: 3; readonly aggregation: "median"; readonly passPolicy: "majority" };
  readonly cases: readonly EvalCaseDescriptor[];
}

export interface ModelMessage { readonly role: "system" | "user" | "assistant" | "tool"; readonly content: string; readonly name?: string }
export interface CanonicalToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Readonly<Record<string, { readonly type: string; readonly description: string }>>;
    readonly required: readonly string[];
    readonly additionalProperties: false;
  };
}
export interface CanonicalToolReceipt {
  readonly tool: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
}
export interface CanonicalGenerationRequest {
  readonly messages: readonly ModelMessage[];
  readonly maxNewTokens: number;
  readonly workload: BenchmarkWorkload;
  readonly tools?: readonly CanonicalToolDefinition[];
}
export interface GenerationSettings {
  readonly maxNewTokens: number;
  readonly doSample?: boolean;
  readonly temperature?: number;
  readonly topP?: number;
  readonly topK?: number;
  readonly presencePenalty?: number;
  readonly repetitionPenalty?: number;
  readonly minP?: number;
}
export type AutoSetting<T> = T | "auto";
export interface GenerationProfileSpec {
  readonly doSample?: AutoSetting<boolean>;
  readonly temperature?: AutoSetting<number>;
  readonly topP?: AutoSetting<number>;
  readonly topK?: AutoSetting<number>;
  readonly presencePenalty?: AutoSetting<number>;
  readonly repetitionPenalty?: AutoSetting<number>;
  readonly minP?: AutoSetting<number>;
}
export interface ModelCompatibilityProfile {
  readonly id: string;
  readonly family: string;
  readonly runtime: {
    readonly kind: RuntimeKind;
    readonly pipelineTask?: "text-generation" | "auto";
    readonly modelClass?: "Qwen3_5ForConditionalGeneration" | "auto";
    readonly processorClass?: "AutoProcessor" | "auto";
    readonly dtype: BrowserModelCandidate["dtype"] | "auto" | Readonly<Record<string, "q4" | "fp16" | "auto">>;
    readonly minimumTransformersJs?: string;
  };
  readonly chat: {
    readonly promptPlacement: PromptPlacement;
    readonly nativeTemplate: boolean;
    readonly historyReasoning: "preserve" | "strip" | "template-managed" | "unknown";
  };
  readonly tools: {
    readonly mode: ToolSupportMode;
    readonly callFormat: ToolCallFormat;
    readonly tokenizerTools: boolean;
  };
  readonly reasoning: {
    readonly supported: boolean | "unknown";
    readonly defaultMode: "thinking" | "non-thinking" | "unknown";
    readonly control?: "enable_thinking" | "forced-think-prefix" | "template-managed" | "auto";
    readonly enabledForBenchmark?: boolean;
  };
  readonly profiles: Readonly<Record<BenchmarkWorkload, GenerationProfileSpec>>;
  readonly visionProfile?: GenerationProfileSpec;
  readonly adapterId: ModelAdapterId;
  readonly sources?: readonly string[];
}

export interface ModelInvocation {
  readonly messages: readonly ModelMessage[];
  readonly tokenizerEncodeOptions?: Readonly<Record<string, unknown>>;
  readonly settings: GenerationSettings;
  readonly adapterId: ModelAdapterId;
  readonly toolCallFormat: ToolCallFormat;
  readonly compatibilityProfileId: string;
}

export interface ModelTemplateEvidence {
  readonly templateSource?: string;
  readonly chat: {
    readonly invocation: ModelInvocation;
    readonly renderedPrompt?: string;
    readonly error?: string;
  };
  readonly tools: {
    readonly invocation: ModelInvocation;
    readonly renderedPrompt?: string;
    readonly error?: string;
  };
}
export interface AdapterProfileReport {
  readonly adapterId: ModelAdapterId;
  readonly promptPlacement: PromptPlacement;
  readonly toolCallFormat: ToolCallFormat;
  readonly reasoningFormat: "none" | "think-tags";
  readonly tokenizerOptions?: Readonly<Record<string, unknown>>;
  readonly profiles: Readonly<Record<BenchmarkWorkload, Omit<GenerationSettings, "maxNewTokens">>>;
  readonly visionProfile?: Omit<GenerationSettings, "maxNewTokens">;
  readonly runtimeKind: RuntimeKind;
  readonly toolSupportMode: ToolSupportMode;
  readonly compatibilityProfileId: string;
}

export interface BrowserModelCandidate {
  readonly id: string;
  readonly label: string;
  readonly modelId: string;
  readonly revision: string;
  readonly backend: "webgpu";
  readonly dtype: "q4f16" | "q4" | "mixed";
  readonly pipelineTask: "text-generation" | "direct-model";
  readonly family: string;
  readonly adapterId: ModelAdapterId;
  readonly compatibilityProfileId: string;
  readonly approximateArtifactBytes?: number;
  readonly template: { readonly kind: string; readonly enableThinking?: boolean };
  readonly structuredOutput: StructuredOutputMode;
  readonly compatibilityProfile: ModelCompatibilityProfile;
}

export interface CacheEntryMetric { readonly url: string; readonly bytes?: number }
export interface InitializationMetrics {
  readonly readyMs: number;
  readonly templateEvidence?: ModelTemplateEvidence;
  readonly cacheEntriesBefore: readonly CacheEntryMetric[];
  readonly cacheEntriesAfter: readonly CacheEntryMetric[];
  readonly cacheBytesBefore?: number;
  readonly cacheBytesAfter?: number;
  readonly requestedUrls: readonly string[];
  readonly bytesObserved?: number;
}
export interface GenerationMetrics {
  readonly firstTokenMs?: number;
  readonly generationMs: number;
  readonly generatedTokens: number;
  readonly tokensPerSecond: number;
  readonly reasoningTokens?: number;
  readonly termination: GenerationTermination;
}
export interface VisionInvocation {
  readonly imageUrl: string;
  readonly prompt: string;
  readonly settings: GenerationSettings;
  readonly compatibilityProfileId: string;
}
export interface VisionGenerationResult {
  readonly raw: string;
  readonly final: string;
  readonly metrics: GenerationMetrics;
  readonly invocation: VisionInvocation;
}
export interface GenerationResult {
  readonly raw: string;
  readonly final: string;
  readonly metrics: GenerationMetrics;
  readonly invocation?: ModelInvocation;
  readonly turn?: ModelTurn;
}

export type ToolName = "inspect_relay" | "retire_relay" | "wikipedia_search" | "wikipedia_page";
export interface ToolCall { readonly tool: ToolName | string; readonly args: Record<string, unknown> }
export type ModelTurn = { readonly type: "tool_call"; readonly call: ToolCall }
  | { readonly type: "final"; readonly answer: unknown };

export interface TaskRuntimeMetrics {
  readonly reachedValidToolCall: boolean;
  readonly reachedFinalAnswer: boolean;
  readonly tokensToFirstValidToolCall?: number;
  readonly tokensToFinalAnswer?: number;
  readonly totalGeneratedTokens: number;
  readonly ttftMs?: number;
  readonly modelMs: number;
  readonly toolMs: number;
  readonly endToEndMs: number;
}

export type FailureReason =
  | "instruction-contract"
  | "instruction-negation"
  | "schema-shape"
  | "missing-required-field"
  | "wrong-tool"
  | "unauthorized-tool"
  | "unnecessary-tool"
  | "missing-parameter"
  | "evidence-grounding"
  | "verification-discipline"
  | "injection-resistance"
  | "honest-uncertainty"
  | "context-isolation"
  | "identity-drift"
  | "relationship-drift"
  | "state-continuity"
  | "failed-to-stop"
  | "premature-stop"
  | "trajectory-completion"
  | "multi-step-continuation"
  | "recovery"
  | "token-exhaustion";

export interface FailureDiagnosis {
  readonly caseId: string;
  readonly reasons: readonly FailureReason[];
  readonly succeeded: readonly string[];
  readonly failed: readonly string[];
}

export type DiagnosticProbeId =
  | "IC1" | "IC2" | "T3" | "T4" | "T5" | "T6" | "A1" | "A2" | "A3" | "P1";

export interface DiagnosticProbeCaseResult {
  readonly id: DiagnosticProbeId;
  readonly label: string;
  readonly passed: boolean;
  readonly reasons: readonly FailureReason[];
  readonly evidence: string;
  readonly generatedTokens: number;
  readonly generations: readonly GenerationResult[];
}

export interface DiagnosticProbeResult {
  readonly maxNewTokens: 256;
  readonly unscored: true;
  readonly cases: readonly DiagnosticProbeCaseResult[];
}

export type RoleCapabilityId =
  | "general-game"
  | "scene-roleplay"
  | "instruction-contract"
  | "tool-operator"
  | "agent-control"
  | "evidence-security"
  | "efficiency-reliability";

export interface RoleCapability {
  readonly id: RoleCapabilityId;
  readonly rating: "STRONG" | "PARTIAL" | "WEAK" | "UNMEASURED";
  readonly score: number;
  readonly maximum: number;
  readonly evidence: readonly string[];
}

export interface CandidateDiagnostics {
  readonly failures: readonly FailureDiagnosis[];
  readonly roles: readonly RoleCapability[];
}

export interface FailureAttribution {
  readonly phase: string;
  readonly class: FailureClass;
  readonly envelopeRequirementIds: readonly string[];
  readonly message: string;
}

export interface TrialAttempt {
  readonly index: number;
  readonly passed: boolean;
  readonly score: number;
  readonly rawOutputs: readonly string[];
  readonly normalizedTurns: readonly ModelTurn[];
  readonly generatedTokens: number;
  readonly ttftMs?: number;
  readonly modelMs: number;
  readonly endToEndMs: number;
  readonly validity: ResultValidity;
  readonly terminations: readonly GenerationTermination[];
  readonly renderedInvocations: readonly ModelInvocation[];
  readonly events: readonly EvalEvent[];
}

export interface TrialSummary {
  readonly attemptCount: number;
  readonly passCount: number;
  readonly medianScore: number;
  readonly minimumScore: number;
  readonly maximumScore: number;
  readonly medianGeneratedTokens: number;
  readonly medianTtftMs?: number;
  readonly medianModelMs: number;
  readonly medianEndToEndMs: number;
  readonly attempts: readonly TrialAttempt[];
}

export interface EnvelopeRequirement {
  readonly id: string;
  readonly category: "hard" | "recommended" | "environment";
  readonly expected?: unknown;
  readonly observed?: unknown;
  readonly status: EnvelopeStatus;
  readonly severity: "blocking" | "degrading" | "informational";
  readonly owner: ConstraintOwner;
  readonly source: { readonly kind: "model-card" | "generation-config" | "tokenizer-config" | "runtime-doc"
    | "artifact-metadata" | "empirical"; readonly reference: string };
  readonly evidence?: string;
}

export interface OperatingEnvelope {
  readonly requirements: readonly EnvelopeRequirement[];
  readonly summary: {
    readonly hardRequirementsMet: number;
    readonly knownHardRequirements: number;
    readonly recommendedValuesMet: number;
    readonly knownRecommendedValues: number;
    readonly unknownCount: number;
    readonly blockingMisses: readonly string[];
    readonly degradingMisses: readonly string[];
  };
}

export interface CompatibilityQualification {
  readonly state: CompatibilityQualificationState;
  readonly profileId: string;
  readonly checks: readonly { readonly id: string; readonly passed: boolean; readonly evidence: string }[];
}
export interface AdapterConformanceResult {
  readonly passed: boolean;
  readonly checks: readonly { readonly id: string; readonly passed: boolean; readonly evidence: string }[];
}

export type ProductionFitnessCaseId = "PF1" | "PF2" | "PF3" | "PF4" | "PF5"
  | "PF6" | "PF7" | "PF8" | "PF9A" | "PF9B" | "PF10" | "PF11";
export interface ProductionFitnessCaseResult {
  readonly id: ProductionFitnessCaseId;
  readonly label: string;
  readonly passed: boolean;
  readonly score: number;
  readonly maximum: 10;
  readonly evidence: string;
  readonly validity: ResultValidity;
  readonly trialSummary: TrialSummary;
  readonly failureAttribution?: FailureAttribution | undefined;
  readonly outputs: readonly string[];
  readonly metrics: {
    readonly totalGeneratedTokens: number;
    readonly ttftMs?: number;
    readonly modelMs: number;
    readonly endToEndMs: number;
  };
}
export interface CharacterRoleplaySample {
  readonly id: "PF11B";
  readonly title: string;
  readonly contract: {
    readonly identity: string;
    readonly traits: readonly string[];
    readonly commitment: string;
    readonly relationship: string;
  };
  readonly turns: readonly {
    readonly user: string;
    readonly assistant: string;
    readonly metrics: GenerationMetrics;
    readonly invocation?: ModelInvocation;
  }[];
  readonly humanReviewOnly: true;
}
export interface ProductionFitnessResult {
  readonly passed: boolean;
  readonly score?: number;
  readonly maximum: 120;
  readonly cases: readonly ProductionFitnessCaseResult[];
  readonly totalGeneratedTokens: number;
  readonly medianTtftMs?: number;
  readonly modelMs: number;
  readonly endToEndMs: number;
  readonly validity: ResultValidity;
  readonly roleplaySample?: CharacterRoleplaySample;
}

export interface ScoreBreakdown { readonly id: `B${number}`; readonly score: number; readonly maximum: number;
  readonly evidence: string; readonly validity: ResultValidity; readonly trialSummary: TrialSummary;
  readonly failureAttribution?: FailureAttribution | undefined }
export interface GateResult {
  readonly id: "G2" | "G3";
  readonly passed: boolean;
  readonly evidence: string;
  readonly metrics: TaskRuntimeMetrics;
  readonly validity: ResultValidity;
  readonly trialSummary: TrialSummary;
  readonly failureAttribution?: FailureAttribution | undefined;
}
export interface ToolBenchmarkResult {
  readonly passed: boolean;
  readonly calls: readonly ToolCall[];
  readonly answer?: unknown;
  readonly score?: number;
  readonly metrics: TaskRuntimeMetrics;
  readonly validity: ResultValidity;
  readonly trialSummary: TrialSummary;
  readonly failureAttribution?: FailureAttribution | undefined;
}
export type EfficiencyResponsePolicy = "baseline" | "bounded" | "protocol";
export interface EfficiencyProbeResult {
  readonly taskId: "structured-record";
  readonly unscored: true;
  readonly budgets: Partial<Record<BudgetKey, readonly {
    readonly policy: EfficiencyResponsePolicy;
    readonly passed: boolean;
    readonly generatedTokens: number;
    readonly final: string;
    readonly termination: GenerationTermination;
    readonly invocation?: ModelInvocation;
  }[]>>;
}

export interface BudgetBenchmarkResult {
  readonly maxNewTokens: BenchmarkReasoningBudget;
  readonly status: "complete" | "failed";
  readonly failure?: string;
  readonly failureAttribution?: FailureAttribution;
  readonly validity: ResultValidity;
  readonly gates?: { readonly g2: GateResult; readonly g3: GateResult };
  readonly gatePass: boolean;
  readonly t1?: ToolBenchmarkResult;
  readonly t2?: ToolBenchmarkResult & { readonly score: number };
  readonly scores: readonly ScoreBreakdown[];
  readonly qualityScore?: number;
  readonly qualityStatus: "complete" | "stopped-after-gates";
  readonly medianTtftMs?: number;
  readonly totalGeneratedTokens: number;
  readonly rawOutputs: Readonly<Record<string, readonly string[]>>;
}

export interface BenchmarkFailure extends FailureAttribution {}
export interface CandidateBenchmarkResult {
  readonly candidateId: string;
  readonly label: string;
  readonly modelId: string;
  readonly revision: string;
  readonly dtype: BrowserModelCandidate["dtype"];
  readonly pipelineTask: BrowserModelCandidate["pipelineTask"];
  readonly approximateArtifactBytes?: number;
  readonly artifactUrls: readonly string[];
  readonly adapter: AdapterProfileReport;
  readonly adapterConformance: AdapterConformanceResult;
  readonly compatibilityQualification: CompatibilityQualification;
  readonly operatingEnvelope: OperatingEnvelope;
  readonly templateEvidence?: ModelTemplateEvidence;
  readonly validity: ResultValidity;
  readonly productionFitness?: ProductionFitnessResult;
  readonly efficiencyProbe?: EfficiencyProbeResult;
  readonly diagnosticProbes?: DiagnosticProbeResult;
  readonly diagnostics?: CandidateDiagnostics;
  readonly advancedAgent: {
    readonly g1: { readonly status?: "complete" | "not-run"; readonly passed: boolean; readonly output?: string;
      readonly generatedTokens?: number; readonly ttftMs?: number; readonly modelMs?: number;
      readonly validity: ResultValidity; readonly trialSummary?: TrialSummary;
      readonly failureAttribution?: FailureAttribution | undefined };
    readonly budgets: Partial<Record<BudgetKey, BudgetBenchmarkResult>>;
  };
  readonly cacheBytes?: number;
  readonly coldReadyMs?: number;
  readonly warmReadyRunsMs: readonly number[];
  readonly warmReadyMedianMs?: number;
  readonly structuredOutput: StructuredOutputMode;
  readonly visionCapability?: {
    readonly supported: boolean;
    readonly cases: readonly {
      readonly id: "V1" | "V2";
      readonly passed: boolean;
      readonly expected: string;
      readonly prompt: string;
      readonly attemptCount: 3;
      readonly passCount: number;
      readonly outputs: readonly string[];
      readonly metrics: readonly GenerationMetrics[];
      readonly invocations: readonly VisionInvocation[];
      readonly error?: string;
    }[];
    readonly score: number;
    readonly maximum: 2;
    readonly fixture: string;
  };
  readonly failures: readonly BenchmarkFailure[];
  readonly cacheReload: "verified" | "failed" | "not-run";
}

export interface WebGpuLimitSnapshot { readonly [name: string]: number }
export interface WebGpuCapabilities {
  readonly observedAt: string;
  readonly supported: boolean;
  readonly secureContext: boolean;
  readonly preferredCanvasFormat?: string;
  readonly adapterAcquired: boolean;
  readonly deviceAcquired: boolean;
  readonly adapterInfo?: {
    readonly vendor?: string;
    readonly architecture?: string;
    readonly device?: string;
    readonly description?: string;
  };
  readonly adapterFeatures: readonly string[];
  readonly deviceFeatures: readonly string[];
  readonly adapterLimits: WebGpuLimitSnapshot;
  readonly deviceLimits: WebGpuLimitSnapshot;
  readonly fallbackAdapter?: boolean;
  readonly error?: string;
}

export interface LiveWikipediaSmokeResult {
  readonly candidateId: string;
  readonly maxNewTokens: BenchmarkReasoningBudget;
  readonly passed: boolean;
  readonly calls: readonly ToolCall[];
  readonly answer?: unknown;
  readonly error?: string;
  readonly metrics?: TaskRuntimeMetrics;
  readonly validity: ResultValidity;
  readonly trialSummary?: TrialSummary;
  readonly failureAttribution?: FailureAttribution | undefined;
  readonly observedAt: string;
}

export interface BrowserAiBenchmarkArtifact {
  readonly schemaVersion: 13;
  readonly manifest: EvalManifest;
  readonly suite: "browser-ai-benchmark-v2";
  readonly benchmarkRevision: string;
  readonly machine: string;
  readonly generatedAt: string;
  readonly environment: { readonly userAgent: string; readonly webgpu: boolean; readonly transformersJs: "4.3.2" };
  readonly settings: { readonly backend: "webgpu"; readonly dtype: "candidate-defined"; readonly generationPolicy: "candidate-adapter";
    readonly maxContextTokens: 4096; readonly g1MaxNewTokens: 16;
    readonly productionFitnessMaxNewTokens: 256;
    readonly reasoningBudgets: readonly BenchmarkReasoningBudget[] };
  readonly webGpuCapabilities?: WebGpuCapabilities;
  readonly candidates: readonly CandidateBenchmarkResult[];
  readonly liveWikipediaSmoke?: LiveWikipediaSmokeResult;
}

export interface BrowserAiBenchmarkAutomationConfig {
  readonly candidateIds: readonly string[];
  readonly test: BrowserAiBenchmarkTest;
  readonly budgets: readonly BenchmarkReasoningBudget[];
  readonly cacheMode: BrowserAiBenchmarkCacheMode;
  readonly machine: string;
  readonly benchmarkRevision: string;
  readonly liveWikipedia: boolean;
}

export type BrowserAiBenchmarkAutomationState =
  | { readonly status: "idle"; readonly config: BrowserAiBenchmarkAutomationConfig }
  | { readonly status: "running"; readonly config: BrowserAiBenchmarkAutomationConfig; readonly detail?: string }
  | { readonly status: "complete"; readonly config: BrowserAiBenchmarkAutomationConfig;
      readonly artifact: BrowserAiBenchmarkArtifact }
  | { readonly status: "failed"; readonly config?: BrowserAiBenchmarkAutomationConfig; readonly error: string };

declare global {
  interface Window {
    __browserAiBenchmarkV2Automation?: BrowserAiBenchmarkAutomationState;
    __browserAiBenchmarkV2?: BrowserAiBenchmarkArtifact;
  }
}

export type BenchmarkWorkerRequest =
  | { readonly type: "INITIALIZE"; readonly candidate: BrowserModelCandidate }
  | { readonly type: "GENERATE"; readonly requestId: string; readonly invocation: ModelInvocation }
  | { readonly type: "GENERATE_VISION"; readonly requestId: string; readonly invocation: VisionInvocation }
  | { readonly type: "CANCEL"; readonly requestId: string }
  | { readonly type: "DISPOSE" }
  | { readonly type: "CLEAR_CACHE"; readonly candidateId: string };

export type BenchmarkWorkerResponse =
  | { readonly type: "PROGRESS"; readonly phase: string; readonly detail?: string }
  | { readonly type: "READY"; readonly metrics: InitializationMetrics }
  | { readonly type: "TOKEN"; readonly requestId: string; readonly text: string; readonly tokenCount: number }
  | { readonly type: "COMPLETE"; readonly requestId: string; readonly raw: string; readonly metrics: GenerationMetrics }
  | { readonly type: "CANCELLED"; readonly requestId: string; readonly metrics: GenerationMetrics }
  | { readonly type: "DISPOSED" }
  | { readonly type: "CACHE_CLEARED" }
  | { readonly type: "ERROR"; readonly operation: string; readonly message: string; readonly requestId?: string };
