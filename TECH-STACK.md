Kivo Technical Stack & Architecture

Repository Strategy

Kivo uses one Git repository containing separate frontend and backend applications.

kivo/
├── frontend/
├── backend/
├── design.md
├── prd.md
├── stack.md
└── ...

This is intentionally a simple monorepo layout. Do not introduce microservices initially.

Frontend

Core

Next.js

JavaScript only

App Router

React

Tailwind CSS

shadcn/ui

Motion.dev

Frontend Responsibilities

UI and interaction

Routing

Server rendering where useful

Responsive design

API consumption

Socket.IO client

Optimistic UI

Theme/customization system

PWA readiness

Accessibility

Client-side state only where needed

Do NOT introduce TypeScript.

Avoid unnecessary UI/component libraries when shadcn/ui or native implementation is sufficient.

Backend

Core

Node.js

Express

JavaScript

Socket.IO

Mongoose

MongoDB

Redis

Zod

Backend Responsibilities

Authentication/session logic

Authorization

Business rules

REST API

Realtime event authorization

Database operations

Rate limiting

File upload orchestration

Notification orchestration

Error handling

Security controls

API Style

Use versioned REST APIs:

/api/v1

Prefer resource-oriented routes, for example:

GET /api/v1/conversations
POST /api/v1/conversations

GET /api/v1/conversations/:id/messages
POST /api/v1/conversations/:id/messages

PATCH /api/v1/messages/:id
DELETE /api/v1/messages/:id

POST /api/v1/messages/:id/reactions
DELETE /api/v1/messages/:id/reactions/:reactionId

POST /api/v1/spaces
GET /api/v1/spaces/:id

POST /api/v1/spaces/:id/channels
GET /api/v1/channels/:id/messages

Do not create ad-hoc endpoint names such as /sendMessage or /getMessages.

Server Architecture

Prefer domain/module-based organization:

backend/
└── src/
├── config/
├── middleware/
├── modules/
│ ├── auth/
│ ├── users/
│ ├── conversations/
│ ├── messages/
│ ├── spaces/
│ ├── channels/
│ └── notifications/
├── socket/
├── services/
├── utils/
├── app.js
└── server.js

Avoid giant global controllers, routes, models, and utils folders containing unrelated business logic.

Each domain should own its routes/controllers/services/model/schema as the codebase grows.

Database

Primary database

MongoDB Atlas

ODM

Mongoose

MongoDB is the canonical source of truth.

Core data will include concepts such as:

User
Session
Conversation
ConversationMember
Message
MessageReaction
Space
SpaceMember
Channel
Notification
UserSettings
Attachment
Report

Do not embed unbounded message arrays inside conversations.

Messages must be independently stored and paginated.

Important indexes will include combinations around:

conversationId + createdAt

senderId + createdAt

membership lookups

usernames/search fields where appropriate

Indexes should be introduced based on access patterns.

Redis

Redis is used from day one.

Redis responsibilities:

short-lived caching

rate limiting

temporary state

unread counters where appropriate

locks where required

presence/typing support where appropriate

future Socket.IO horizontal scaling

Redis is NOT the source of truth for messages.

Design helpers/services around explicit cache expiry and invalidation.

Realtime

Primary transport

Socket.IO

Socket.IO is the primary realtime layer for Kivo's messaging experience.

Use it for:

new messages

message updates/deletions

reactions

typing indicators

delivery/read state

presence

realtime notifications

conversation updates

Connections must authenticate.

Server must verify:

user identity

conversation membership

space/channel membership

relevant permissions

before accepting sensitive socket events.

Appwrite

Appwrite is a supporting infrastructure service, not the core application database.

Appwrite Storage

Use for:

avatars

images

documents

message attachments

future media

Appwrite Messaging

Use for:

push notifications

Appwrite Presence

May be used for:

temporary presence

online/away

typing-like ephemeral state

However, Socket.IO remains the primary realtime transport for Kivo.

Do not store core chat history in Appwrite Database merely because Appwrite provides a database.

Validation

Use Zod for:

body validation

query validation

route parameter validation

important internal input boundaries where useful

The client cannot be trusted.

