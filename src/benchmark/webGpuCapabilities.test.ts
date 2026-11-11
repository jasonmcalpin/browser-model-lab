import { describe, expect, it, vi } from "vitest";
import { probeWebGpuCapabilities, snapshotWebGpuLimits } from "./webGpuCapabilities";

describe("portable WebGPU capability probe", () => {
  it("records standardized numeric limits without depending on enumerable implementation fields", () => {
    const limits = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(limits, "maxBufferSize", { value: 4_294_967_296 });
    Object.defineProperty(limits, "maxStorageBufferBindingSize", { value: 1_073_741_824 });
    limits.unrelatedExtension = "ignored";
    expect(snapshotWebGpuLimits(limits)).toMatchObject({
      maxBufferSize: 4_294_967_296,
      maxStorageBufferBindingSize: 1_073_741_824,
    });
  });

  it("reports adapter and device limits, features, identity, and destroys the temporary device", async () => {
    const destroy = vi.fn();
    const result = await probeWebGpuCapabilities({ secureContext: true, now: () => "2026-11-10T12:00:00.000Z",
      gpu: { getPreferredCanvasFormat: () => "bgra8unorm", requestAdapter: async () => ({
        features: new Set(["shader-f16"]), limits: { maxBufferSize: 8_000, maxStorageBufferBindingSize: 4_000 },
        info: { vendor: "portable-vendor", architecture: "portable-architecture" }, isFallbackAdapter: false,
        requestDevice: async () => ({ features: new Set(["shader-f16"]), limits: { maxBufferSize: 6_000 }, destroy }),
      }) },
    });
    expect(result).toMatchObject({ supported: true, secureContext: true, adapterAcquired: true, deviceAcquired: true,
      preferredCanvasFormat: "bgra8unorm", adapterInfo: { vendor: "portable-vendor" },
      adapterFeatures: ["shader-f16"], adapterLimits: { maxBufferSize: 8_000 }, deviceLimits: { maxBufferSize: 6_000 } });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("returns bounded evidence for unsupported WebGPU and device-request failures", async () => {
    await expect(probeWebGpuCapabilities({ secureContext: false, now: () => "now" }))
      .resolves.toMatchObject({ supported: false, adapterAcquired: false, deviceAcquired: false, error: expect.any(String) });
    await expect(probeWebGpuCapabilities({ secureContext: true, now: () => "now", gpu: { requestAdapter: async () => ({
      features: new Set(), limits: {}, requestDevice: async () => { throw new Error("limit rejected"); },
    }) } })).resolves.toMatchObject({ supported: true, adapterAcquired: true, deviceAcquired: false,
      error: "Device request failed: limit rejected" });
  });
});
