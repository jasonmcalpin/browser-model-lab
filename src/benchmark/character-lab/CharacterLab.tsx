import { useEffect, useRef, useState } from "react";
import { BROWSER_AI_BENCHMARK_CANDIDATES } from "../candidates";
import { parseBrowserModelCard } from "../modelCards";
import { BenchmarkWorkerClient } from "../workerClient";
import type { BrowserModelCandidate, CanonicalGenerationRequest, InitializationMetrics, ModelMessage } from "../types";
import { acceptCompression, characterMessages, compressionRequest, contextUsage,
  DEFAULT_CHARACTER_SETTINGS, dueForCompression, INITIAL_CHARACTER_SESSION,
  recordCharacterExchange, validateCharacterSettings, type CharacterLabSettings,
  type CharacterSession } from "./memory";
import { estimateRoleTokens, estimateSummaryTokens, requestEvidence, validateContextBudget,
  type RequestEvidence, type TraceEvent } from "./trace";
import "./characterLab.css";

type ImportedExperiment = { session: CharacterSession; settings?: CharacterLabSettings;
  traces?: RequestEvidence[]; model?: unknown };
const defaultCandidate = BROWSER_AI_BENCHMARK_CANDIDATES.find(c => c.id === "lfm3-1.7b-q4f16")
  ?? BROWSER_AI_BENCHMARK_CANDIDATES[0]!;
const now = () => new Date().toISOString();
function metricSeconds(ms: number | undefined): string { return ms === undefined ? "—" : (ms / 1000).toFixed(2) + "s"; }
function downloadJson(data: unknown, filename: string): void {
  const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}
function executionOverrides(s: CharacterLabSettings): CanonicalGenerationRequest["generationOverrides"] {
  return {
    doSample: s.sampling === "sample",
    ...(s.sampling === "sample" ? { temperature: s.temperature, topP: s.topP,
      topK: s.topK, minP: s.minP } : {}),
    repetitionPenalty: s.repetitionPenalty,
    presencePenalty: s.presencePenalty,
  };
}