Validation must happen server-side.

Authentication

Authentication/session architecture should be centralized in the backend.

Protected API request flow:

Request
↓
Authentication
↓
User identification
↓
Validation
↓
Authorization
↓
Business logic
↓
Database

Sensitive credentials and secrets must never be exposed to the browser.

Authorization

Authorization is resource-based.

Examples:

Is this user a member of the conversation?

Can this user edit this message?

Can this user delete this message?

Does this user have permission to manage the Space?

Can this member create channels?

Never trust role/permission values sent by the frontend.

Error Handling

Use centralized Express error handling.

Prefer consistent API responses such as:

{
"success": false,
"error": {
"code": "SOME_ERROR",
"message": "Human readable message"
}
}

Production errors must not expose:

stack traces

secrets

database connection details

internal file paths

Security Middleware

Prepare for:

secure CORS

Helmet/security headers

request body limits

rate limiting

cookie security

input validation

upload validation

authentication middleware

authorization middleware

centralized error handling

Performance

Use:

cursor-based pagination

MongoDB indexes

Redis caching where justified

optimistic UI

lazy loading

efficient image sizing/loading

message-list virtualization when necessary

Socket.IO instead of polling for realtime chat

minimal client-side state

avoid unnecessary database reads

Do not optimize blindly. Measure first when possible.

Frontend ↔ Backend

Core business flow:

Browser
↓ HTTPS
Next.js frontend
↓ REST API
Express backend
↓
MongoDB

Realtime:

Browser
↕ Socket.IO
Socket.IO server

Typical message flow:

Client
↓
POST /messages
↓
Authenticate
↓
Zod validation
↓
Authorize membership
↓
MongoDB write
↓
Socket.IO emit
↓
Recipients

This means MongoDB is authoritative; Socket.IO distributes realtime events.

Server Runtime

Bun is the intended package manager and runtime for local development and backend execution where compatibility is confirmed.

Use Bun consistently:

bun install
bun add
bun add -d
bun run dev
bun run start
bunx ...

Do not mix npm/pnpm/yarn unless a specific package/tool requires it.

Before adopting runtime-sensitive dependencies, verify Bun compatibility.

Deployment

Frontend

Vercel

Backend

Start with a low-cost/simple always-available Node-compatible host such as Render/Railway based on current pricing and runtime support.

The backend deployment must support long-lived WebSocket connections for Socket.IO.

Do not rely on artificial keep-alive tricks to prevent a free-tier instance from sleeping.

Upgrade to an always-on service when real users depend on realtime availability.

Database

MongoDB Atlas

Storage

Appwrite Storage

Push

Appwrite Messaging

Environment Variables

Keep secrets server-side.

Example categories:

MONGODB_URI
REDIS_URL

APPWRITE_ENDPOINT
APPWRITE_PROJECT_ID
APPWRITE_API_KEY
APPWRITE_BUCKET_ID

AUTH/SESSION secrets
CORS/FRONTEND origin

Public browser variables must be explicitly prefixed and contain no secrets.

Maintain .env.example.

Development Principles

JavaScript only across frontend and backend.

Prefer simple architecture over premature abstraction.

Domain-driven modules.

No microservices initially.

No direct frontend-to-database access.

No trust in client authorization claims.

No unbounded database arrays for messages.

Realtime and persistence are separate concerns.

Redis is acceleration/state infrastructure, not canonical storage.

Appwrite supplements the core backend.

Build only features supported by the current PRD.

Keep the UI fast and polished.

Reuse design tokens from design.md.

Future Scaling Direction

Initial:

Next.js
↓
Express + Socket.IO
↓
MongoDB

- Redis
- Appwrite

Later, if scale requires:

Load Balancer
├── API/Socket Server 1
├── API/Socket Server 2
└── API/Socket Server 3
↓
Redis
↓
MongoDB

Only split services when actual scale or organizational complexity justifies it.

Engineering Goal

The stack is intentionally chosen to teach and support real full-stack engineering:

API design

authorization

database modeling

realtime systems

caching

queues later

file storage

push notifications

performance

security

scalable deployment

polished modern frontend engineering
