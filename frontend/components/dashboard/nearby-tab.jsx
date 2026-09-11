"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin, RefreshCw, Settings, Navigation, Loader2, MapPinned, Shield, SearchX, AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ProfilePreviewCard } from "@/components/dashboard/profile-preview-card";
import { apiGet, apiPost } from "@/lib/api";
import { getCurrentPosition, checkGeolocationPermission } from "@/lib/location";
import { getSession } from "@/lib/auth";

const EASE = [0.22, 1, 0.36, 1];
const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
];

function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-[var(--hover)] text-[var(--text-muted)]">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
      <p className="text-[13px] text-[var(--text-muted)]">{title}</p>
      {hint && <p className="text-[12px] text-[var(--text-muted)]/70 max-w-[280px]">{hint}</p>}
      {action}
    </div>
  );
}

// Consent sheet — first time user opens Nearby
function ConsentSheet({ open, onAllow, onDeny }) {
  const reduce = useReducedMotion();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close" onClick={onDeny} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE }}
        className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-9 rounded-full bg-[var(--border)] sm:hidden" />
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <MapPinned className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Discover nearby friends</h3>
            <p className="text-xs text-[var(--text-muted)]">Privacy-first — we show distance only</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <p className="flex gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
            <Shield className="h-4 w-4 shrink-0 text-[var(--accent)]" /> We never share your exact location — others see only ~250m or 1.2km away.
          </p>
          <p className="flex gap-2 text-xs leading-relaxed text-[var(--text-muted)]">
            <Navigation className="h-4 w-4 shrink-0 text-[var(--accent)]" /> You’re discoverable by default — turn off anytime in Settings → Privacy.
          </p>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onDeny} className="flex-1 rounded-full border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover)]">
            Not now
          </button>
          <button type="button" onClick={onAllow} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--on-accent)] hover:opacity-90">
            <Navigation className="h-4 w-4" /> Allow location
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function NearbyTab({ onStartChat, onViewProfile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [radius, setRadius] = useState(5000);
  const [showConsent, setShowConsent] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const reduce = useReducedMotion();

  // Check initial state — hasLocation from /me privacy
  useEffect(() => {
    let active = true;
    const me = getSession();
    if (me?.privacyPreferences?.discoverableByNearby === false) {
      setError("Nearby discovery is off — enable it in Settings → Privacy to use this.");
      return;
    }
    // If backend has no location, we show needsLocation
    apiGet("/api/v1/users/me")
      .then((data) => {
        if (!active) return;
        const has = Boolean(data?.location?.hasLocation);
        setHasLocation(has);
        if (!has) setNeedsLocation(true);
        else fetchNearby(radius);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const fetchNearby = useCallback(async (r = radius) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet(`/api/v1/users/nearby?radius=${r}&limit=20`);
      setUsers(Array.isArray(data) ? data : []);
      setNeedsLocation(false);
    } catch (e) {
      const code = e?.code || e?.status;
      if (e?.message?.includes("Share your location") || e?.code === "NO_LOCATION" || e?.message?.includes("Share your location first")) {
        setNeedsLocation(true);
        setUsers([]);
      } else if (e?.code === "DISCOVERY_DISABLED") {
        setError("Nearby discovery is disabled — enable it in Settings → Privacy.");
      } else if (e?.code === "STALE_LOCATION") {
        setNeedsLocation(true);
        setError("Your location is stale — refresh to see nearby people.");
      } else {
        setError(e?.message || "Could not load nearby people");
      }
    } finally {
      setLoading(false);
    }
  }, [radius]);

  const handleRefreshLocation = async () => {
    const perm = await checkGeolocationPermission();
    if (perm === "denied") {
      setError("Location permission denied — enable it in your browser settings, then refresh.");
      return;
    }
    // First time: show consent sheet before actually calling geolocation
    if (!hasLocation && !showConsent) {
      // Check if we already have consent stored
      const consent = typeof window !== "undefined" ? localStorage.getItem("kivo:nearbyConsent") : "1";
      if (!consent) {
        setShowConsent(true);
        return;
      }
    }
    doLocate();
  };

  const doLocate = async () => {
    setLocating(true);
    setError(null);
    try {
      const pos = await getCurrentPosition();
      if (pos.accuracy > 200) throw new Error("Location is too inaccurate — move to an open area and try again");
      await apiPost("/api/v1/users/me/location", { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy });
      setHasLocation(true);
      if (typeof window !== "undefined") localStorage.setItem("kivo:nearbyConsent", "1");
      setShowConsent(false);
      await fetchNearby(radius);
    } catch (e) {
      setError(e?.message || "Could not get location");
    } finally {
      setLocating(false);
    }
  };

  const handleConsentAllow = () => {
    if (typeof window !== "undefined") localStorage.setItem("kivo:nearbyConsent", "1");
    setShowConsent(false);
    doLocate();
  };

  const handleAdd = async (u) => {
    setBusyId(u.id);
    try {
      await apiPost("/api/v1/friends/request", { identifier: u.username || u.email });
      // Optimistically mark as outgoing
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, relationship: "outgoing" } : x));
    } catch (e) {
      window.alert(e?.message || "Could not send request");
    } finally {
      setBusyId(null);
    }
  };

  const handleRadiusChange = (v) => {
    setRadius(v);
    if (hasLocation) fetchNearby(v);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header controls */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2.5">
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex size-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Nearby people</p>
            <p className="text-[11px] text-[var(--text-muted)]">Distance only — never exact location</p>
          </div>
          <div className="flex items-center gap-1">
            {RADIUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handleRadiusChange(o.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${radius === o.value ? "bg-[var(--accent)] text-[var(--on-accent)]" : "border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)]"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={hasLocation ? () => fetchNearby(radius) : handleRefreshLocation}
          disabled={loading || locating}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40 shrink-0"
        >
          {loading || locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {hasLocation ? "Refresh" : "Share location"}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)]">
        <Shield className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
        <span>We show only fuzzed distance (~250m). Turn off anytime in Settings → Privacy → Nearby discovery.</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          {needsLocation && (
            <button type="button" onClick={handleRefreshLocation} disabled={locating} className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enable"}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-[var(--hover)]" />
              <div className="mx-auto mt-3 h-3 w-20 rounded-full bg-[var(--hover)]" />
              <div className="mx-auto mt-1.5 h-2.5 w-16 rounded-full bg-[var(--hover)]" />
            </div>
          ))}
        </div>
      ) : users.length === 0 && !needsLocation && !error ? (
        <EmptyState
          icon={SearchX}
          title={hasLocation ? "No one nearby yet" : "No location shared"}
          hint={hasLocation ? "Try increasing radius to 10km or check back later — only discoverable people within radius show up." : "Share your location to discover people around you."}
          action={
            !hasLocation ? (
              <button type="button" onClick={handleRefreshLocation} disabled={locating} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40">
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} Share location
              </button>
            ) : null
          }
        />
      ) : needsLocation && users.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="Share your location"
          hint="We’ll show distance only (~250m), never your exact spot. You’re discoverable by default — turn off in Settings → Privacy anytime."
          action={
            <button type="button" onClick={handleRefreshLocation} disabled={locating} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} {locating ? "Getting location…" : "Share location"}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <ProfilePreviewCard
              key={u.id}
              user={u}
              relationship={u.relationship || "none"}
              distanceLabel={u.distanceLabel}
              distanceMeters={u.distanceMeters}
              busy={busyId === u.id}
              onAdd={handleAdd}
              onMessage={onStartChat ? (usr) => onStartChat(usr.id) : undefined}
              onViewProfile={onViewProfile}
            />
          ))}
        </div>
      )}

      <ConsentSheet open={showConsent} onAllow={handleConsentAllow} onDeny={() => setShowConsent(false)} />
    </div>
  );
}

export default NearbyTab;
