import { describe, expect, it } from "vitest";
import { executeTool, toolDefinitions } from "./toolHarness";

describe("browser AI benchmark V2 fixture tools", () => {
  it("keeps Wikipedia ranking deterministic and network-free", async () => {
    const search = await executeTool({ tool: "wikipedia_search", args: { query: "Kant four questions" } });
    const page = await executeTool({ tool: "wikipedia_page", args: { title: "Philosophy" } });
    expect(search.ok).toBe(true);
    expect(JSON.stringify(page.result)).toContain("What can I know?");
  });

  it("enforces relay capability grants and terminal healthy evidence", async () => {
    expect(await executeTool({ tool: "retire_relay", args: { id: "R-17", reason: "guess" } }))
      .toMatchObject({ ok: false, error: "Tool is unknown or not granted." });
    expect(await executeTool({ tool: "inspect_relay", args: { id: "R-17" } }))
      .toMatchObject({ ok: true, result: { health: "healthy", actionRequired: false } });
  });

  it("publishes the exact deterministic argument schemas supplied to every model adapter", () => {
    expect(toolDefinitions(["inspect_relay", "wikipedia_search", "wikipedia_page"]))
      .toMatchObject([
        { name: "inspect_relay", inputSchema: { required: ["id"], additionalProperties: false } },
        { name: "wikipedia_search", inputSchema: { required: ["query"], additionalProperties: false } },
        { name: "wikipedia_page", inputSchema: { required: ["title"], additionalProperties: false } },
      ]);
  });
});
