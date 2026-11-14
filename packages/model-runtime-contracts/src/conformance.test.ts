import { describe, expect, it, vi } from "vitest";
import type { EnginePlugin, GenerationEvent, ModelSession, PluginManifest } from "./contracts";
import { parsePluginManifest } from "./manifest";
import { checkEngineCapability, PluginRegistry } from "./registry";

const manifest: PluginManifest & { kind: "engine" } = {
  schemaVersion: 1, id: "org.example.engine.mock", version: "1.0.0", apiVersion: 1,
  kind: "engine", entrypoint: "./index.js", environment: "node-worker",
  capabilities: ["text", "streaming", "cancellation"], permissions: ["network"],
};

function fakeEngine() {
  const events: GenerationEvent[] = [
    { type: "text-delta", text: "Hello!" },
    { type: "usage", inputTokens: 4, outputTokens: 2 },
    { type: "complete", finishReason: "stop" },
  ];
  const session: ModelSession = {
    async *generate() { yield* events; },
    tokenize: async () => 4,
    dispose: vi.fn(async () => {}),
  };
  const probe = vi.fn(async () => ({
    supported: ["text", "streaming", "cancellation"] as const,
    modelFormats: ["gguf"],
    quantizations: ["q4_k_m"],
    models: ["example/roleplay"],
  }));
  const load = vi.fn(async () => session);
  const dispose = vi.fn(async () => {});
  const plugin: EnginePlugin = {
    manifest,
    create: async () => ({ probe, load, dispose }),
  };
  return { plugin, session, probe, load, dispose };
}

describe("portable plugin manifests", () => {
  it("accepts a versioned declarative manifest", () => {
    expect(parsePluginManifest(manifest)).toEqual(manifest);
  });
  it("rejects unknown versions, permissions, entrypoint escapes and extra fields", () => {
    expect(() => parsePluginManifest({ ...manifest, apiVersion: 2 })).toThrow(/version/);
    expect(() => parsePluginManifest({ ...manifest, permissions: ["all"] })).toThrow(/permissions/);
    expect(() => parsePluginManifest({ ...manifest, entrypoint: "../attack.js" })).toThrow(/entrypoint/);
    expect(() => parsePluginManifest({ ...manifest, executionCode: "run()" })).toThrow(/Unknown/);
    expect(() => parsePluginManifest({ ...manifest, capabilities: ["text", "text"] })).toThrow(/unique/);
  });
});

describe("engine host lifecycle and conformance", () => {
  it("denies undeclared permissions without constructing the engine", async () => {
    const { plugin } = fakeEngine();
    const create = vi.spyOn(plugin, "create");
    const registry = new PluginRegistry();
    registry.register(plugin);
    await expect(registry.openEngine(manifest.id, [])).rejects.toThrow(/Permissions denied.*network/);
    expect(create).not.toHaveBeenCalled();
  });

  it("pins permissions and does not expose internal manifest arrays", async () => {
    const { plugin } = fakeEngine();
    const mutable = { ...plugin, manifest: { ...manifest, permissions: ["network"] as ("network" | "filesystem-write")[] } };
    const registry = new PluginRegistry();
    registry.register(mutable);
    mutable.manifest.permissions.push("filesystem-write");
    expect(registry.list()[0]?.permissions).toEqual(["network"]);
    await expect(registry.openEngine(manifest.id, [])).rejects.toThrow(/network/);
    const lease = await registry.openEngine(manifest.id, ["network"]);
    await lease.dispose();
  });

  it("rejects unsupported formats before loading weights", async () => {
    const { plugin, load } = fakeEngine();
    const registry = new PluginRegistry();
    registry.register(plugin);
    const lease = await registry.openEngine(manifest.id, ["network"]);
    await expect(lease.load({ model: { modelId: "example/roleplay", format: "onnx" } }, ["text"]))
      .rejects.toThrow(/Unsupported model format/);
    await expect(lease.load({ model: { modelId: "example/roleplay", format: "gguf" } }, ["vision"]))
      .rejects.toThrow(/Missing capability: vision/);
    expect(load).not.toHaveBeenCalled();
    await lease.dispose();
  });

  it("streams evidence, closes sessions, and tears down idempotently", async () => {
    const { plugin, session, dispose } = fakeEngine();
    const registry = new PluginRegistry();
    registry.register(plugin);
    expect(() => registry.register(plugin)).toThrow(/Duplicate/);
    const lease = await registry.openEngine(manifest.id, ["network"]);
    const opened = await lease.load({ model: {
      modelId: "example/roleplay", format: "gguf", quantization: "q4_k_m",
    } }, ["text", "streaming"]);
    const output: GenerationEvent[] = [];
    for await (const event of opened.generate({
      messages: [{ role: "user", content: [{ type: "text", text: "Hi" }] }],
      settings: { maxOutputTokens: 16 },
    })) output.push(event);
    expect(output.map(event => event.type)).toEqual(["text-delta", "usage", "complete"]);
    expect(await opened.tokenize?.([])).toBe(4);
    await opened.dispose();
    await opened.dispose();
    expect(session.dispose).toHaveBeenCalledTimes(1);
    await lease.dispose();
    await lease.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(() => opened.generate({ messages: [], settings: { maxOutputTokens: 1 } }))
      .toThrow(/disposed/);
  });

  it("produces explicit eligibility reasons", () => {
    expect(checkEngineCapability({
      supported: ["text"], modelFormats: ["gguf"], quantizations: ["q4_k_m"],
    }, { pluginId: manifest.id, requiredCapabilities: ["vision"], format: "onnx" }))
      .toEqual({ eligible: false, reasons: [
        "Missing capability: vision", "Unsupported model format: onnx",
      ] });
  });
});
