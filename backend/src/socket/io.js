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

// Make every live socket for a single user join a conversation room. Used when
// a member is added so their client starts receiving the thread's events
// without waiting for a reconnect. Mirrors the per-connection join in
// socket/index.js.
export function joinUserToRoom(userId, conversationId) {
  const io = getIO();
  if (!io) return;
  const room = roomName(conversationId);
  for (const [, sock] of io.sockets.sockets) {
    if (sock.userId === userId) sock.join(room);
  }
}

// Make every live socket for a single user leave a conversation room. Used when
// a member is removed (leave/removed) so they stop receiving the thread.
export function leaveUserFromRoom(userId, conversationId) {
  const io = getIO();
  if (!io) return;
  const room = roomName(conversationId);
  for (const [, sock] of io.sockets.sockets) {
    if (sock.userId === userId) sock.leave(room);
  }
}

// Emit an event directly to every live socket for a single user (not room-
// scoped). Used to notify a removed member whose socket has already left the
// room.
export function emitToUser(userId, event, payload) {
  const io = getIO();
  if (!io) return;
  for (const [, sock] of io.sockets.sockets) {
    if (sock.userId === userId) sock.emit(event, payload);
  }
}
