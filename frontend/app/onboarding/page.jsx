"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Loader2, MapPin, Search, SkipForward, Smile, Upload, X, User, Compass } from "lucide-react";
import { Avatar } from "@/components/dashboard/avatar";
import { ProfilePreviewCard } from "@/components/dashboard/profile-preview-card";
import { apiGet, apiPatch, apiPost, apiUpload } from "@/lib/api";
import { getSession, setSession, getToken } from "@/lib/auth";
import { getCurrentPosition } from "@/lib/location";

const EASE = [0.22, 1, 0.36, 1];

const STATUS_EMOJIS = ["😀","😎","🥳","🤩","😴","🤗","🤔","😅","🎮","🎧","🎬","🎨","📚","💼","🏋️","🧘","🏃","🚀","☕","🍜","💻","📱","🎵","🎸","✈️","🌍","🏝️","🌙","☀️","⚡","🔥","💡"];
const VIBE_PRESETS = [
  { label: "Gaming", emoji: "🎮", status: "gaming" },
  { label: "Vibing", emoji: "🎧", status: "vibing" },
  { label: "Away", emoji: "😴", status: "away" },
  { label: "Studying", emoji: "📚", status: "studying" },
  { label: "Working", emoji: "💼", status: "working" },
  { label: "Sleepy", emoji: "🌙", status: "sleepy" },
];

