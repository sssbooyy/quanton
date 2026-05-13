# Deploy Quanton Market API on Render

This service is an Express API (`backend/server.js`) with optional Telegram bot polling and a JSON file store for listings.

## Production pairing (current)

| Service | URL |
|---------|-----|
| SPA (Vercel) | `https://quanton-nine.vercel.app` |
| API (Render) | `https://quanton.onrender.com` |

The backend **always** allows the Vercel origin above in CORS (merged with `CORS_ORIGINS` / `FRONTEND_URL`). The frontend defaults to the Render API URL when `VITE_API_URL` is unset at build time (`frontend/src/config.js` and `frontend/vercel.json`).

## 1. Create a Web Service

1. In [Render](https://render.com), **New → Web Service**, connect your repo.
2. **Root directory**: `backend` (if the repo contains both `frontend` and `backend`).
3. **Runtime**: Node (match `engines` in `package.json`, e.g. Node 20).
4. **Build command**: `npm install` (default is fine).
5. **Start command**: `npm start`
6. **Health check path**: `/health`

Render injects **`PORT`**; **`NODE_ENV`** is typically `production` for Web Services.

## 2. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Auto on Render | Set by Render; do not override unless you know what you are doing. |
| `CORS_ORIGINS` | Recommended | Comma-separated SPA origins. Example: `https://quanton-nine.vercel.app`. Extra preview domains can be appended. The Vercel production URL above is also built into `backend/middleware/cors.js` as a default. |
| `FRONTEND_URL` | Optional | Single origin; merged if `CORS_ORIGINS` is empty (legacy). Example: `https://quanton-nine.vercel.app`. |
| `BOT_TOKEN` | Optional | Telegram bot token; if omitted, the API runs without the bot. |
| `ADMIN_CHAT_ID` | For alerts | Telegram chat id for `/alerts/test` and desk messages. |
| `MINI_APP_URL` | For Web App button | Public **HTTPS** URL of the Mini App. Example: `https://quanton-nine.vercel.app`. |

Copy `backend/.env.example` as a checklist. Do not commit real secrets.

## 3. Persistent `gifts.json`

Render’s filesystem is **ephemeral**: redeploys can wipe the default `./data/gifts.json` under the repo.

**Recommended:** attach a [Render Disk](https://render.com/docs/disks), mount it (e.g. `/var/data/quanton`), then set:

```text
DATA_DIR=/var/data/quanton
```

The app creates the directory and `gifts.json` if missing. Writes use a temp file + rename to reduce corruption on crash.

**Alternative:** keep using bundled `backend/data/gifts.json` for demos only; expect data loss on restart.

## 4. CORS and the Mini App

The Mini App loads your SPA from **your** Vercel origin. Browser `fetch`/`axios` calls send `Origin: https://quanton-nine.vercel.app`. That origin must be allowed (built-in default + `CORS_ORIGINS` / `FRONTEND_URL`).

CORS is configured with **`credentials: true`** so you can add cookies or credentialed requests later; the allowed origin is reflected explicitly (never `*`).

`curl` and server-side calls often send no `Origin` header and are still allowed.

## 5. Frontend (`VITE_API_URL`)

Production builds target **`https://quanton.onrender.com`** by default (`frontend/src/config.js`). `frontend/vercel.json` sets `build.env.VITE_API_URL` so Vercel builds work without manual env setup. Override in the Vercel dashboard if the API host changes.

## 6. Telegram production notes

- Use **HTTPS** for `MINI_APP_URL` on the public internet; Telegram blocks insecure schemes except localhost.
- **Polling** is used (single instance). If you scale to multiple instances, switch to webhooks or a single worker — duplicate polling will conflict.
- The process handles **SIGTERM** / **SIGINT**: stops polling before exit (Render sends SIGTERM on deploy/restart).

## 7. Smoke test after deploy

```bash
curl -sS "https://quanton.onrender.com/health"
curl -sS "https://quanton.onrender.com/gifts"
```

Expect `health.ok === true` and `storage.giftsWritable === true` once a Disk (or writable path) is configured.
