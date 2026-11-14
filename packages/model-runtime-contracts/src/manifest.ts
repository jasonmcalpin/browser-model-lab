import type { Capability, ExecutionEnvironment, Permission, PluginKind, PluginManifest } from "./contracts";

const KINDS: ReadonlySet<string> = new Set<PluginKind>(["engine", "protocol", "loader"]);
const ENVIRONMENTS: ReadonlySet<string> = new Set<ExecutionEnvironment>(
  ["browser-worker", "node-worker", "external-service"]);
const CAPABILITIES: ReadonlySet<string> = new Set<Capability>(
  ["text", "vision", "audio-input", "audio-output", "streaming", "tool-calling", "tokenization", "cancellation"]);
const PERMISSIONS: ReadonlySet<string> = new Set<Permission>(
  ["network", "gpu", "filesystem-read", "filesystem-write", "subprocess", "secrets"]);
const ALLOWED_FIELDS = new Set(["schemaVersion", "id", "version", "apiVersion", "kind",
  "entrypoint", "environment", "capabilities", "permissions", "configSchema", "description"]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Plugin manifest must be an object.");
  return value as Record<string, unknown>;
}
function stringList(value: unknown, allowed: ReadonlySet<string>, field: string): void {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !allowed.has(item))
    || new Set(value).size !== value.length)
    throw new Error(`Invalid plugin ${field}: expected unique supported values.`);
}

export function parsePluginManifest(value: unknown): PluginManifest {
  const v = record(value);
  for (const field of Object.keys(v))
    if (!ALLOWED_FIELDS.has(field)) throw new Error(`Unknown plugin manifest field: ${field}`);
  if (v.schemaVersion !== 1 || v.apiVersion !== 1)
    throw new Error("Unsupported plugin manifest or contract API version.");
  if (typeof v.id !== "string" || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/.test(v.id))
    throw new Error("Plugin ID must be a reverse-domain-style lowercase identifier.");
  if (typeof v.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(v.version))
    throw new Error("Plugin version must be semver.");
  if (typeof v.kind !== "string" || !KINDS.has(v.kind))
    throw new Error("Unsupported plugin kind.");
  if (typeof v.environment !== "string" || !ENVIRONMENTS.has(v.environment))
    throw new Error("Unsupported plugin execution environment.");
  if (typeof v.entrypoint !== "string" || !/^\.\/[a-zA-Z0-9_./-]+\.(?:js|mjs)$/.test(v.entrypoint)
    || v.entrypoint.split("/").includes(".."))
    throw new Error("Plugin entrypoint must be a safe local JavaScript path.");
  stringList(v.capabilities, CAPABILITIES, "capabilities");
  stringList(v.permissions, PERMISSIONS, "permissions");
  if (v.configSchema !== undefined
    && (typeof v.configSchema !== "string" || !/^\.\/[a-zA-Z0-9_./-]+\.json$/.test(v.configSchema)
      || v.configSchema.split("/").includes("..")))
    throw new Error("Invalid plugin configSchema path.");
  if (v.description !== undefined && (typeof v.description !== "string" || v.description.length > 1000))
    throw new Error("Invalid plugin description.");
  // Copy known fields explicitly: untrusted input must not carry unknown payloads.
  return {
    schemaVersion: 1,
    id: v.id,
    version: v.version,
    apiVersion: 1,
    kind: v.kind as PluginManifest["kind"],
    entrypoint: v.entrypoint,
    environment: v.environment as PluginManifest["environment"],
    capabilities: [...v.capabilities as string[]] as Capability[],
    permissions: [...v.permissions as string[]] as Permission[],
    ...(v.configSchema === undefined ? {} : { configSchema: v.configSchema as string }),
    ...(v.description === undefined ? {} : { description: v.description as string }),
  };
}
