import { useEffect, useRef, useState } from "react";
import { BROWSER_AI_BENCHMARK_CANDIDATES } from "../candidates";
import { parseBrowserModelCard } from "../modelCards";
import { BenchmarkWorkerClient } from "../workerClient";
import type { BrowserModelCandidate, GenerationResult } from "../types";
import {
  acceptCompression, characterMessages, compressionRequest, DEFAULT_CHARACTER_SETTINGS,
  dueForCompression, INITIAL_CHARACTER_SESSION, recordCharacterExchange,
  validateCharacterSettings, type CharacterLabSettings, type CharacterSession,
} from "./memory";
import "./characterLab.css";

type ExchangeMetric = { readonly tokens: number; readonly firstTokenMs?: number; readonly generationMs: number };
const defaultCandidate = BROWSER_AI_BENCHMARK_CANDIDATES.find((c) => c.id === "lfm3-1.7b-q4f16")
  ?? BROWSER_AI_BENCHMARK_CANDIDATES[0]!;
function metric(result: GenerationResult): ExchangeMetric {
  return { tokens: result.metrics.generatedTokens, firstTokenMs: result.metrics.firstTokenMs,
    generationMs: result.metrics.generationMs };
}
export function CharacterLab() {
  const [selectedId, setSelectedId] = useState(defaultCandidate.id);
  const [customCard, setCustomCard] = useState("");
  const [candidate, setCandidate] = useState<BrowserModelCandidate | null>(null);
  const [settings, setSettings] = useState<CharacterLabSettings>(DEFAULT_CHARACTER_SETTINGS);
  const [session, setSession] = useState<CharacterSession>(INITIAL_CHARACTER_SESSION);
  const [input, setInput] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState("No model loaded.");
  const [busy, setBusy] = useState(false);
  const [lastMetric, setLastMetric] = useState<ExchangeMetric | null>(null);
  const [summaries, setSummaries] = useState<readonly { before: string; after: string; turnCount: number; metric: ExchangeMetric }[]>([]);
  const client = useRef<BenchmarkWorkerClient | null>(null);
  useEffect(() => () => { client.current?.terminate(); client.current = null; }, []);
  const resolveCandidate = (): BrowserModelCandidate => {
    if (customCard.trim()) return parseBrowserModelCard(JSON.parse(customCard), "character lab custom card").candidate;
    const match = BROWSER_AI_BENCHMARK_CANDIDATES.find((x) => x.id === selectedId);
    if (!match) throw new Error("Unknown selected model.");
    return match;
  };
  const load = async () => {
    if (busy) return;
    setBusy(true);
    try {
      validateCharacterSettings(settings);
      const chosen = resolveCandidate();
      client.current?.terminate();
      client.current = new BenchmarkWorkerClient((phase, detail) => setStatus(`${phase}: ${detail ?? ""}`));
      setCandidate(null);
      setSession(INITIAL_CHARACTER_SESSION);
      setSummaries([]);
      setLastMetric(null);
      setStatus(`Loading ${chosen.label}…`);
      await client.current.initialize(chosen);
      setCandidate(chosen);
      setStatus(`Ready: ${chosen.label}`);
    } catch (error) {
      setStatus(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
      setCandidate(null);
      client.current?.terminate();
      client.current = null;
    } finally { setBusy(false); }
  };
  const send = async () => {
    const prompt = input.trim();
    const runtime = client.current;
    if (!candidate || !runtime || !prompt || busy) return;
    setBusy(true);
    try {
      validateCharacterSettings(settings);
      const reply = await runtime.generate({
        messages: characterMessages(session, prompt, instructions.trim()),
        maxNewTokens: settings.maxNewTokens,
        workload: "production",
        generationOverrides: { doSample: settings.temperature > 0, ...(settings.temperature > 0 ? { temperature: settings.temperature } : {}) },
      });
      const updated = recordCharacterExchange(session, prompt, reply.final);
      setInput("");
      setLastMetric(metric(reply));
      setSession(updated);
      setStatus("Reply received.");
      if (dueForCompression(updated, settings)) {
        setStatus("Compressing older dialogue into long-term summary…");
        const task = compressionRequest(updated, settings);
        try {
          const result = await runtime.generate({
            messages: task.messages, maxNewTokens: settings.summaryMaxNewTokens,
            workload: "production", generationOverrides: { doSample: false },
          });
          const compressed = acceptCompression(updated, result.final, task.compressedTurnCount);
          setSession(compressed);
          setSummaries((history) => [...history, {
            before: updated.summary, after: compressed.summary, turnCount: task.compressedTurnCount, metric: metric(result),
          }]);
          setStatus("Reply received; prior dialogue compressed.");
        } catch (error) {
          setStatus(`Reply received; compression failed, history retained: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error) {
      setStatus(`Generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  };
  const exportSession = () => {
    const payload = { schemaVersion: 1, createdAt: new Date().toISOString(),
      model: candidate ? { id: candidate.id, modelId: candidate.modelId, revision: candidate.revision,
        compatibilityProfileId: candidate.compatibilityProfileId } : null,
      settings, additionalInstructions: instructions, session, summaries, lastMetric };
    const href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = href; anchor.download = "mara-character-session.json"; anchor.click();
    URL.revokeObjectURL(href);
  };
  const settingNumber = (key: keyof CharacterLabSettings, value: string) => {
    const number = Number(value);
    setSettings((current) => ({ ...current, [key]: number }));
  };
  return <section className="ui-panel character-lab" aria-label="Interactive character lab">
    <header><div><p className="eyebrow">EXPERIMENT / NON-AUTHORITATIVE</p><h2>Mara conversation lab</h2>
      <p>Talk directly to a local model. Change her memory span, summarization frequency, sampling, and output ceiling. These experiments do not change Code Gauntlet.</p></div></header>
    <div className="character-lab__controls">
      <label>Model<select disabled={busy} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        {BROWSER_AI_BENCHMARK_CANDIDATES.map((model) =>
          <option key={model.id} value={model.id}>{model.label}</option>)}
      </select></label>
      <label>Response tokens<input type="number" min={64} max={1536} step={64} value={settings.maxNewTokens}
        onChange={(e) => settingNumber("maxNewTokens", e.target.value)}/></label>
      <label>Temperature<input type="number" min={0} max={2} step={0.05} value={settings.temperature}
        onChange={(e) => settingNumber("temperature", e.target.value)}/></label>
      <label>Recent exchange pairs<input type="number" min={0} max={12} value={settings.recentPairs}
        onChange={(e) => settingNumber("recentPairs", e.target.value)}/></label>
      <label>Compress after pairs<input type="number" min={1} max={24} value={settings.compressAfterPairs}
        onChange={(e) => settingNumber("compressAfterPairs", e.target.value)}/></label>
      <label>Summary output tokens<input type="number" min={64} max={1024} step={64} value={settings.summaryMaxNewTokens}
        onChange={(e) => settingNumber("summaryMaxNewTokens", e.target.value)}/></label>
    </div>
    <details><summary>Load experimental model card JSON</summary><p>Paste one validated BML v3 card. This overrides the model dropdown when loading, allowing archived/experimental models without changing the main benchmark inventory.</p>
      <textarea aria-label="Experimental model card JSON" value={customCard} disabled={busy}
        onChange={(event) => setCustomCard(event.target.value)} rows={5} placeholder='{"schemaVersion":3,"candidate":{...}}'/></details>
    <label className="character-lab__instructions">Additional character direction<textarea rows={3} value={instructions}
      disabled={busy} onChange={(e) => setInstructions(e.target.value)}
      placeholder="Optional: make Mara more skeptical, terse, or damaged. Canonical character instructions remain in force."/></label>
    <div className="character-lab__actions">
      <button className="ui-primary" disabled={busy} onClick={() => void load()}>LOAD / RESTART MODEL</button>
      <button className="ui-secondary" disabled={busy} onClick={() => { setSession(INITIAL_CHARACTER_SESSION); setSummaries([]); setLastMetric(null); setStatus("Conversation reset."); }}>RESET CONVERSATION</button>
      <button className="ui-secondary" disabled={session.transcript.length === 0} onClick={exportSession}>EXPORT TRANSCRIPT + MEMORY</button>
    </div>
    <p role="status">{status}{lastMetric && ` · ${lastMetric.tokens} tokens · ${Math.round(lastMetric.generationMs)} ms total · ${Math.round(lastMetric.firstTokenMs ?? 0)} ms first token`}</p>
    <div className="character-lab__workspace">
      <div className="character-lab__conversation">
        <h3>Conversation</h3>
        <div className="character-lab__messages" aria-live="polite">
          {session.transcript.length === 0 ? <p>Load a model, then begin speaking to Mara.</p>
            : session.transcript.map((turn, index) => <div className="character-lab__message" data-role={turn.role} key={index}>
              <strong>{turn.role === "assistant" ? "Mara" : "You"}</strong><p>{turn.content}</p></div>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea aria-label="Message to Mara" value={input} rows={3} disabled={!candidate || busy}
            onChange={(e) => setInput(e.target.value)} placeholder="Your absence is on the record. What do you tell her?"/>
          <button className="ui-primary" disabled={!candidate || busy || !input.trim()} type="submit">SEND</button>
        </form>
      </div>
      <div className="character-lab__memory">
        <h3>Memory inspector</h3>
        <p>{session.compressionCount} compressions · {session.recent.length / 2} recent pairs · {session.transcript.length / 2} total pairs</p>
        <label>Long-term summary<textarea aria-label="Long-term summary" readOnly rows={9} value={session.summary || "(none yet)"}/></label>
        <details><summary>Recent context supplied to model</summary><pre>{JSON.stringify(session.recent, null, 2)}</pre></details>
        <details><summary>Summary revisions ({summaries.length})</summary><pre>{JSON.stringify(summaries, null, 2)}</pre></details>
        <p>Raw conversation remains visible for inspection and export. Only recent exchanges plus the rolling summary are sent to the model after compression. Failed compression retains the uncompressed context.</p>
      </div>
    </div>
  </section>;
}