export function CharacterLab() {
  const [selectedId, setSelectedId] = useState(defaultCandidate.id);
  const [customCard, setCustomCard] = useState("");
  const [candidate, setCandidate] = useState<BrowserModelCandidate | null>(null);
  const [loadMetrics, setLoadMetrics] = useState<InitializationMetrics | null>(null);
  const [settings, setSettings] = useState<CharacterLabSettings>(DEFAULT_CHARACTER_SETTINGS);
  const [session, setSession] = useState<CharacterSession>(INITIAL_CHARACTER_SESSION);
  const [input, setInput] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState("No model loaded.");
  const [busy, setBusy] = useState(false);
  const [traces, setTraces] = useState<RequestEvidence[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string>("");
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [imported, setImported] = useState<ImportedExperiment | null>(null);
  const client = useRef<BenchmarkWorkerClient | null>(null);
  const sequence = useRef(0);

  useEffect(() => () => { client.current?.terminate(); client.current = null; }, []);
  const emit = (phase: string, detail: string, durationMs?: number): TraceEvent => {
    const entry = { timestamp: now(), phase, detail,
      ...(durationMs === undefined ? {} : { durationMs }) };
    setEvents(prev => [...prev, entry]);
    return entry;
  };
  const updateNumber = (key: keyof CharacterLabSettings, value: string) =>
    setSettings(prev => ({ ...prev, [key]: Number(value) }));
  const updateString = (key: keyof CharacterLabSettings, value: string) =>
    setSettings(prev => ({ ...prev, [key]: value }));
  const resolveCandidate = (): BrowserModelCandidate => {
    if (customCard.trim()) return parseBrowserModelCard(JSON.parse(customCard), "character lab card").candidate;
    const model = BROWSER_AI_BENCHMARK_CANDIDATES.find(c => c.id === selectedId);
    if (!model) throw new Error("Unknown candidate.");
    return model;
  };
  const clearSession = () => {
    setSession(INITIAL_CHARACTER_SESSION);
    setTraces([]);
    setSelectedTraceId("");
    setEvents([]);
    emit("reset", "Conversation and telemetry reset; model retained.");
  };
  const load = async () => {
    if (busy) return;
    setBusy(true);
    try {
      validateCharacterSettings(settings);
      const chosen = resolveCandidate();
      client.current?.terminate();
      client.current = new BenchmarkWorkerClient((phase, detail) => {
        setStatus(phase + (detail ? ": " + detail : ""));
        if (phase === "INITIALIZING" || phase === "ERROR") emit("model", phase + ": " + (detail ?? ""));
      });
      setCandidate(null);
      setStatus("Loading " + chosen.label);
      const started = performance.now();
      const result = await client.current.initialize(chosen);
      setLoadMetrics(result);
      setCandidate(chosen);
      clearSession();
      emit("model", "Ready: " + chosen.id, performance.now() - started);
      setStatus("Ready: " + chosen.label);
    } catch (error) {
      setStatus("Load failed: " + String(error));
      emit("error", String(error));
      setCandidate(null);
      client.current?.terminate();
      client.current = null;
    } finally { setBusy(false); }
  };

  const observe = async (kind: "dialogue" | "summary", messages: readonly ModelMessage[],
    active: CharacterLabSettings, maxNewTokens: number): Promise<RequestEvidence> => {
    const runtime = client.current;
    if (!runtime || !candidate) throw new Error("Model not loaded.");
    validateContextBudget(messages, { ...active, maxNewTokens });
    const startedAt = now();
    const traceId = kind + "-" + (++sequence.current);
    const localEvents: TraceEvent[] = [];
    const record = (phase: string, detail: string, durationMs?: number) => {
      const event = emit(phase, detail, durationMs);
      localEvents.push(event);
    };
    const request: CanonicalGenerationRequest = {
      messages, maxNewTokens, workload: "production",
      generationOverrides: kind === "summary" ? { doSample: false } : executionOverrides(active),
    };
    record("context", kind + " prompt assembled; " + messages.length + " messages");
    const tokenStarted = performance.now();
    const tokenized = await runtime.tokenize(request);
    record("tokenize", tokenized.method + " (" + (tokenized.tokens ?? "unavailable") + " tokens)",
      performance.now() - tokenStarted);
    if (tokenized.tokens !== undefined && tokenized.tokens + maxNewTokens > active.contextWindow)
      throw new Error("Tokenizer prompt plus output exceeds configured context target. No generation sent.");
    const started = performance.now();
    record("generate", "Begin " + kind + " with " + maxNewTokens + " max new tokens");
    const result = await runtime.generate(request);
    record("generate", "Completed " + result.metrics.generatedTokens + " tokens; " + result.metrics.termination,
      performance.now() - started);
    const evidence = requestEvidence({ id: traceId, kind, model: candidate.id, startedAt,
      messages, settings: active, result, tokenizer: tokenized, events: localEvents });
    setTraces(prev => [...prev, evidence]);
    setSelectedTraceId(traceId);
    return evidence;
  };

  const compress = async (current: CharacterSession, active: CharacterLabSettings): Promise<CharacterSession> => {
    const task = compressionRequest(current, active);
    const evidence = await observe("summary", task.messages, active, active.summaryMaxNewTokens);
    const updated = acceptCompression(current, evidence.output, task.compressedTurnCount);
    emit("memory", "Compressed " + (task.compressedTurnCount / 2) +
      " pairs; retained " + (updated.recent.length / 2) + " recent pairs.");
    setSession(updated);
    return updated;
  };

  const runTurn = async (current: CharacterSession, text: string,
    active: CharacterLabSettings): Promise<CharacterSession> => {
    const messages = characterMessages(current, text, instructions.trim(), active);
    const evidence = await observe("dialogue", messages, active, active.maxNewTokens);
    let updated = recordCharacterExchange(current, text, evidence.output);
    setSession(updated);
    if (active.compressionMode === "automatic" && dueForCompression(updated, active)) {
      setStatus("Compressing older dialogue…");
      try { updated = await compress(updated, active); }
      catch (error) { emit("compression-error", String(error)); setStatus("Reply saved; compression failed: " + String(error)); }
    }
    return updated;
  };
  const send = async () => {
    const text = input.trim();
    if (!candidate || busy || !text) return;
    setBusy(true);
    try {
      validateCharacterSettings(settings);
      await runTurn(session, text, { ...settings });
      setInput("");
      setStatus("Reply received.");
    } catch (error) { emit("error", String(error)); setStatus("Request failed: " + String(error)); }
    finally { setBusy(false); }
  };
  const compressNow = async () => {
    if (busy || !candidate) return;
    setBusy(true);
    try { await compress(session, settings); setStatus("Manual compression complete."); }
    catch (error) { emit("error", String(error)); setStatus("Compression failed: " + String(error)); }
    finally { setBusy(false); }
  };
  const readImport = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object") throw new Error("Not a session file.");
      const document = parsed as Record<string, unknown>;
      const historic = document.session as CharacterSession | undefined;
      if (!historic || !Array.isArray(historic.transcript)
        || historic.transcript.some(t => !["user", "assistant"].includes(t.role) || typeof t.content !== "string"))
        throw new Error("Missing valid conversation transcript.");
      setImported({
        session: historic,
        ...(document.settings && typeof document.settings === "object"
          ? { settings: document.settings as CharacterLabSettings } : {}),
        ...(Array.isArray(document.traces) ? { traces: document.traces as RequestEvidence[] } : {}),
      });
      setStatus("Imported session available for inspection or replay.");
      emit("import", "Session imported with " + historic.transcript.length + " turns.");
    } catch (error) { setStatus("Import failed: " + String(error)); }
  };
  const replay = async () => {
    if (!candidate || !imported || busy) return;
    setBusy(true);
    try {
      validateCharacterSettings(settings);
      const prompts = imported.session.transcript.filter(t => t.role === "user").map(t => t.content);
      clearSession();
      emit("replay", "Replaying " + prompts.length + " recorded user turns with current model/settings.");
      let current: CharacterSession = INITIAL_CHARACTER_SESSION;
      for (const prompt of prompts) current = await runTurn(current, prompt, { ...settings });
      setStatus("Replay completed: " + prompts.length + " exchanges.");
    } catch (error) { emit("error", String(error)); setStatus("Replay stopped: " + String(error)); }
    finally { setBusy(false); }
  };
  const selected = traces.find(t => t.id === selectedTraceId);
  const preview = characterMessages(session, input || "(next user message)", instructions, settings);
  const usage = contextUsage(preview, settings);
  const lastReply = [...traces].reverse().find(t => t.kind === "dialogue");
  const inputOptions = [
    { key: "maxNewTokens", label: "Response tokens", min: 64, max: 1536, step: 64 },
    { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.05 },
    { key: "topP", label: "Top-p", min: 0, max: 1, step: 0.05 },
    { key: "topK", label: "Top-k", min: 0, max: 200, step: 1 },
    { key: "minP", label: "Min-p", min: 0, max: 1, step: 0.05 },
    { key: "repetitionPenalty", label: "Repetition penalty", min: 0.5, max: 2, step: 0.05 },
    { key: "presencePenalty", label: "Presence penalty", min: -2, max: 2, step: 0.1 },
    { key: "contextWindow", label: "Context target", min: 1024, max: 65536, step: 1024 },
    { key: "roleBudget", label: "Role allocation", min: 64, max: 8192, step: 64 },
    { key: "summaryBudget", label: "Summary allocation", min: 0, max: 8192, step: 64 },
    { key: "recentPairs", label: "Recent pairs", min: 0, max: 12, step: 1 },
    { key: "compressAfterPairs", label: "Compress after pairs", min: 1, max: 24, step: 1 },
    { key: "summaryMaxNewTokens", label: "Summary response tokens", min: 64, max: 1024, step: 64 },
  ] as const;
  const selectedFields = [
    { key: "sampling", label: "Decoding", values: ["sample", "greedy"] },
    { key: "memoryStrategy", label: "Memory strategy", values: ["rolling", "full", "recent", "none"] },
    { key: "compressionMode", label: "Compression", values: ["automatic", "manual"] },
  ] as const;

  return <section className="ui-panel character-lab" aria-label="Interactive character lab">
    <header><div><p className="eyebrow">EXPERIMENT / VISIBLE EXECUTION TRACE</p>
      <h2>Mara character lab</h2>
      <p>Probe model behavior, deliberately change short/long-term memory, and inspect each inference boundary. This lab never changes game progression.</p>
    </div></header>
    <div className="character-lab__controls">
      <label>Model<select value={selectedId} disabled={busy} onChange={e => setSelectedId(e.target.value)}>
        {BROWSER_AI_BENCHMARK_CANDIDATES.map(c =>
          <option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label>
      {selectedFields.map(field => <label key={field.key}>{field.label}
        <select value={settings[field.key]} disabled={busy}
          onChange={e => updateString(field.key, e.target.value)}>
          {field.values.map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>)}
      {inputOptions.map(option => <label key={option.key}>{option.label}
        <input type="number" min={option.min} max={option.max} step={option.step}
          value={settings[option.key]} disabled={busy}
          onChange={e => updateNumber(option.key, e.target.value)}/></label>)}
    </div>
    <details><summary>Experimental model card JSON</summary>
      <textarea aria-label="Model card JSON" rows={5} value={customCard} disabled={busy}
        onChange={e => setCustomCard(e.target.value)} placeholder="Paste validated BML v3 model card JSON."/>
    </details>
    <label className="character-lab__instructions">Additional character direction
      <textarea rows={3} value={instructions} disabled={busy}
        onChange={e => setInstructions(e.target.value)} placeholder="Optional experimental character direction."/>
    </label>
    <div className="character-lab__actions">
      <button className="ui-primary" disabled={busy} onClick={() => void load()}>LOAD / RESTART MODEL</button>
      <button className="ui-secondary" disabled={busy} onClick={clearSession}>RESET SESSION</button>
      <button className="ui-secondary" disabled={busy} onClick={() => {
        setSession(prev => ({ ...prev, recent: [] })); emit("memory", "Recent context cleared by experimenter.");
      }}>CLEAR SHORT-TERM</button>
      <button className="ui-secondary" disabled={busy} onClick={() => {
        setSession(prev => ({ ...prev, summary: "" })); emit("memory", "Long-term summary cleared by experimenter.");
      }}>CLEAR LONG-TERM</button>
      <button className="ui-secondary" disabled={busy || !candidate || session.recent.length / 2 <= settings.recentPairs}
        onClick={() => void compressNow()}>COMPRESS NOW</button>
      <button className="ui-secondary" disabled={!session.transcript.length} onClick={() =>
        downloadJson({ schemaVersion: 2, exportedAt: now(), model: candidate,
          settings, additionalInstructions: instructions, loadMetrics, session, traces, events },
        "mara-character-lab.json")}>EXPORT EXPERIMENT</button>
      <label className="character-lab__import">IMPORT EXPERIMENT
        <input type="file" accept=".json,application/json" disabled={busy} onChange={e => {
          const file = e.target.files?.[0]; if (file) void readImport(file);
        }}/>
      </label>
      <button className="ui-secondary" disabled={busy || !candidate || !imported}
        onClick={() => void replay()}>REPLAY IMPORTED PROMPTS</button>
      <button className="ui-secondary" disabled={busy || !imported}
        onClick={() => { if (imported) {
          setSession(imported.session); setTraces(imported.traces ?? []);
          emit("import", "Imported session loaded for inspection (not regenerated).");
        } }}>INSPECT IMPORTED SESSION</button>
    </div>
    <p role="status">{status}</p>
    <div className="character-lab__stats">
      <span>Model load: <strong>{metricSeconds(loadMetrics?.readyMs)}</strong></span>
      <span>Last first token: <strong>{metricSeconds(lastReply?.firstTokenMs)}</strong></span>
      <span>Last generation: <strong>{metricSeconds(lastReply?.generationMs)}</strong></span>
      <span>Last output: <strong>{lastReply?.outputTokens ?? "—"} tokens</strong></span>
      <span>Decode: <strong>{lastReply ? lastReply.tokensPerSecond.toFixed(1) + " t/s" : "—"}</strong></span>
    </div>
    <div className="character-lab__workspace">
      <div className="character-lab__conversation">
        <h3>Live conversation</h3>
        <div className="character-lab__messages" aria-live="polite">
          {session.transcript.length === 0 && <p>Load a model and start speaking to Mara.</p>}
          {session.transcript.map((turn,index) => {
            const trace = turn.role === "assistant"
              ? traces.filter(t => t.kind === "dialogue")[Math.floor(index / 2)] : undefined;
            return <div className="character-lab__message" data-role={turn.role} key={index}>
              <strong>{turn.role === "assistant" ? "Mara" : "You"}</strong>
              <p>{turn.content}</p>
              {trace && <button className="ui-quiet" onClick={() => setSelectedTraceId(trace.id)}>
                {new Date(trace.completedAt).toLocaleTimeString()} · {trace.outputTokens} tokens ·
                {metricSeconds(trace.firstTokenMs)} first · {metricSeconds(trace.generationMs)} total · INSPECT
              </button>}
            </div>;
          })}
        </div>
        <form onSubmit={e => { e.preventDefault(); void send(); }}>
          <textarea aria-label="Message to Mara" rows={3} value={input} disabled={!candidate || busy}
            onChange={e => setInput(e.target.value)} placeholder="Write a message to Mara."/>
          <button className="ui-primary" type="submit" disabled={!candidate || busy || !input.trim()}>SEND</button>
        </form>
      </div>
      <div className="character-lab__memory">
        <h3>Context and memory</h3>
        <p>{session.compressionCount} compressions · {session.recent.length/2} recent pairs · {session.transcript.length/2} total pairs</p>
        <dl className="character-lab__usage">
          <div><dt>Role</dt><dd>~{estimateRoleTokens(preview)} / {settings.roleBudget} allocated</dd></div>
          <div><dt>Long-term summary</dt><dd>~{estimateSummaryTokens(preview)} / {settings.summaryBudget} allocated</dd></div>
          <div><dt>Total prompt</dt><dd>~{usage.estimatedPromptTokens} tokens</dd></div>
          <div><dt>Output reserve</dt><dd>{settings.maxNewTokens} tokens</dd></div>
          <div><dt>Remaining estimate</dt><dd>{usage.remainingEstimated} tokens</dd></div>
        </dl>
        <p className="character-lab__notice">Section counts are estimates, excluding tokenizer template overhead. Context target is a lab guard, not a change to the model's native context limit. Exact rendered-prompt count appears in the request inspector where supported.</p>
        <label>Editable long-term summary<textarea aria-label="Long-term memory summary" rows={8}
          value={session.summary} disabled={busy}
          onChange={e => setSession(prev => ({ ...prev, summary: e.target.value }))}/></label>
        <details><summary>Recent context</summary><pre>{JSON.stringify(session.recent,null,2)}</pre></details>
        <details><summary>Next request composition</summary><pre>{JSON.stringify(preview,null,2)}</pre></details>
      </div>
    </div>
    <div className="character-lab__inspector">
      <h3>Inference request inspector</h3>
      <label>Request
        <select value={selectedTraceId} onChange={e => setSelectedTraceId(e.target.value)}>
          <option value="">Choose recorded request</option>
          {traces.map(t => <option key={t.id} value={t.id}>{t.id} · {t.completedAt} · {t.kind}</option>)}
        </select>
      </label>
      {selected ? <>
        <div className="character-lab__stats">
          <span>Started: {selected.startedAt}</span>
          <span>Finished: {selected.completedAt}</span>
          <span>Prompt: {selected.tokenizerPromptTokens === undefined
            ? "~" + selected.promptEstimate.estimatedPromptTokens + " estimated"
            : selected.tokenizerPromptTokens + " tokenizer tokens"}</span>
          <span>Output: {selected.outputTokens} tokens</span>
          <span>Time: {metricSeconds(selected.generationMs)}</span>
          <span>Termination: {selected.termination}</span>
        </div>
        <p>Tokenizer method: {selected.tokenizerMethod}. Section counts are approximate and do not include template overhead.</p>
        <details open><summary>Steps and timing</summary>
          <ol>{selected.events.map((e,i) => <li key={i}>{e.timestamp} · {e.phase} · {e.detail}
            {e.durationMs === undefined ? "" : " · " + Math.round(e.durationMs) + "ms"}</li>)}</ol>
        </details>
        <details><summary>Exact request messages and per-section estimates</summary>
          <pre>{JSON.stringify({ messages: selected.messages, sections: selected.promptEstimate.items },null,2)}</pre></details>
        <details><summary>Applied vs requested settings</summary>
          <pre>{JSON.stringify({ requested: selected.requestedSettings,
            appliedGeneration: selected.appliedGenerationSettings },null,2)}</pre></details>
        <details><summary>Rendered tokenizer prompt</summary>
          <pre>{selected.renderedPrompt ?? "Unavailable from this tokenizer/runtime."}</pre></details>
        <details><summary>Model output</summary><pre>{selected.output}</pre></details>
      </> : <p>Select a request to inspect its actual parameters and trace.</p>}
    </div>
    <details className="character-lab__events"><summary>All session events ({events.length})</summary>
      <ol>{events.map((event,i) => <li key={i}>{event.timestamp} · {event.phase} · {event.detail}
        {event.durationMs === undefined ? "" : " · " + Math.round(event.durationMs) + "ms"}</li>)}</ol></details>
    <p>Seed, true model context allocation, prefill time, and peak GPU memory remain unavailable until an adapter provides trustworthy instrumentation. No hidden console logging is required.</p>
  </section>;
}
