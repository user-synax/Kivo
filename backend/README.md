# kivo-backend

Express 5 + Socket.IO + Mongoose API for [Kivo](../README.md). JavaScript only; run with [Bun](https://bun.sh).

## Setup

```bash
bun install
cp .env.example .env   # fill in MongoDB, Appwrite, VAPID, Gmail values
```

## Run

```bash
bun run dev    # nodemon watch → http://localhost:4000
bun run start  # production (bun src/server.js)
```

The real entrypoint is `src/server.js` (the repo-root `server.js` is a legacy stub). `src/app.js` builds the Express app shared by the HTTP server and Socket.IO.

## Layout

```
src/
├── app.js           # Express app: helmet, CORS, cookies, /health, route mounts, error handler
├── server.js        # Bootstrap: Mongo connect → Socket.IO init → listen
├── config/          # env, db, webpush
├── lib/             # appwrite storage, attachment uploads, email (nodemailer)
├── middleware/      # auth, adminAuth, rateLimiter (in-memory), errorHandler
├── models/          # User, Session, Conversation, Message, FriendRequest, Space,
│                    #   Notification, PushSubscription, AdminActionLog
├── modules/         # auth, users, friends, conversations, messages, spaces,
│                    #   notifications, push, attachments, search, admin
├── socket/          # Socket.IO init (JWT handshake, presence, rooms) + emit helpers
└── utils/           # errors & async handlers
```

Each module follows the pattern `routes → controller → service → validation`.

## API surface

- `/api/v1/*` — auth, users, friends, conversations, messages, spaces, notifications, push, attachments, search
- `/api/admin/*` — standalone admin API
- `/health` — uptime check

See the repo root [PRD.md](../PRD.md) for the full API reference and [TECH-STACK.md](../TECH-STACK.md) for architecture notes.
