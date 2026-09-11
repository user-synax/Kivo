"use client";

// Nearby discovery helpers — geolocation + distance formatting
// Privacy: raw coordinates never rendered, only fuzzed distance via server.

export function fuzzDistanceMeters(meters) {
  if (meters == null || Number.isNaN(meters)) return null;
  if (meters < 1000) {
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    return rounded;
  }
  const km = Math.round((meters / 1000) * 10) / 10;
  return Math.round(km * 1000);
}

export function formatDistance(meters, labelAlreadyFuzzed = false) {
  if (meters == null) return null;
  const d = labelAlreadyFuzzed ? meters : fuzzDistanceMeters(meters);
  if (d < 1000) return `${d} m away`;
  return `${(d / 1000).toFixed(1)} km away`;
}

export function formatDistanceShort(meters) {
  if (meters == null) return null;
  const d = fuzzDistanceMeters(meters);
  if (d < 1000) return `${d}m`;
  return `${(d / 1000).toFixed(1)}km`;
}

// One-shot geolocation — resolves { lat, lng, accuracy } or rejects with message
export function getCurrentPosition({ timeout = 12000, enableHighAccuracy = true, maximumAge = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        let msg = "Could not get your location";
        if (err.code === 1) msg = "Location permission denied — enable it in browser settings";
        else if (err.code === 2) msg = "Location unavailable — try again outdoors";
        else if (err.code === 3) msg = "Location timed out — try again";
        const e = new Error(msg);
        e.code = err.code;
        reject(e);
      },
      { timeout, enableHighAccuracy, maximumAge }
    );
  });
}

export async function checkGeolocationPermission() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const res = await navigator.permissions.query({ name: "geolocation" });
    return res.state; // "granted" | "prompt" | "denied"
  } catch {
    return "unknown";
  }
}
