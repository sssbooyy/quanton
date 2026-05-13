# Deploy Quanton Market API on Render

This service is an Express API (`backend/server.js`) with optional Telegram bot polling and a JSON file store for listings.

## 1. Create a Web Service

1. In [Render](https://render.com), **New → Web Service**, connect your repo.
2. **Root directory**: `backend` (if the repo contains both `frontend` and `backend`).
3. **Runtime**: Node (match `engines` in `package.json`, e.g. Node 20).
4. **Build command**: `npm install` (default is fine).
5. **Start command**: `npm start`
6. **Health check path**: `/health`

Render sets `PORT` and typically `NODE_ENV=production` for Web Services.

## 2. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CORS_ORIGINS` | **Yes (prod)** | Comma-separated SPA origins, e.g. `https://app.vercel.app`. Browser requests from other origins are rejected. |
| `FRONTEND_URL` | Optional | Single origin; used only if `CORS_ORIGINS` is empty (legacy). |
| `BOT_TOKEN` | Optional | Telegram bot token; if omitted, the API runs without the bot. |
| `ADMIN_CHAT_ID` | For alerts | Telegram chat id for `/alerts/test` and desk messages. |
| `MINI_APP_URL` | For Web App button | Public **HTTPS** URL of your Mini App (same host you register with BotFather). |
| `DATA_DIR` | Recommended on Render | Absolute path to a **writable** directory for `gifts.json` (see Disk below). |
| `GIFTS_JSON_PATH` | Optional | Full path to the JSON file instead of `DATA_DIR/gifts.json`. |

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

The Telegram Mini App loads your SPA from **your** origin (e.g. Vercel). API calls send `Origin: https://your-spa…`. That exact origin must appear in `CORS_ORIGINS` (include preview URLs if you use them).

`curl` and server-side calls send no `Origin` and are still allowed.

## 5. Frontend (`VITE_API_URL`)

Point the React app at your Render service URL, e.g. `https://quanton-api.onrender.com` (no trailing slash). Configure this in Vercel env as `VITE_API_URL`.

## 6. Telegram production notes

- Use **HTTPS** for `MINI_APP_URL` on the public internet; Telegram blocks insecure schemes except localhost.
- **Polling** is used (single instance). If you scale to multiple instances, switch to webhooks or a single worker — duplicate polling will conflict.
- The process handles **SIGTERM** / **SIGINT**: stops polling before exit (Render sends SIGTERM on deploy/restart).

## 7. Smoke test after deploy

```bash
curl -sS "https://YOUR-SERVICE.onrender.com/health"
curl -sS "https://YOUR-SERVICE.onrender.com/gifts"
```

Expect `health.ok === true` and `storage.giftsWritable === true` once a Disk (or writable path) is configured.
