import type { Capability, CapabilityDescriptor, EnginePlugin, InferenceEngine,
  ModelIdentity, ModelLoadRequest, ModelSession, Permission, PluginEnvironment, PluginModule } from "./contracts";
import { parsePluginManifest } from "./manifest";

export interface EngineSelection {
  readonly pluginId: string;
  readonly requiredCapabilities: readonly Capability[];
  readonly format?: string;
  readonly quantization?: string;
  readonly modelId?: string;
}

export function checkEngineCapability(descriptor: CapabilityDescriptor, request: EngineSelection): {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
} {
  const reasons: string[] = [];
  for (const capability of request.requiredCapabilities)
    if (!descriptor.supported.includes(capability)) reasons.push(`Missing capability: ${capability}`);
  if (request.format && !descriptor.modelFormats.includes(request.format))
    reasons.push(`Unsupported model format: ${request.format}`);
  if (request.quantization && !descriptor.quantizations.includes(request.quantization))
    reasons.push(`Unsupported quantization: ${request.quantization}`);
  if (request.modelId && descriptor.models && !descriptor.models.includes(request.modelId))
    reasons.push(`Model not available: ${request.modelId}`);
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Host-side registry. No package resolution, dynamic import, process spawning or
 * ambient permissions occur here. A separate trusted transport/loader supplies
 * already verified modules, and an actual execution boundary must enforce grants.
 */
export class PluginRegistry {
  private readonly modules = new Map<string, PluginModule>();

  register(module: PluginModule): void {
    const manifest = parsePluginManifest(module.manifest);
    if (this.modules.has(manifest.id)) throw new Error(`Duplicate plugin ID: ${manifest.id}`);
    if (manifest.kind !== module.manifest.kind) throw new Error("Plugin kind mismatch.");
    this.modules.set(manifest.id, module);
  }

  list(): readonly PluginModule["manifest"][] {
    return [...this.modules.values()].map(module => module.manifest);
  }

  get(id: string): PluginModule {
    const module = this.modules.get(id);
    if (!module) throw new Error(`Unknown plugin: ${id}`);
    return module;
  }

  async openEngine(id: string, grants: readonly Permission[],
    config: Readonly<Record<string, unknown>> = {}): Promise<EngineLease> {
    const module = this.get(id);
    if (module.manifest.kind !== "engine") throw new Error(`Plugin is not an engine: ${id}`);
    const required = module.manifest.permissions.filter(permission => !grants.includes(permission));
    if (required.length) throw new Error(`Permissions denied for ${id}: ${required.join(", ")}`);
    const environment: PluginEnvironment = { engineId: id, config, grantedPermissions: [...grants] };
    const engine = await (module as EnginePlugin).create(environment);
    return new EngineLease(id, engine);
  }
}

export class EngineLease {
  private readonly sessions = new Set<ModelSession>();
  private disposed = false;

  constructor(readonly pluginId: string, private readonly engine: InferenceEngine) {}

  async probe(): Promise<CapabilityDescriptor> {
    this.ensureOpen();
    return this.engine.probe();
  }

  async load(request: ModelLoadRequest, requiredCapabilities: readonly Capability[] = []): Promise<ModelSession> {
    this.ensureOpen();
    const descriptor = await this.engine.probe();
    const selection: EngineSelection = {
      pluginId: this.pluginId,
      requiredCapabilities,
      ...(request.model.format ? { format: request.model.format } : {}),
      ...(request.model.quantization ? { quantization: request.model.quantization } : {}),
      modelId: request.model.modelId,
    };
    const checked = checkEngineCapability(descriptor, selection);
    if (!checked.eligible) throw new Error(`Ineligible engine: ${checked.reasons.join("; ")}`);
    const session = await this.engine.load(request);
    this.sessions.add(session);
    const originalDispose = session.dispose.bind(session);
    let closed = false;
    return {
      generate: (generation, signal) => {
        if (closed || this.disposed) throw new Error("Model session is disposed.");
        return session.generate(generation, signal);
      },
      ...(session.tokenize ? { tokenize: (messages) => {
        if (closed || this.disposed) throw new Error("Model session is disposed.");
        return session.tokenize!(messages);
      } } : {}),
      dispose: async () => {
        if (closed) return;
        closed = true;
        this.sessions.delete(session);
        await originalDispose();
      },
    };
  }

  private ensureOpen(): void {
    if (this.disposed) throw new Error("Engine lease is disposed.");
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const results = await Promise.allSettled([...this.sessions].map(session => session.dispose()));
    this.sessions.clear();
    try { await this.engine.dispose(); }
    finally {
      const failures = results.filter(result => result.status === "rejected");
      if (failures.length) throw new AggregateError(
        failures.map(result => (result as PromiseRejectedResult).reason),
        `${failures.length} model sessions failed during disposal.`);
    }
  }
}
