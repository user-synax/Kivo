import { getIO } from "./index.js";

// Helpers shared by the REST controllers and the socket layer so events emitted
// from either path use identical room names and payload shapes.

// Room name for a conversation. Every participant's socket joins this room, so
// a single `io.to(roomName(id)).emit(...)` fans out to all devices in the thread.
export function roomName(conversationId) {
  return `conversation:${conversationId}`;
}

// Broadcast an event to everyone in a conversation's room. Used by the REST
// layer after a DB write (message created/edited/deleted, reactions, read).
export function emitToConversation(conversationId, event, payload) {
  const io = getIO();
  if (!io) return;
  io.to(roomName(conversationId)).emit(event, payload);
}
