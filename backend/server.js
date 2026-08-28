// Safe entrypoint. The real server lives in src/server.js. This re-exports it so
// that `bun server.js` / `node server.js` (the old stub location) also boots the
// full app with Socket.IO attached, instead of the previous console.log stub.
import "./src/server.js";
