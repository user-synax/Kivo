# kivo-frontend

Next.js 16 (App Router) + React 19 chat client for [Kivo](../README.md). JavaScript only — no TypeScript, by design.

## Setup & run

```bash
bun install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local   # Socket.IO origin
bun run dev     # http://localhost:3000
bun run build   # production build
bun run lint    # biome check
```

REST calls use relative `/api/*` paths — `next.config.mjs` rewrites them to the backend (`BACKEND_URL`, default `http://localhost:4000`). Socket.IO connects directly to `NEXT_PUBLIC_API_URL` (Next rewrites do not proxy WebSocket upgrades).

## Layout

- `app/` — routes: `/` landing, `(auth)/` (login, signup, forgot/reset password, verify-email), `/app` chat, `/app/profile`, `/u/[username]` public profiles, `/docs`, `/admin`
- `components/` — `dashboard/`, `spaces/`, `notifications/`, `profile/`, `chat/`, `mentions/`, `ui/`, `motion/`, `navbar/`, `admin/`, `docs/`
- `lib/` — api wrapper, auth session store, IndexedDB cache, theme system, push, sound, etc.
- `Design.md` — visual design system & tokens

Tooling: Tailwind CSS v4, shadcn/ui + Base UI, Motion, Biome. See the repo root [README](../README.md) for the full setup guide.