function ProgressDots({ step, total }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i + 1 === step ? "w-6 bg-[var(--accent)]" : i + 1 < step ? "w-1.5 bg-[var(--accent)]/60" : "w-1.5 bg-[var(--border)]"}`} />
      ))}
      <span className="ml-2 text-[11px] font-medium text-[var(--text-muted)]">{step}/{total}</span>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(1);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  // Step 1 state
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [statusEmoji, setStatusEmoji] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingStep1, setSavingStep1] = useState(false);
  const fileRef = useRef(null);

  // Step 2 state
  const [nearbyStatus, setNearbyStatus] = useState("idle"); // idle | locating | success | error | skipped
  const [nearbyError, setNearbyError] = useState(null);

  // Step 3 state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace("/login"); return; }
    let active = true;
    apiGet("/api/v1/users/me").then((data) => {
      if (!active) return;
      setMe(data);
      if (data.onboardingCompleted) {
        router.replace("/app");
        return;
      }
      setDisplayName(data.displayName || "");
      setStatus(data.status || "");
      setStatusEmoji(data.statusEmoji || "");
      setLoading(false);
      // posthog track
      try { window.posthog?.capture("onboarding_started"); } catch {}
    }).catch(() => {
      if (!active) return;
      setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  // Step 3 search debounce
  useEffect(() => {
    if (step !== 3) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    timerRef.current = setTimeout(() => {
      apiGet(`/api/v1/users/search?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, step]);

  useEffect(() => {
    if (selected) {
      const name = selected.displayName || selected.username || "there";
      setWelcomeMessage(`Hi ${name}! from nearby 👋 Would love to connect on Kivo!`);
    }
  }, [selected]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 4 * 1024 * 1024) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const updated = await apiUpload("/api/v1/users/me/avatar", form);
      setSession(updated, getToken());
      setMe(updated);
    } catch {}
    finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleStep1Next = async () => {
    setSavingStep1(true);
    try {
      const updated = await apiPatch("/api/v1/users/me", {
        displayName: displayName.trim(),
        status: status.trim(),
        statusEmoji: statusEmoji.trim(),
      });
      setSession(updated, getToken());
      setMe(updated);
      try { window.posthog?.capture("onboarding_step1_completed"); } catch {}
      setStep(2);
    } catch {}
    finally { setSavingStep1(false); }
  };

  const handleNearbyShare = async () => {
    setNearbyStatus("locating");
    setNearbyError(null);
    try {
      const pos = await getCurrentPosition();
      if (pos.accuracy > 200) throw new Error("Location too inaccurate — try outdoors");
      await apiPost("/api/v1/users/me/location", { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy });
      setNearbyStatus("success");
      try { window.posthog?.capture("onboarding_step2_location_shared"); } catch {}
      setTimeout(() => setStep(3), 600);
    } catch (e) {
      setNearbyStatus("error");
      setNearbyError(e?.message || "Could not get location");
    }
  };

  const handleNearbySkip = () => {
    setNearbyStatus("skipped");
    try { window.posthog?.capture("onboarding_step2_skipped"); } catch {}
    setStep(3);
  };

  const handleSendRequest = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const identifier = selected.username || selected.email;
      await apiPost("/api/v1/friends/request", { identifier, welcomeMessage: welcomeMessage.trim() || undefined });
      setSent(true);
      try { window.posthog?.capture("onboarding_step3_request_sent", { withMessage: Boolean(welcomeMessage.trim()) }); } catch {}
      setTimeout(() => completeOnboarding(), 800);
    } catch (e) {
      window.alert(e?.message || "Could not send request");
    } finally { setSending(false); }
  };

  const completeOnboarding = async (skipStep3 = false) => {
    try {
      await apiPost("/api/v1/users/me/onboarding", {});
      try { window.posthog?.capture("onboarding_completed", { skippedStep3: skipStep3 }); } catch {}
      const updated = await apiGet("/api/v1/users/me");
      setSession(updated, getToken());
    } catch {}
    router.push("/app");
  };

  const handleSkipAll = async () => {
    try { window.posthog?.capture("onboarding_skipped"); } catch {}
    completeOnboarding(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-base)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white font-goga text-sm font-bold">K</span>
          <span className="font-display text-sm font-semibold text-[var(--text-primary)]">Welcome to Kivo</span>
        </div>
        <div className="flex items-center gap-3">
          <ProgressDots step={step} total={3} />
          <button type="button" onClick={handleSkipAll} className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--hover)] md:flex">
            <SkipForward className="h-3 w-3" /> Skip
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-lg"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]"><User className="h-4 w-4" /></span>
                  <h1 className="text-lg font-semibold text-[var(--text-primary)]">Make it yours</h1>
                </div>
                <p className="mb-6 text-sm text-[var(--text-muted)]">Add a photo and vibe — helps nearby people recognize you.</p>

                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Avatar name={displayName || me?.displayName || "?"} avatarStyle={me?.avatarStyle} url={me?.avatarUrl} size="lg" isPlus={false} />
                    {avatarUploading && <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40"><Loader2 className="h-5 w-5 animate-spin text-white" /></span>}
                    <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow hover:opacity-90">
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarChange} className="hidden" />
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">Tap to upload photo · up to 4MB</span>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Display name</label>
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} placeholder="Your name" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus:border-[var(--accent)] focus:outline-none focus:ring-3 focus:ring-[var(--accent)]/15" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Status vibe</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowEmojis((v) => !v)} className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-xl border text-lg ${statusEmoji ? "border-[var(--accent)] bg-[var(--hover)]" : "border-[var(--border)] bg-[var(--bg-surface)]"}`}>
                        {statusEmoji || "😊"}
                      </button>
                      <input value={status} onChange={(e) => setStatus(e.target.value)} maxLength={60} placeholder="e.g. vibing, gaming, away" className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus:border-[var(--accent)] focus:outline-none" />
                    </div>
                    {showEmojis && (
                      <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                        <div className="grid grid-cols-8 gap-1">
                          {STATUS_EMOJIS.map((e) => (
                            <button key={e} type="button" onClick={() => { setStatusEmoji(e); setShowEmojis(false); }} className={`flex aspect-square items-center justify-center rounded-lg text-lg hover:bg-[var(--hover)] ${statusEmoji === e ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]" : ""}`}>{e}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {VIBE_PRESETS.map((v) => (
                        <button key={v.label} type="button" onClick={() => { setStatusEmoji(v.emoji); setStatus(v.status); }} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status===v.status && statusEmoji===v.emoji ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>
                          <span>{v.emoji}</span> {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  <button type="button" onClick={handleSkipAll} className="flex-1 rounded-full border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover)] sm:hidden">Skip</button>
                  <button type="button" onClick={handleStep1Next} disabled={savingStep1} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-50">
                    {savingStep1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-lg"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><MapPin className="h-4 w-4" /></span>
                  <h1 className="text-lg font-semibold text-[var(--text-primary)]">Discover nearby</h1>
                </div>
                <p className="mb-6 text-sm text-[var(--text-muted)]">Share fuzzed distance only — never exact location. Helps you find people around you.</p>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500 text-white"><Compass className="h-5 w-5" /></span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">Nearby discovery is ON by default</p>
                      <p className="text-xs text-[var(--text-muted)]">You appear as ~250m / 1.2km away. Turn off anytime in Settings → Privacy.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={handleNearbyShare} disabled={nearbyStatus==="locating"} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-50">
                      {nearbyStatus==="locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                      {nearbyStatus==="success" ? "Shared ✓" : nearbyStatus==="locating" ? "Getting location…" : "Share location"}
                    </button>
                    <button type="button" onClick={handleNearbySkip} className="rounded-full border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover)]">
                      Skip for now
                    </button>
                  </div>
                  {nearbyError && <p className="mt-2 text-xs text-red-500">{nearbyError}</p>}
                  {nearbyStatus==="success" && <p className="mt-2 text-xs text-emerald-600">Location shared — you’re discoverable nearby!</p>}
                  <p className="mt-3 text-center text-xs text-[var(--text-muted)]">We use one-shot location, not continuous tracking. Stored as GeoJSON Point + 2dsphere, fuzzed distance only.</p>
                </div>

                <div className="mt-6 flex justify-between gap-2">
                  <button type="button" onClick={() => setStep(1)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover)]">Back</button>
                  <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] hover:opacity-90">
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-lg"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]"><Search className="h-4 w-4" /></span>
                  <h1 className="text-lg font-semibold text-[var(--text-primary)]">Find your first friend</h1>
                </div>
                <p className="mb-4 text-sm text-[var(--text-muted)]">Search by username or email — we show square preview cards. Send a welcome message to break the ice.</p>

                <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 focus-within:border-[var(--accent)]">
                  <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or email…" className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none" />
                </label>

                <div className="mt-4 min-h-[160px]">
                  {searching ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>
                  ) : !query.trim() ? (
                    <div className="py-8 text-center">
                      <Smile className="mx-auto h-8 w-8 text-[var(--text-muted)]/40" />
                      <p className="mt-2 text-sm text-[var(--text-muted)]">Start typing to find people</p>
                      <p className="text-xs text-[var(--text-muted)]/70">Try a username like <span className="font-mono">ayush</span></p>
                    </div>
                  ) : results.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[var(--text-muted)]">No users found for “{query}”</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-[320px] overflow-y-auto pr-1">
                      {results.map((u) => (
                        <div key={u.id} onClick={() => setSelected(u)} className={`cursor-pointer rounded-xl border p-0 overflow-hidden transition ${selected?.id===u.id ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20" : "border-[var(--border)] hover:border-[var(--accent)]/30"}`}>
                          <ProfilePreviewCard user={u} relationship={u.relationship} busy={false} onAdd={() => setSelected(u)} onMessage={() => {}} onViewProfile={() => window.open(`/u/${u.username}`, "_blank")} />
                          {selected?.id===u.id && <div className="flex items-center justify-center gap-1.5 bg-[var(--accent)] py-1.5 text-xs font-semibold text-white"><Check className="h-3.5 w-3.5" /> Selected</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selected && (
                  <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">Welcome message to {selected.displayName || selected.username} <span className="font-normal">(will be shown before they accept)</span></p>
                    <textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value.slice(0,280))} rows={3} placeholder={`Hi ${selected.displayName || selected.username}! from nearby...`} className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15" />
                    <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
                      <span>Private — only they see it</span>
                      <span className={welcomeMessage.length>260 ? "text-amber-600" : ""}>{welcomeMessage.length}/280</span>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button type="button" onClick={() => setStep(2)} className="rounded-full border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover)]">Back</button>
                  <button type="button" onClick={() => completeOnboarding(true)} className="flex-1 rounded-full border border-[var(--border)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover)]">Skip</button>
                  <button type="button" disabled={!selected || sending || sent} onClick={handleSendRequest} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-50">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <Check className="h-4 w-4" /> : <span>Send request</span>}
                    {sent ? "Sent!" : welcomeMessage.trim() ? "Send with message" : "Send request"}
                  </button>
                </div>
                <button type="button" onClick={() => completeOnboarding(true)} className="mt-3 w-full text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Skip and go to app →</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
