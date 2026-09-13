// AI provider clients: Groq (OpenAI-compatible, primary) + Gemini (fallback).
// No extra deps — global fetch with timeout. Keys never leave the server.
// JS only, Bun/Node compatible.

import env from "../config/env.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Fast + cheap for short rewrites; quality model for translate/summarize.
// NOTE (Sep 2026): llama-3.1-8b-instant / llama-3.3-70b-versatile moved to
// Groq Enterprise ("Contact Sales") — free developer keys get 404
// model_not_found for them. gpt-oss-20b/120b are the free production models
// (250K TPM / 1K RPM on the developer plan). Override via env if needed.
export const GROQ_FAST_MODEL = process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";
export const GROQ_QUALITY_MODEL = process.env.GROQ_QUALITY_MODEL || "openai/gpt-oss-120b";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
const FETCH_TIMEOUT_MS = 20000;

let groqCursor = 0;
function nextGroqKey() {
  const pool = env.groqApiKeys?.length ? env.groqApiKeys : env.groqApiKey ? [env.groqApiKey] : [];
  if (!pool.length) return null;
  const key = pool[groqCursor % pool.length];
  groqCursor += 1;
  return key;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function aiConfigured() {
  return Boolean(env.groqApiKey || env.groqApiKeys?.length || env.geminiApiKey);
}

function order() {
  const o = env.aiProviderOrder?.length ? env.aiProviderOrder : ["groq", "gemini"];
  // Only keep providers that actually have keys.
  return o.filter((p) => {
    if (p === "groq") return Boolean(env.groqApiKey || env.groqApiKeys?.length);
    if (p === "gemini") return Boolean(env.geminiApiKey);
    return false;
  });
}

async function callGroq({ system, user, model, maxTokens, temperature }) {
  const key = nextGroqKey();
  if (!key) throw Object.assign(new Error("Groq not configured"), { provider: "groq", retryable: false });
  const res = await fetchWithTimeout(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (res.status === 429 || res.status >= 500) {
    throw Object.assign(new Error(`Groq ${res.status}`), { provider: "groq", retryable: true, status: res.status });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // Retired/renamed model (free keys get 404 model_not_found for Enterprise
    // models) — fail over to the next provider instead of surfacing Groq's 404.
    const retryable = res.status === 404;
    throw Object.assign(new Error(`Groq ${res.status}: ${t.slice(0, 200)}`), { provider: "groq", retryable, status: res.status });
  }
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content?.trim?.();
  if (!text) throw Object.assign(new Error("Groq empty"), { provider: "groq", retryable: true });
  return { text, provider: "groq", model };
}

async function callGemini({ system, user, maxTokens, temperature }) {
  if (!env.geminiApiKey) throw Object.assign(new Error("Gemini not configured"), { provider: "gemini", retryable: false });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  });
  if (res.status === 429 || res.status >= 500) {
    throw Object.assign(new Error(`Gemini ${res.status}`), { provider: "gemini", retryable: true, status: res.status });
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw Object.assign(new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`), { provider: "gemini", retryable: false, status: res.status });
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p?.text || "").join("").trim();
  if (!text) throw Object.assign(new Error("Gemini empty"), { provider: "gemini", retryable: true });
  return { text, provider: "gemini", model: GEMINI_MODEL };
}

// Try providers in order, failing over on 429/5xx/empty/retired-model-404. Returns { text, provider, model }.
export async function complete({ system, user, quality = "fast", maxTokens = 500, temperature = 0.3 }) {
  const providers = order();
  if (!providers.length) {
    const err = new Error("AI_NOT_CONFIGURED");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }
  const groqModel = quality === "quality" ? GROQ_QUALITY_MODEL : GROQ_FAST_MODEL;
  let lastErr = null;
  for (const p of providers) {
    try {
      if (p === "groq") return await callGroq({ system, user, model: groqModel, maxTokens, temperature });
      if (p === "gemini") return await callGemini({ system, user, maxTokens, temperature });
    } catch (err) {
      lastErr = err;
      const isLast = providers.indexOf(p) === providers.length - 1;
      // Fail over to the next provider on retryable errors (429/5xx/empty/
      // retired-model 404). Anything else (bad request, bad key) surfaces
      // immediately so misconfiguration is visible instead of silently slow.
      if (isLast || !err?.retryable) throw err;
    }
  }
  throw lastErr || new Error("AI_FAILED");
}
