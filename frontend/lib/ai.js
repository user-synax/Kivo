// Kivo AI client: on-device first (Chrome Built-in AI, unlimited + private),
// backend proxy (/api/v1/ai → Groq → Gemini) as fallback + mobile.
// JS only. All functions return { text?, replies?, source, cached? }.

import { apiGet, apiPost } from "./api.js";

const memCache = new Map(); // key -> { data, expiresAt }
const MEM_TTL = 60 * 60 * 1000;
const MEM_MAX = 200;

function memGet(key) {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return e.data;
}

function memSet(key, data) {
  if (memCache.size >= MEM_MAX) {
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
  memCache.set(key, { data, expiresAt: Date.now() + MEM_TTL });
}

function keyFor(task, payload) {
  return `${task}:${JSON.stringify(payload).slice(0, 2000)}`;
}

let statusCache = null;
let statusAt = 0;
export async function aiServerStatus() {
  if (statusCache && Date.now() - statusAt < 60000) return statusCache;
  try {
    const data = await apiGet("/api/v1/ai/status");
    statusCache = data;
    statusAt = Date.now();
    return data;
  } catch {
    return { configured: false };
  }
}

export function onDeviceCaps() {
  if (typeof window === "undefined") return { available: false };
  const w = window;
  return {
    available: Boolean(
      w.Translator ||
        w.LanguageDetector ||
        w.Proofreader ||
        w.Rewriter ||
        w.Writer ||
        w.Summarizer ||
        w.LanguageModel,
    ),
    translator: Boolean(w.Translator),
    detector: Boolean(w.LanguageDetector),
    proofreader: Boolean(w.Proofreader),
    rewriter: Boolean(w.Rewriter),
    writer: Boolean(w.Writer),
    summarizer: Boolean(w.Summarizer),
    prompt: Boolean(w.LanguageModel),
  };
}

// --- On-device attempts (each best-effort, throws on unavailable) ---

async function onDeviceTranslate(text, targetLang = "en") {
  const T = window.Translator;
  if (!T) throw new Error("no-translator");
  if (typeof T.availability === "function") {
    try {
      const a = await T.availability({
        sourceLanguage: "auto",
        targetLanguage: targetLang,
      });
      if (a === "unavailable") throw new Error("unavailable");
    } catch (e) {
      if (e?.message === "unavailable") throw e;
    }
  }
  const t = await T.create({
    sourceLanguage: "auto",
    targetLanguage: targetLang,
  });
  const out = await t.translate(text);
  return String(out || "").trim();
}

async function onDeviceProofread(text) {
  const P = window.Proofreader;
  if (!P) throw new Error("no-proofreader");
  const p = await P.create();
  const res = await p.proofread(text);
  // ProofreadResult { correctedInput, corrections[] } or plain string.
  if (typeof res === "string") return res.trim();
  if (res?.correctedInput) return String(res.correctedInput).trim();
  throw new Error("empty");
}

async function onDeviceRewrite(text, tone = "friendly") {
  const R = window.Rewriter || window.Writer;
  if (!R) throw new Error("no-rewriter");
  const opts = {};
  if (window.Rewriter) {
    opts.tone =
      tone === "formal" ? "formal" : tone === "confident" ? "formal" : "casual";
    opts.length =
      tone === "shorter" ? "shorter" : tone === "longer" ? "longer" : "as-is";
  }
  const r = await R.create(opts);
  const out = await r.rewrite(text);
  return String(out || "").trim();
}

async function onDeviceReplies(recent) {
  const LM = window.LanguageModel;
  if (!LM) throw new Error("no-prompt");
  const session = await LM.create({ temperature: 0.6, topK: 3 });
  const prompt = `Suggest 3 short chat replies (each under 60 chars) to this conversation, same language. Return ONLY a JSON array of 3 strings.\n${recent
    .slice(-4)
    .map((m, i) => `${i + 1}. ${m.slice(0, 200)}`)
    .join("\n")}`;
  const out = await session.prompt(prompt);
  const m = String(out).match(/\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : out);
}

// Generic helper: try on-device fn, fall back to backend POST.
async function withFallback(task, payload, onDeviceFn, backendPath) {
  const key = keyFor(task, payload);
  const hit = memGet(key);
  if (hit) return { ...hit, cached: true };
  try {
    if (onDeviceFn) {
      const text = await onDeviceFn();
      if (text && (typeof text === "string" ? text.trim() : true)) {
        const data =
          typeof text === "string"
            ? { text: text.trim(), source: "on-device" }
            : { ...text, source: "on-device" };
        memSet(key, data);
        return { ...data, cached: false };
      }
    }
  } catch {
    // fall through to cloud
  }
  const data = await apiPost(backendPath, payload);
  const out = {
    ...data,
    source: data?.provider ? `cloud:${data.provider}` : "cloud",
  };
  memSet(key, out);
  return { ...out, cached: Boolean(data?.cached) };
}

export function translateText(text, targetLang = "en") {
  const t = String(text || "").trim();
  if (!t) return Promise.resolve({ text: "", source: "none" });
  return withFallback(
    "translate",
    { text: t.slice(0, 8000), targetLang },
    () => onDeviceTranslate(t, targetLang),
    "/api/v1/ai/translate",
  );
}

export function proofreadText(text) {
  const t = String(text || "").trim();
  if (!t) return Promise.resolve({ text: "", source: "none" });
  return withFallback(
    "proofread",
    { text: t.slice(0, 8000) },
    () => onDeviceProofread(t),
    "/api/v1/ai/proofread",
  );
}

export function rewriteText(text, tone = "friendly") {
  const t = String(text || "").trim();
  if (!t) return Promise.resolve({ text: "", source: "none" });
  return withFallback(
    `rewrite:${tone}`,
    { text: t.slice(0, 8000), tone },
    () => onDeviceRewrite(t, tone),
    "/api/v1/ai/rewrite",
  );
}

export async function suggestReplies(recentMessages) {
  const msgs = (recentMessages || [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(-8);
  if (!msgs.length) return { replies: [], source: "none" };
  const key = keyFor("replies", { msgs });
  const hit = memGet(key);
  if (hit) return { ...hit, cached: true };
  try {
    const arr = await onDeviceReplies(msgs);
    const replies = Array.isArray(arr)
      ? arr
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    if (replies.length) {
      const data = { replies, source: "on-device" };
      memSet(key, data);
      return { ...data, cached: false };
    }
  } catch {
    // cloud fallback below
  }
  const data = await apiPost("/api/v1/ai/replies", { messages: msgs });
  const out = {
    replies: data?.replies || [],
    source: data?.provider ? `cloud:${data.provider}` : "cloud",
    quota: data?.quota,
  };
  memSet(key, out);
  return { ...out, cached: Boolean(data?.cached) };
}

export function summarizeMessages(messages, style = "bullets") {
  const msgs = (messages || [])
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(-50);
  if (!msgs.length) return Promise.resolve({ text: "", source: "none" });
  return withFallback(
    "summarize",
    { messages: msgs, style },
    null,
    "/api/v1/ai/summarize",
  );
}
