"use client";

import {
  Mic,
  MicOff,
  PhoneOff,
  Settings2,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { cn } from "@/lib/utils";
import { useCalls } from "./call-provider";

// LiveKit event names as literals (stable protocol strings) so this module
// never statically imports livekit-client — the provider loads it lazily.
const ROOM_EVENTS = [
  "participantConnected",
  "participantDisconnected",
  "trackSubscribed",
  "trackUnsubscribed",
  "activeSpeakersChanged",
  "trackMuted",
  "trackUnmuted",
  "localTrackPublished",
  "localTrackUnpublished",
  "reconnecting",
  "reconnected",
  "connectionStateChanged",
  "disconnected",
];

function useRoomSnapshot(room) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!room) return undefined;
    const onChange = () => force();
    for (const ev of ROOM_EVENTS) room.on(ev, onChange);
    return () => {
      for (const ev of ROOM_EVENTS) room.off(ev, onChange);
    };
  }, [room]);
}

function AttachedMedia({ track, kind, className, muted = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return undefined;
    track.attach(el);
    return () => {
      try {
        track.detach(el);
      } catch {}
    };
  }, [track]);
  if (kind === "video") {
    return (
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={className}
      />
    );
  }
  // biome-ignore lint/a11y/useMediaCaption: live remote call audio has no caption track.
  return <audio ref={ref} autoPlay />;
}

function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const hh = Math.floor(s / 3600);
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

function ParticipantTile({ participant, displayName, avatarUrl, isLocal }) {
  const camPub = participant?.getTrackPublication?.("camera");
  const camTrack = camPub?.isSubscribed ? camPub.track : camPub?.track;
  const hasVideo = Boolean(camTrack && !camPub?.isMuted);
  const micMuted = !participant?.isMicrophoneEnabled;
  const speaking = Boolean(participant?.isSpeaking);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border bg-[var(--bg-base)]",
        speaking
          ? "border-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-[var(--border)]",
      )}
    >
      {hasVideo ? (
        <AttachedMedia
          track={camTrack}
          kind="video"
          muted={isLocal}
          // Mirror the selfie so it behaves like a viewfinder; remote video
          // stays as-is.
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            isLocal && "-scale-x-100",
          )}
        />
      ) : (
        <span className="grid place-items-center py-4" aria-hidden="true">
          <Avatar name={displayName} url={avatarUrl} />
        </span>
      )}
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
          hasVideo
            ? "absolute bottom-2 left-2 bg-black/55 text-white backdrop-blur-sm"
            : "text-[var(--text-muted)]",
        )}
      >
        <span className="max-w-24 truncate">
          {displayName}
          {isLocal ? " (you)" : ""}
        </span>
        {micMuted && <MicOff className="h-3 w-3" aria-label="Muted" />}
      </span>
    </div>
  );
}

