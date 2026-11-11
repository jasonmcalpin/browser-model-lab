import type { WebGpuCapabilities, WebGpuLimitSnapshot } from "./types";

const LIMIT_NAMES = [
  "maxTextureDimension1D", "maxTextureDimension2D", "maxTextureDimension3D", "maxTextureArrayLayers",
  "maxBindGroups", "maxBindGroupsPlusVertexBuffers", "maxBindingsPerBindGroup", "maxDynamicUniformBuffersPerPipelineLayout",
  "maxDynamicStorageBuffersPerPipelineLayout", "maxSampledTexturesPerShaderStage", "maxSamplersPerShaderStage",
  "maxStorageBuffersPerShaderStage", "maxStorageTexturesPerShaderStage", "maxUniformBuffersPerShaderStage",
  "maxUniformBufferBindingSize", "maxStorageBufferBindingSize", "minUniformBufferOffsetAlignment",
  "minStorageBufferOffsetAlignment", "maxVertexBuffers", "maxBufferSize", "maxVertexAttributes",
  "maxVertexBufferArrayStride", "maxInterStageShaderVariables", "maxColorAttachments", "maxColorAttachmentBytesPerSample",
  "maxComputeWorkgroupStorageSize", "maxComputeInvocationsPerWorkgroup", "maxComputeWorkgroupSizeX",
  "maxComputeWorkgroupSizeY", "maxComputeWorkgroupSizeZ", "maxComputeWorkgroupsPerDimension",
] as const;

interface LimitSource { readonly [name: string]: unknown }
interface FeatureSource extends Iterable<string> {}
interface AdapterLike {
  readonly features: FeatureSource;
  readonly limits: LimitSource;
  readonly info?: Record<string, unknown>;
  readonly isFallbackAdapter?: boolean;
  requestAdapterInfo?(): Promise<Record<string, unknown>>;
  requestDevice(): Promise<DeviceLike>;
}
interface DeviceLike {
  readonly features: FeatureSource;
  readonly limits: LimitSource;
  destroy?(): void;
}
interface GpuLike {
  requestAdapter(options?: { powerPreference?: "high-performance" | "low-power" }): Promise<AdapterLike | null>;
  getPreferredCanvasFormat?(): string;
}
interface ProbeEnvironment {
  readonly gpu?: GpuLike;
  readonly secureContext: boolean;
  readonly now: () => string;
}
export function snapshotWebGpuLimits(source: LimitSource): WebGpuLimitSnapshot {
  const snapshot: Record<string, number> = {};
  for (const name of LIMIT_NAMES) {
    const value = source[name];
    if (typeof value === "number" && Number.isFinite(value)) snapshot[name] = value;
  }
  return snapshot;
}

function textField(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

async function adapterInfo(adapter: AdapterLike): Promise<WebGpuCapabilities["adapterInfo"]> {
  const info = adapter.info ?? await adapter.requestAdapterInfo?.() ?? {};
  const vendor = textField(info.vendor);
  const architecture = textField(info.architecture);
  const device = textField(info.device);
  const description = textField(info.description);
  const normalized = {
    ...(vendor ? { vendor } : {}),
    ...(architecture ? { architecture } : {}),
    ...(device ? { device } : {}),
    ...(description ? { description } : {}),
  };
  return Object.keys(normalized).length ? normalized : undefined;
}

export async function probeWebGpuCapabilities(environment?: ProbeEnvironment): Promise<WebGpuCapabilities> {
  const browserGpu = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { gpu?: GpuLike }).gpu;
  const browserEnvironment: ProbeEnvironment = environment ?? { ...(browserGpu ? { gpu: browserGpu } : {}),
    secureContext: globalThis.isSecureContext, now: () => new Date().toISOString() };
  const base = { observedAt: browserEnvironment.now(), supported: Boolean(browserEnvironment.gpu),
    secureContext: browserEnvironment.secureContext, adapterAcquired: false, deviceAcquired: false,
    adapterFeatures: [], deviceFeatures: [], adapterLimits: {}, deviceLimits: {} } as const;
  if (!browserEnvironment.gpu) return { ...base, error: "WebGPU is unavailable in this browser context." };

  try {
    const adapter = await browserEnvironment.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return { ...base, error: "WebGPU did not provide an adapter." };
    const adapterFeatures = [...adapter.features].sort();
    const adapterLimits = snapshotWebGpuLimits(adapter.limits);
    const info = await adapterInfo(adapter);
    try {
      const device = await adapter.requestDevice();
      const result: WebGpuCapabilities = {
        ...base, adapterAcquired: true, deviceAcquired: true,
        ...(browserEnvironment.gpu.getPreferredCanvasFormat
          ? { preferredCanvasFormat: browserEnvironment.gpu.getPreferredCanvasFormat() } : {}),
        ...(info ? { adapterInfo: info } : {}),
        ...(adapter.isFallbackAdapter === undefined ? {} : { fallbackAdapter: adapter.isFallbackAdapter }),
        adapterFeatures, deviceFeatures: [...device.features].sort(), adapterLimits,
        deviceLimits: snapshotWebGpuLimits(device.limits),
      };
      device.destroy?.();
      return result;
    } catch (error) {
      return { ...base, adapterAcquired: true, ...(info ? { adapterInfo: info } : {}),
        adapterFeatures, adapterLimits, error: `Device request failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  } catch (error) {
    return { ...base, error: `Adapter request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}
