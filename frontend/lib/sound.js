// DM-only sound cue — Phase 3.
// PLACEHOLDER ASSET REQUIRED: add a distinct custom sound at public/sounds/dm.mp3
// (do not reuse any existing sound). This module lazy-loads it as a single
// Audio instance and respects the mute flag in localStorage["kivo:sound"].
// Mute flag: default "on" (play). Set to "off"/"false"/"0" to mute.

let audio = null;
let loadAttempted = false;

function getAudio() {
  if (typeof window === "undefined") return null;
  if (audio) return audio;
  if (loadAttempted) return null;
  loadAttempted = true;
  try {
    // Distinct DM-only cue — not reused elsewhere.
    // Flag: ensure public/sounds/dm.mp3 exists and is a short, pleasant chime.
    audio = new Audio("/sounds/dm.mp3");
    audio.preload = "auto";
    audio.volume = 0.9;
  } catch {
    audio = null;
  }
  return audio;
}

function isMuted() {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem("kivo:sound");
    if (raw === null) return false; // default on
    const v = String(raw).trim().toLowerCase();
    return v === "off" || v === "false" || v === "0" || v === "muted";
  } catch {
    return false;
  }
}

export function playDmSound() {
  if (isMuted()) return;
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {}
}

export function setSoundEnabled(enabled) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kivo:sound", enabled ? "on" : "off");
  } catch {}
}

export function isSoundEnabled() {
  return !isMuted();
}
