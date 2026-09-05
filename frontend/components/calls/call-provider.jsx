"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSocket } from "@/components/socket-provider";
import { getSession } from "@/lib/auth";
import {
  fetchCallsConfig,
  fetchCallToken,
  startRinger,
  stopRinger,
} from "@/lib/calls";

// Global call state. Mounted once in the /app layout via dashboard-shell.
// Owns the LiveKit Room, ring signaling, and incoming-call routing — chat
// panels and overlays consume this context and stay dumb.
//
// session: an active local call (joined room). outgoing: ringing-out before
// accept (caller already hears nothing until someone joins — ringback plays
// locally). incoming: someone is ringing us.
const CallsContext = createContext(null);

export function useCalls() {
  return useContext(CallsContext);
}

export function CallProvider({ conversations = [], children }) {
  const { socket } = useSocket();
  const [enabled, setEnabled] = useState(false);
  const [outgoing, setOutgoing] = useState(null);
  const [incoming, setIncoming] = useState(null);
  const [session, setSession] = useState(null);
  const [endedNote, setEndedNote] = useState(null);

  const convsRef = useRef(conversations);
  convsRef.current = conversations;
  const stateRef = useRef({ outgoing: null, incoming: null, session: null });
  stateRef.current = { outgoing, incoming, session };
  const roomRef = useRef(null);
  const noteTimerRef = useRef(null);

  const resolveConv = useCallback((conversationId) => {
    return (
      (convsRef.current || []).find((c) => c.id === conversationId) || null
    );
  }, []);

  const isDm = useCallback(
    (conversationId) => resolveConv(conversationId)?.type !== "group",
    [resolveConv],
  );

  // Load the calls capability flag once per login.
  useEffect(() => {
    let active = true;
    fetchCallsConfig().then((cfg) => {
      if (active) setEnabled(Boolean(cfg.enabled));
    });
    return () => {
      active = false;
    };
  }, []);

  const flashNote = useCallback((text) => {
    setEndedNote(text);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => setEndedNote(null), 3000);
  }, []);

  // Outgoing setup errors (mic denied, unconfigured, blocked) show as a
  // toast via CallEndedToast, then auto-dismiss.
  useEffect(() => {
    if (!outgoing?.error) return undefined;
    const t = setTimeout(() => setOutgoing(null), 3500);
    return () => clearTimeout(t);
  }, [outgoing?.error]);

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
  }, []);

  const disconnectRoom = useCallback(() => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      try {
        room.disconnect();
      } catch {}
    }
  }, []);

  const teardownSession = useCallback(() => {
    disconnectRoom();
    stopRinger();
    setSession(null);
    setOutgoing(null);
  }, [disconnectRoom]);

  // Hangup announce shared by every leave path (button, remote-gone,
  // tab-close). Carries kind + seconds-in-call so the server can log a rich
  // history chip ("Call ended · 4:32" vs "cancelled before answer").
  const emitEnd = useCallback(
    (sess) => {
      if (!sess || !socket) return;
      const durationSec = sess.startedAt
        ? Math.max(0, Math.round((Date.now() - sess.startedAt) / 1000))
        : 0;
      try {
        socket.emit("call:end", {
          callId: sess.callId,
          conversationId: sess.conversationId,
          kind: sess.kind === "video" ? "video" : "voice",
          durationSec,
        });
      } catch {}
    },
    [socket],
  );

  // Join a LiveKit room: token → connect → publish mic (+ camera for video).
  // livekit-client is dynamically imported so it never evaluates during SSR.
  const joinRoom = useCallback(async ({ token, url, kind, onRemoteLeft }) => {
    const { Room, RoomEvent, VideoPresets } = await import("livekit-client");
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720,
      },
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      try {
        if (room.numParticipants <= 1) onRemoteLeft?.();
      } catch {}
    });
    await room.connect(url, token);
    // iOS Safari suspends audio until a user gesture unlocks it. Joining
    // always starts from a tap (call button / Accept / Join), so unlock
    // here while we still have gesture budget. Best-effort.
    try {
      await room.startAudio();
    } catch {}
    await room.localParticipant.setMicrophoneEnabled(true);
    if (kind === "video") {
      try {
        await room.localParticipant.setCameraEnabled(true);
      } catch {
        // Camera unavailable — stay in a voice-capable call.
      }
    }
    roomRef.current = room;
    return room;
  }, []);

  // --- Outgoing ---------------------------------------------------------
  const startCall = useCallback(
    async (conversation, kind = "voice") => {
      const st = stateRef.current;
      if (st.session || st.outgoing || st.incoming) return { busy: true };
      if (!conversation || conversation.type === "space_channel")
        return { error: "NOT_ALLOWED" };
      const conversationId = conversation.id;
      setIncoming(null);
      setOutgoing({ conversationId, kind, ringing: true, error: null });
      startRinger("outgoing");
      try {
        const data = await fetchCallToken(conversationId, kind);
        const room = await joinRoom({
          token: data.token,
          url: data.url,
          kind,
          onRemoteLeft: () => {
            // 1:1 peer gone (app kill / network drop without call:end).
            if (isDm(conversationId)) {
              emitEnd(stateRef.current.session);
              teardownSession();
            }
          },
        });
        setOutgoing(null);
        setSession({
          callId: data.callId,
          conversationId,
          roomName: data.roomName,
          kind,
          room,
          isCaller: true,
          startedAt: Date.now(),
        });
        socket?.emit("call:ring", {
          callId: data.callId,
          conversationId,
          kind,
        });
        return { ok: true };
      } catch (err) {
        disconnectRoom();
        stopRinger();
        const code = err?.code || err?.message || "CALL_FAILED";
        setOutgoing({ conversationId, kind, ringing: false, error: code });
        return { error: code };
      }
    },
    [socket, joinRoom, teardownSession, disconnectRoom, isDm, emitEnd],
  );

  // --- Incoming ---------------------------------------------------------
  const acceptCall = useCallback(async () => {
    const inv = stateRef.current.incoming;
    if (!inv || stateRef.current.session) return;
    const { callId, conversationId, kind } = inv;
    setIncoming(null);
    stopRinger();
    try {
      const data = await fetchCallToken(conversationId, kind);
      const room = await joinRoom({
        token: data.token,
        url: data.url,
        kind,
        onRemoteLeft: () => {
          if (isDm(conversationId)) {
            emitEnd(stateRef.current.session);
            teardownSession();
          }
        },
      });
      setSession({
        callId,
        conversationId,
        roomName: data.roomName,
        kind,
        room,
        isCaller: false,
        startedAt: Date.now(),
      });
      socket?.emit("call:accept", { callId, conversationId });
      // Race guard: the caller may have hung up between ring and our join.
      // Don't sit alone in an empty DM room — bow out with a note.
      if (isDm(conversationId)) {
        setTimeout(() => {
          try {
            if (
              stateRef.current.session?.callId === callId &&
              (room.numParticipants || 0) <= 1
            ) {
              teardownSession();
              flashNote("Call ended");
            }
          } catch {}
        }, 4000);
      }
    } catch (err) {
      flashNote(err?.message || "Could not join the call");
    }
  }, [socket, joinRoom, teardownSession, flashNote, isDm, emitEnd]);

  const declineCall = useCallback(
    (reason = "declined") => {
      const inv = stateRef.current.incoming;
      if (!inv) return;
      try {
        socket?.emit("call:decline", {
          callId: inv.callId,
          conversationId: inv.conversationId,
          kind: inv.kind === "video" ? "video" : "voice",
          reason,
        });
      } catch {}
      setIncoming(null);
      stopRinger();
    },
    [socket],
  );

  // --- Shared -----------------------------------------------------------
  const endCall = useCallback(() => {
    emitEnd(stateRef.current.session);
    teardownSession();
  }, [emitEnd, teardownSession]);

  // Join an ongoing call without ringing (group late-join / Join pill).
  const joinOngoing = useCallback(
    async (conversation) => {
      const st = stateRef.current;
      if (st.session || st.outgoing || st.incoming || !conversation) return;
      const conversationId = conversation.id;
      try {
        const data = await fetchCallToken(conversationId, "voice");
        const room = await joinRoom({
          token: data.token,
          url: data.url,
          kind: "voice",
          onRemoteLeft: () => {
            if (isDm(conversationId)) teardownSession();
          },
        });
        setSession({
          callId: data.callId,
          conversationId,
          roomName: data.roomName,
          kind: "voice",
          room,
          isCaller: false,
          startedAt: Date.now(),
        });
        // Same stale-room guard as accept: a lingering Cloud room can outlive
        // the call by seconds — don't sit alone in a dead DM room.
        if (isDm(conversationId)) {
          setTimeout(() => {
            try {
              if (
                stateRef.current.session?.callId === data.callId &&
                (room.numParticipants || 0) <= 1
              ) {
                teardownSession();
                flashNote("Call ended");
              }
            } catch {}
          }, 4000);
        }
      } catch (err) {
        flashNote(err?.message || "Could not join the call");
      }
    },
    [joinRoom, teardownSession, flashNote, isDm],
  );

  // --- Socket signaling ---------------------------------------------------
  useEffect(() => {
    if (!socket) return undefined;
    const onRing = (payload) => {
      const st = stateRef.current;
      // Already in a call (any device state) → auto-decline as busy.
      if (st.session || st.outgoing || st.incoming) {
        try {
          socket.emit("call:decline", {
            callId: payload?.callId,
            conversationId: payload?.conversationId,
            reason: "busy",
          });
        } catch {}
        return;
      }
      if (!payload?.callId || !payload?.conversationId) return;
      setIncoming({
        callId: String(payload.callId),
        conversationId: payload.conversationId,
        kind: payload.kind === "video" ? "video" : "voice",
        caller: payload.caller || null,
      });
      startRinger("incoming");
      try {
        navigator.vibrate?.(200);
      } catch {}
    };
    const onAccepted = (payload) => {
      const st = stateRef.current;
      if (st.session && st.session.callId === payload?.callId) {
        stopRinger();
      }
      // Someone else answered a group ring we were showing: dismiss our
      // overlay (the Join pill covers late entry from here).
      if (st.incoming && st.incoming.callId === payload?.callId) {
        setIncoming(null);
        stopRinger();
      }
    };
    const onDeclined = (payload) => {
      const st = stateRef.current;
      if (
        st.session &&
        st.session.callId === payload?.callId &&
        st.session.isCaller
      ) {
        // A DM decline ends the call. Group stragglers declining must NOT kill
        // a live call — the ring continues for the rest (the server agrees: it
        // only clears the registry for 1:1).
        if (isDm(payload?.conversationId)) {
          teardownSession();
          flashNote(
            payload?.reason === "busy" ? "User is busy" : "Call declined",
          );
        }
      }
    };
    const onMissed = (payload) => {
      const st = stateRef.current;
      if (st.incoming && st.incoming.callId === payload?.callId) {
        setIncoming(null);
        stopRinger();
      }
      if (
        st.session &&
        st.session.callId === payload?.callId &&
        st.session.isCaller
      ) {
        teardownSession();
        flashNote("No answer");
      }
    };
    const onEnded = (payload) => {
      const st = stateRef.current;
      if (st.session && st.session.callId === payload?.callId) {
        // 1:1 → the call is over. Group → stay (others may continue).
        if (isDm(st.session.conversationId)) teardownSession();
      }
      if (st.incoming && st.incoming.callId === payload?.callId) {
        setIncoming(null);
        stopRinger();
      }
    };
    const onFailed = (payload) => {
      const st = stateRef.current;
      if (
        st.outgoing &&
        payload?.conversationId === st.outgoing.conversationId
      ) {
        teardownSession();
        flashNote(
          payload?.code === "CALL_BLOCKED"
            ? "You can't call this user"
            : "Call failed",
        );
      }
    };
    socket.on("call:ring", onRing);
    socket.on("call:accepted", onAccepted);
    socket.on("call:declined", onDeclined);
    socket.on("call:missed", onMissed);
    socket.on("call:ended", onEnded);
    socket.on("call:failed", onFailed);
    return () => {
      socket.off("call:ring", onRing);
      socket.off("call:accepted", onAccepted);
      socket.off("call:declined", onDeclined);
      socket.off("call:missed", onMissed);
      socket.off("call:ended", onEnded);
      socket.off("call:failed", onFailed);
    };
  }, [socket, teardownSession, flashNote, isDm]);

  // Best-effort hangup on tab close / navigation.
  useEffect(() => {
    const onUnload = () => {
      emitEnd(stateRef.current.session);
      disconnectRoom();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [emitEnd, disconnectRoom]);

  // Tear down the room if the provider unmounts (logout).
  useEffect(() => {
    return () => {
      disconnectRoom();
      stopRinger();
    };
  }, [disconnectRoom]);

  const meId = getSession()?.id || null;

  const value = useMemo(
    () => ({
      enabled,
      outgoing,
      incoming,
      session,
      endedNote,
      meId,
      resolveConv,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      joinOngoing,
    }),
    [
      enabled,
      outgoing,
      incoming,
      session,
      endedNote,
      meId,
      resolveConv,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      joinOngoing,
    ],
  );

  return (
    <CallsContext.Provider value={value}>{children}</CallsContext.Provider>
  );
}

export default CallProvider;