// In-call device picker (mic + camera). Speaker selection is OS-level and
// stays out of v1 scope. livekit-client loads lazily on first open.
function DevicePicker({ room, onError }) {
  const [open, setOpen] = useState(false);
  const [mics, setMics] = useState([]);
  const [cams, setCams] = useState([]);
  const [activeMic, setActiveMic] = useState("");
  const [activeCam, setActiveCam] = useState("");
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open || !room) return undefined;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { Room } = await import("livekit-client");
        const [audio, video] = await Promise.all([
          Room.getLocalDevices("audioinput", true).catch(() => []),
          Room.getLocalDevices("videoinput", true).catch(() => []),
        ]);
        if (cancelled) return;
        setMics(audio);
        setCams(video);
        const micTrack =
          room.localParticipant?.getTrackPublication("microphone")?.track;
        const camTrack =
          room.localParticipant?.getTrackPublication("camera")?.track;
        setActiveMic(
          micTrack?.mediaStreamTrack?.getSettings?.().deviceId || "",
        );
        setActiveCam(
          camTrack?.mediaStreamTrack?.getSettings?.().deviceId || "",
        );
      } catch {
        if (!cancelled) onError?.("Could not list devices");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, room, onError]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const switchDevice = async (kind, deviceId) => {
    if (!room || !deviceId) return;
    try {
      const ok = await room.switchActiveDevice(kind, deviceId);
      if (!ok) throw new Error("switch failed");
      if (kind === "audioinput") setActiveMic(deviceId);
      else setActiveCam(deviceId);
      setOpen(false);
    } catch {
      onError?.("Could not switch device");
    }
  };

  const selectCls =
    "w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none";

  return (
    <span ref={wrapRef} className="relative flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Call devices"
        aria-expanded={open}
        className="flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] transition-all duration-150 hover:scale-105 active:scale-95"
      >
        <Settings2 className="h-5 w-5" />
      </button>
      <span className="text-[10px] text-[var(--text-muted)]">Devices</span>
      {open && (
        <span className="absolute bottom-full z-10 mb-2 flex w-56 flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-xl">
          <span className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-primary)]">
              Devices
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close devices"
              className="flex size-6 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
          {loading ? (
            <span className="py-2 text-center text-[12px] text-[var(--text-muted)]">
              Loading devices…
            </span>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  Microphone
                </span>
                <select
                  aria-label="Microphone"
                  value={activeMic}
                  onChange={(e) => switchDevice("audioinput", e.target.value)}
                  className={selectCls}
                >
                  {activeMic === "" && <option value="">System default</option>}
                  {mics.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  Camera
                </span>
                <select
                  aria-label="Camera"
                  value={activeCam}
                  onChange={(e) => switchDevice("videoinput", e.target.value)}
                  className={selectCls}
                >
                  {activeCam === "" && <option value="">System default</option>}
                  {cams.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </span>
      )}
    </span>
  );
}

// Active call: voice-first tile list, auto-switching to a video grid when any
// camera is live. Floating docked card on desktop (chat stays usable),
// full-screen sheet on mobile.
export function ActiveCallView() {
  const { session, endCall, resolveConv, meId } = useCalls() || {};
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(null);
  const [alert, setAlert] = useState(null);

  const room = session?.room || null;
  useRoomSnapshot(room);

  useEffect(() => {
    if (!session) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session]);

  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(() => setAlert(null), 3500);
    return () => clearTimeout(t);
  }, [alert]);

  if (!session || !room) return null;

  const conversation = resolveConv?.(session.conversationId);
  const isGroup = conversation?.type === "group";
  const membersById = {};
  for (const p of conversation?.participants || []) {
    const id = p?.id || p?._id || p;
    if (id) membersById[id.toString()] = p;
  }
  const otherMember = Object.values(membersById).find(
    (p) => (p?.id || p?._id)?.toString() !== meId,
  );
  const title = isGroup
    ? conversation?.name || "Group call"
    : otherMember?.displayName ||
      otherMember?.username ||
      (session.kind === "video" ? "Video call" : "Voice call");
  const profileOf = (identity) => membersById[identity] || null;
  const nameOf = (participant, fallback) => {
    const prof = profileOf(participant?.identity);
    return (
      prof?.displayName ||
      prof?.username ||
      participant?.name ||
      fallback ||
      "Someone"
    );
  };

  const local = room.localParticipant;
  const remotes = [...(room.remoteParticipants?.values?.() || [])];
  const all = local ? [local, ...remotes] : remotes;
  const ringing = Boolean(session.isCaller && remotes.length === 0);
  const reconnecting = room.state === "reconnecting";

  const anyVideo = all.some((p) => {
    const pub = p?.getTrackPublication?.("camera");
    return Boolean(pub && !pub.isMuted && (pub.isSubscribed || p === local));
  });

  const micOn = Boolean(local?.isMicrophoneEnabled);
  const camOn = Boolean(local?.isCameraEnabled);

  const toggleMic = async () => {
    if (!local || busy) return;
    setBusy("mic");
    try {
      await local.setMicrophoneEnabled(!micOn);
    } finally {
      setBusy(null);
    }
  };
  const toggleCam = async () => {
    if (!local || busy) return;
    setBusy("cam");
    setAlert(null);
    try {
      await local.setCameraEnabled(!camOn);
    } catch (err) {
      // Camera denied / missing — stay voice-only and say so.
      const msg = String(err?.name || err?.message || "");
      setAlert(
        /NotAllowed/i.test(msg)
          ? "Camera blocked — allow access and try again"
          : "No camera found — staying on voice",
      );
    } finally {
      setBusy(null);
    }
  };

  const controlCls = (active) =>
    cn(
      "flex size-12 items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50",
      active
        ? "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
        : "border-transparent bg-white/10 text-white",
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${session.kind === "video" ? "Video" : "Voice"} call — ${title}`}
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-end sm:justify-end sm:bg-transparent sm:p-6 sm:pointer-events-none"
    >
      <div className="pointer-events-auto flex max-h-[92dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-4">
          <span className="flex items-center gap-1.5 rounded-full bg-[#22c55e]/15 px-2.5 py-1 text-[11px] font-semibold text-[#22c55e]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#22c55e]" />
            {formatElapsed(now - (session.startedAt || now))}
          </span>
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">
            {title}
            {isGroup && all.length > 0 && (
              <span className="ml-1.5 font-normal text-[var(--text-muted)]">
                · {all.length} in call
              </span>
            )}
          </p>
          {ringing && (
            <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
              Ringing…
            </span>
          )}
        </div>

        {/* Reconnect banner — LiveKit auto-recovers; say so instead of silence */}
        {reconnecting && (
          <div className="mx-4 mt-1 flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1.5">
            <span className="size-2 animate-pulse rounded-full bg-[var(--accent)]" />
            <span className="text-[12px] font-medium text-[var(--accent)]">
              Reconnecting…
            </span>
          </div>
        )}

        {/* Tiles — 1:1 video gets tall full-width tiles; groups get a grid;
            voice stays a compact list. */}
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-2 overflow-y-auto p-4",
            anyVideo && all.length <= 2
              ? "grid-cols-1 auto-rows-[minmax(180px,1fr)]"
              : anyVideo || all.length > 2
                ? "grid-cols-2 auto-rows-[minmax(120px,1fr)]"
                : "grid-cols-1 auto-rows-[minmax(96px,auto)]",
          )}
        >
          {all.map((p, i) => {
            const isLocal = p === local;
            const prof = profileOf(p?.identity);
            return (
              <ParticipantTile
                key={p?.identity || `local-${i}`}
                participant={p}
                displayName={nameOf(p, isLocal ? "You" : undefined)}
                avatarUrl={prof?.avatarUrl}
                isLocal={isLocal}
              />
            );
          })}
        </div>

        {/* Remote audio elements (voice path) */}
        <div aria-hidden="true" className="hidden">
          {remotes.map((p) => {
            const pub = p?.getTrackPublication?.("microphone");
            const track = pub?.isSubscribed ? pub.track : null;
            return track ? (
              <AttachedMedia key={p.identity} track={track} kind="audio" />
            ) : null;
          })}
        </div>

        {/* Transient in-call alert (camera denied / device errors) */}
        {alert && (
          <p
            role="alert"
            className="mx-4 shrink-0 rounded-lg border border-[var(--destructive)]/25 bg-[var(--destructive)]/10 px-3 py-2 text-center text-[12px] text-[var(--destructive)]"
          >
            {alert}
          </p>
        )}

        {/* Controls */}
        <div className="flex shrink-0 items-center justify-center gap-4 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2">
          <span className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy === "mic"}
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              aria-pressed={micOn}
              className={controlCls(micOn)}
            >
              {micOn ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">
              {micOn ? "Mute" : "Unmute"}
            </span>
          </span>
          <span className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={toggleCam}
              disabled={busy === "cam"}
              aria-label={camOn ? "Turn camera off" : "Turn camera on"}
              aria-pressed={camOn}
              className={controlCls(camOn)}
            >
              {camOn ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">Video</span>
          </span>
          <DevicePicker room={room} onError={setAlert} />
          <span className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => endCall?.()}
              aria-label="Leave call"
              className="flex size-12 items-center justify-center rounded-full bg-[var(--destructive)] text-white shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
            >
              <PhoneOff className="h-5 w-5" />
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">Leave</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Transient "Busy" / "No answer" pill after a call ends without a session,
// plus outgoing setup errors (mic denied, calls unconfigured, blocked).
function friendlyCallError(code) {
  if (!code) return null;
  if (code === "CALLS_NOT_CONFIGURED") return "Calls aren't set up yet";
  if (code === "CALL_BLOCKED") return "You can't call this user";
  if (code === "NOT_ALLOWED") return "Calls aren't available here";
  if (/NotAllowed/i.test(code))
    return "Microphone blocked — allow access and try again";
  if (/NotFound/i.test(code)) return "No microphone found on this device";
  return null;
}

export function CallEndedToast() {
  const { endedNote, session, outgoing } = useCalls() || {};
  const outgoingError = outgoing?.error
    ? friendlyCallError(outgoing.error)
    : null;
  const text = outgoingError || endedNote;
  if (!text || session) return null;
  return (
    <div
      role={outgoingError ? "alert" : "status"}
      className="pointer-events-none fixed bottom-24 left-1/2 z-[86] -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-[12px] font-medium text-[var(--text-primary)] shadow-lg"
    >
      {text}
    </div>
  );
}

export default ActiveCallView;
