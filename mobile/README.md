# Kivo Mobile (Expo / React Native)

Native Android (+ iOS-ready) client for Kivo. JS-only, Expo Router, NativeWind.
Reuses the existing `backend/` REST + Socket.IO API — no backend rewrite.

## Stack

- Expo SDK 57, React 19, React Native 0.86
- expo-router (file routing), NativeWind v4 + tailwindcss v3
- expo-secure-store (tokens) + AsyncStorage (user/cache)
- socket.io-client (same events as web)

## Run

```bash
cd mobile
bun install
cp .env.example .env
# edit EXPO_PUBLIC_API_URL:
# - Android emulator -> http://10.0.2.2:4000
# - Physical device -> http://<your-LAN-IP>:4000
bun run start
# then press `a` for Android emulator, or scan QR with Expo Go
```

`bun run android` / `bun run ios` / `bun run web` also work.

## Backend note (required for refresh on native)

Web relies on Next.js rewrites + httpOnly `refreshToken` cookie
(`backend/src/modules/auth/auth.controller.js`). Native has no shared
cookie jar, so for production mobile do one small backend addition:

1. On login/register/refresh, also return `refreshToken` in JSON when
   `x-client: native` (or `?client=native`) is sent.
2. On `POST /api/v1/auth/refresh-token`, accept fallback from
   `req.body.refreshToken` or `x-refresh-token` header when the cookie
   is missing.

`mobile/lib/api.js` already sends both (`x-refresh-token` + body) and
persists a returned `data.refreshToken` via SecureStore — so it works
before AND after that backend change (cookie path first).

Also set `CORS_ALLOWED_ORIGINS` / allow the Expo dev origin, and point
`FRONTEND_URL` deep links to `kivo://` for OAuth callbacks when you wire
`expo-auth-session`.

## Structure

```
mobile/
  app/
    _layout.js          root (SafeArea + Auth + Socket + Stack)
    index.js            auth gate -> /(auth)/login or /(tabs)
    (auth)/login.js, signup.js, forgot.js
    (tabs)/_layout.js   bottom tabs: Chats / Groups / Spaces / Menu
    (tabs)/index.js     DM list (GET /conversations?type=dm + socket refresh)
    (tabs)/groups.js    group list
    (tabs)/spaces.js    space list
    (tabs)/menu.js      profile + connection state + logout
    chat/[id].js        message history + send + live message:new
    oauth/callback.js   deep-link landing for Google/GitHub sign-in
  components/auth-provider.jsx
  components/auth-card.jsx, auth-input.jsx, oauth-buttons.jsx
  lib/config.js (API_URL) / api.js / auth.js / socket.jsx / theme.js / oauth.js
  global.css + tailwind.config.js + metro.config.js + babel.config.js
```

## Auth (matches web)

Login/signup mirror the web AuthCard design (canvas + glow, logo, card,
labeled inputs with show/hide password, inline errors) and behavior:
email/username + password, 2FA verify step (`/login/2fa` ticket), forgot
password via emailed link, plus Google/GitHub buttons.

OAuth flow (backend `return_to` support required — shipped):
`expo-web-browser` auth session -> backend `GET /oauth/:provider`
-> Google/GitHub -> backend callback -> 302 to `kivo://oauth/callback`
with `accessToken` (+ `refreshToken` for SecureStore) -> session stored,
router enters `/(tabs)`. Provider buttons hide automatically when the
backend reports them unconfigured (`GET /oauth/providers`).

Device testing notes (provider redirect URIs):
- The provider must redirect the *device browser* somewhere reachable.
  Pass `?redirect_uri=<API_URL>/api/v1/auth/oauth/<provider>/callback`
  (same callback path, device-reachable host) — done automatically.
- **GitHub** accepts `http://10.0.2.2:4000/...` (emulator) or
  `http://<LAN-IP>:4000/...` (physical device) — just add the exact URI
  in the GitHub OAuth app settings.
- **Google** only allows `https` (except loopback), so local testing needs
  an https tunnel (e.g. cloudflared/ngrok) in front of the backend with
  the tunnel URI registered in Google Cloud console. In production, use
  the public backend URL.

## Next steps

- EAS Build for store APK/AAB: `eas build -p android`
- Push: add `expo-notifications` + `POST /push/expo-token` backend module
- Media: `expo-image-picker` / `expo-document-picker` -> existing attachments API
- Voice/video: `@livekit/react-native` reusing `POST /calls/token` rooms
```

