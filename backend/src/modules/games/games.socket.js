import jwt from "jsonwebtoken";
import env from "../../config/env.js";
import { unauthorized } from "../../utils/errors.js";
import GameMatch from "./game.model.js";
import { gameStates, handleRaceFinish } from "./games.service.js";
import Conversation from "../../models/Conversation.js";

function verifyToken(token) {
  if (!token) throw unauthorized("Socket auth token missing", "SOCKET_UNAUTHENTICATED");
  try {
    const payload = jwt.verify(token, env.accessTokenSecret);
    if (!payload.userId) throw unauthorized("Invalid socket auth token", "SOCKET_UNAUTHENTICATED");
    return payload;
  } catch {
    throw unauthorized("Invalid socket auth token", "SOCKET_UNAUTHENTICATED");
  }
}

function roomName(matchId) {
  return `race:${String(matchId)}`;
}

export function initGamesNamespace(io) {
  const nsp = io.of("/games");

  nsp.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const payload = verifyToken(token);
      socket.userId = payload.userId;
      socket.sessionId = payload.sessionId || null;
      next();
    } catch (err) {
      next(err);
    }
  });

  nsp.on("connection", (socket) => {
    const userId = socket.userId;

    socket.on("race:join", async (data) => {
      const matchId = data?.matchId || data?.match_id || data?.id;
      if (!matchId) {
        socket.emit("race:error", { message: "matchId required" });
        return;
      }
      try {
        const match = await GameMatch.findById(matchId);
        if (!match) {
          socket.emit("race:error", { message: "Match not found" });
          return;
        }
        // verify membership via conversation
        const conv = await Conversation.findById(match.conversationId).select("participants");
        if (!conv || !conv.participants.map((p) => p.toString()).includes(userId)) {
          socket.emit("race:error", { message: "Not a participant" });
          return;
        }

        // ensure in-memory state exists
        let state = gameStates.get(String(matchId));
        if (!state) {
          state = {
            matchId: String(matchId),
            conversationId: match.conversationId.toString(),
            textPrompt: match.textPrompt,
            promptLength: match.textPrompt.length,
            status: match.status,
            participantIds: match.players.map((p) => p.userId.toString()),
            joined: new Set(),
            progress: new Map(),
            finished: new Map(),
            rankCounter: match.players.filter((p) => p.rank).length + 1,
            startedAt: match.startedAt || null,
          };
          gameStates.set(String(matchId), state);
        }

        socket.join(roomName(matchId));
        state.joined.add(String(userId));
        socket.data.matchId = String(matchId);

        // notify room about updated joined count
        const joinedList = [...state.joined];
        nsp.to(roomName(matchId)).emit("race:joined", {
          matchId: String(matchId),
          userId: String(userId),
          joined: joinedList,
          joinedCount: joinedList.length,
          expectedCount: state.participantIds.length,
        });

        // when all invited players have joined, emit race:start with countdown and prompt
        if (state.joined.size >= state.participantIds.length && state.status === "pending") {
          state.status = "active";
          state.startedAt = new Date();
          // persist startedAt
          await GameMatch.findByIdAndUpdate(matchId, { status: "active", startedAt: state.startedAt });
          nsp.to(roomName(matchId)).emit("race:start", {
            matchId: String(matchId),
            textPrompt: state.textPrompt,
            prompt: state.textPrompt,
            countdown: 3,
            startedAt: state.startedAt,
          });
        } else {
          // let the joiner know current state and prompt if already active
          if (state.status === "active") {
            socket.emit("race:start", {
              matchId: String(matchId),
              textPrompt: state.textPrompt,
              prompt: state.textPrompt,
              countdown: 0,
              startedAt: state.startedAt,
            });
          } else {
            // still pending, send prompt so client can prepare
            socket.emit("race:waiting", {
              matchId: String(matchId),
              textPrompt: state.textPrompt,
              joined: joinedList,
              expectedCount: state.participantIds.length,
              joinedCount: joinedList.length,
            });
          }
        }
      } catch (err) {
        console.error("[games] race:join failed", err);
        socket.emit("race:error", { message: "Internal error" });
      }
    });

    socket.on("race:progress", (data) => {
      const matchId = data?.matchId;
      const charsTyped = data?.charsTyped;
      if (!matchId || typeof charsTyped !== "number") return;
      const state = gameStates.get(String(matchId));
      if (!state) return;
      if (state.status !== "active") return;
      // sanity checks: monotonically increasing and not exceed prompt length
      const prev = state.progress.get(String(userId)) || 0;
      if (charsTyped < prev) return;
      if (charsTyped > state.promptLength) return;
      state.progress.set(String(userId), charsTyped);
      // relay to room as-is
      socket.to(roomName(matchId)).emit("race:progress", {
        matchId: String(matchId),
        userId: String(userId),
        charsTyped,
        progress: state.promptLength ? charsTyped / state.promptLength : 0,
      });
    });

    socket.on("race:finish", async (data) => {
      const matchId = data?.matchId;
      const wpm = data?.wpm;
      const accuracy = data?.accuracy;
      if (!matchId) return;
      const state = gameStates.get(String(matchId));
      if (!state) return;
      // prevent duplicate finishes
      if (state.finished.has(String(userId))) return;

      try {
        const updated = await handleRaceFinish({
          matchId: String(matchId),
          userId: String(userId),
          wpm: typeof wpm === "number" ? wpm : 0,
          accuracy: typeof accuracy === "number" ? accuracy : 0,
        });
        const meEntry = updated.players.find((p) => p.userId === String(userId));
        nsp.to(roomName(matchId)).emit("race:finished", {
          matchId: String(matchId),
          userId: String(userId),
          wpm: meEntry?.wpm ?? wpm,
          accuracy: meEntry?.accuracy ?? accuracy,
          rank: meEntry?.rank ?? state.finished.size + 1,
          finishedAt: meEntry?.finishedAt,
        });

        if (updated.status === "completed") {
          nsp.to(roomName(matchId)).emit("race:completed", {
            matchId: String(matchId),
            results: updated.players,
            endedAt: updated.endedAt,
          });
        }
      } catch (err) {
        console.error("[games] race:finish failed", err);
        socket.emit("race:error", { message: "Finish failed" });
      }
    });

    socket.on("race:leave", (data) => {
      const matchId = data?.matchId || socket.data.matchId;
      if (!matchId) return;
      socket.leave(roomName(matchId));
      const state = gameStates.get(String(matchId));
      if (state) {
        state.joined.delete(String(userId));
        nsp.to(roomName(matchId)).emit("race:left", {
          matchId: String(matchId),
          userId: String(userId),
          joinedCount: state.joined.size,
        });
      }
    });

    socket.on("disconnect", () => {
      // best-effort remove from any race rooms tracked in socket.rooms
      // (socket.rooms is a Set in socket.io 4, but we tracked matchId in socket.data)
      const matchId = socket.data?.matchId;
      if (matchId) {
        const state = gameStates.get(String(matchId));
        if (state) {
          state.joined.delete(String(userId));
          nsp.to(roomName(matchId)).emit("race:left", {
            matchId: String(matchId),
            userId: String(userId),
            joinedCount: state.joined.size,
          });
        }
      }
    });
  });

  return nsp;
}
