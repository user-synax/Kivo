"use client";

import { apiGet, apiPost } from "@/lib/api";

// Thin client for the calls backend (POST /api/v1/calls/*) + call ringtones.
// LiveKit room plumbing lives in components/calls/call-provider.jsx; this
// module stays UI-free so it can be imported anywhere.

// --- REST ---------------------------------------------------------------

export async function fetchCallsConfig() {
  try {
    const data = await apiGet("/api/v1/calls/config");
    return { enabled: Boolean(data?.enabled), url: data?.url || null };
  } catch {
    return { enabled: false, url: null };
  }
}

export function fetchCallToken(conversationId, kind = "voice") {
  return apiPost("/api/v1/calls/token", { conversationId, kind });
}

export async function fetchCallStatus(conversationId) {
  try {
    const data = await apiGet(
      `/api/v1/calls/status?conversationId=${encodeURIComponent(conversationId)}`,
    );
    return {
      active: Boolean(data?.active),
      participantCount: Number(data?.participantCount) || 0,
    };
  } catch {
    return { active: false, participantCount: 0 };
  }
}

// --- Ringtones (Web Audio, no assets) ------------------------------------
// Outgoing: classic dual-tone ringback (440 + 480 Hz, 2s on / 4s off).
// Incoming: bright warble (880 Hz alternating) while the overlay shows.

let ringCtx = null;
let ringTimer = null;
let ringNodes = [];

function ensureCtx() {
  if (!ringCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ringCtx = new AC();
  }
  if (ringCtx.state === "suspended") ringCtx.resume().catch(() => {});
  return ringCtx;
}

function stopNodes() {
  for (const n of ringNodes) {
    try {
      n.stop?.();
    } catch {}
    try {
      n.disconnect?.();
    } catch {}
  }
  ringNodes = [];
}

function tone(freq, when, dur, gain = 0.04) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + when);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + when + 0.05);
  g.gain.setValueAtTime(gain, ctx.currentTime + when + dur - 0.05);
  g.gain.linearRampToValueAtTime(0, ctx.currentTime + when + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + dur + 0.05);
  ringNodes.push(osc, g);
}

export function startRinger(mode = "outgoing") {
  stopRinger();
  const ctx = ensureCtx();
  if (!ctx) return;
  const playCycle = () => {
    stopNodes();
    if (mode === "incoming") {
      // Warble: 6 alternating bursts.
      for (let i = 0; i < 6; i += 1) {
        tone(i % 2 === 0 ? 880 : 660, i * 0.22, 0.2, 0.05);
      }
    } else {
      // Ringback: dual tone, 2s on.
      tone(440, 0, 2, 0.035);
      tone(480, 0, 2, 0.035);
    }
  };
  playCycle();
  ringTimer = setInterval(playCycle, mode === "incoming" ? 2000 : 6000);
}

export function stopRinger() {
  if (ringTimer) {
    clearInterval(ringTimer);
    ringTimer = null;
  }
  stopNodes();
}
