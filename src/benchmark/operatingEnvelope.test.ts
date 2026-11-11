import { describe, expect, it } from "vitest";
import { checkAdapterConformance } from "./adapterConformance";
import { candidateById } from "./candidates";
import { adapterReport } from "./modelAdapters";
import { buildOperatingEnvelope } from "./operatingEnvelope";

describe("browser AI operating envelope", () => {
  it("keeps unknown evidence distinct from blocking misses", () => {
    const candidate = candidateById("qwen3-0.6b-q4f16-control");
    const envelope = buildOperatingEnvelope({ candidate, adapter: adapterReport(candidate),
      adapterConformance: checkAdapterConformance(candidate), initialized: false,
      initializationAttempted: true, initializationError: "WebGPU device unavailable", userAgent: "test-browser" });
    expect(envelope.requirements.find((entry) => entry.id === "runtime-webgpu-device")?.status).toBe("UNKNOWN");
    expect(envelope.requirements.find((entry) => entry.id === "model-initialization")?.status).toBe("NOT_MET");
    expect(envelope.summary.blockingMisses).toContain("model-initialization");
    expect(envelope.summary.unknownCount).toBeGreaterThan(0);
  });

  it("records adapter conformance and portable WebGPU evidence when observed", () => {
    const candidate = candidateById("smollm2-1.7b-instruct-q4f16");
    const conformance = checkAdapterConformance(candidate);
    expect(conformance.passed).toBe(true);
    const envelope = buildOperatingEnvelope({ candidate, adapter: adapterReport(candidate),
      adapterConformance: conformance, initializationAttempted: true, initialized: true,
      cacheBytes: 42, userAgent: "test-browser",
      capabilities: { observedAt: "2026-11-10T00:00:00Z", supported: true, secureContext: true,
        adapterAcquired: true, deviceAcquired: true, adapterFeatures: [], deviceFeatures: ["shader-f16"],
        adapterLimits: {}, deviceLimits: { maxBufferSize: 1, maxStorageBufferBindingSize: 1 } },
    });
    expect(envelope.summary.blockingMisses).toEqual([]);
    expect(envelope.requirements.find((entry) => entry.id === "adapter-conformance")?.status).toBe("MET");
    expect(envelope.requirements.find((entry) => entry.id === "gpu-memory-capacity")?.status).toBe("UNKNOWN");
  });
});
