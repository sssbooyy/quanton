# Deploy Quanton Market API on Render

This service is an Express API (`backend/server.js`) with optional Telegram bot polling and **MongoDB Atlas** for listings (Mongoose).

## Production pairing (current)

| Service | URL |
|---------|-----|
| SPA (Vercel) | `https://quanton-nine.vercel.app` |
| API (Render) | `https://quanton.onrender.com` |

The backend **always** allows the Vercel origin above in CORS (merged with `CORS_ORIGINS` / `FRONTEND_URL`). The frontend defaults to the Render API URL when `VITE_API_URL` is unset at build time (`frontend/src/config.js` and `frontend/vercel.json`).

## 1. MongoDB Atlas

1. Create a free (or paid) cluster in [MongoDB Atlas](https://www.mongodb.com/atlas).
2. **Database Access** → add a database user (password auth).
3. **Network Access** → add IP allowlist **`0.0.0.0/0`** so Render can connect (or use Atlas **Private Endpoint** / fixed egress IPs for stricter setups).
4. **Database** → **Connect** → Drivers → copy the **SRV** connection string.
5. Replace `<password>` and set a default database name in the path, e.g. `...mongodb.net/quanton?retryWrites=true&w=majority`.

Set on Render:

```text
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/quanton?retryWrites=true&w=majority
```

The server **exits on boot** if `MONGODB_URI` is missing.

### Demo seed (non-production only)

When **`NODE_ENV` is not `production`**, if the **`gifts`** collection is **empty**, the service imports rows from `backend/data/gifts.json` (or `GIFTS_JSON_PATH` if set in `backend/config.js`) so local development has sample listings.

**Production** (`NODE_ENV=production`, including Render): automatic Mongo import is **disabled**; an empty database stays empty until real listings are created via `POST /gifts`. `GET /gifts` then returns `[]`. The same JSON file remains on disk for the gift metadata resolver (catalog matching), not as a DB seed.

If you already have documents with old placeholder URLs in dev, either update the `image` field in Atlas or **drop the `gifts` collection** once so the next non-production boot can re-import from the updated JSON.

## 2. Create a Web Service on Render

1. In [Render](https://render.com), **New → Web Service**, connect your repo.
2. **Root directory**: `backend` (if the repo contains both `frontend` and `backend`).
3. **Runtime**: Node (match `engines` in `package.json`, e.g. Node 20).
4. **Build command**: `npm install` (default is fine).
5. **Start command**: `npm start`
6. **Health check path**: `/health`

Render injects **`PORT`**; **`NODE_ENV`** is typically `production` for Web Services.

## 3. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | **Yes** | Atlas SRV (or standard) URI including database name and query params. |
| `PORT` | Auto on Render | Set by Render. |
| `CORS_ORIGINS` | Recommended | Comma-separated SPA origins. Example: `https://quanton-nine.vercel.app`. |
| `FRONTEND_URL` | Optional | Single origin; merged if `CORS_ORIGINS` is empty (legacy). |
| `BOT_TOKEN` | Optional | Telegram bot token; if omitted, the API runs without the bot. |
| `ADMIN_CHAT_ID` | For alerts | Telegram chat id for `/alerts/test` and desk messages. |
| `MINI_APP_URL` | For Web App button | Public **HTTPS** URL of the Mini App. Example: `https://quanton-nine.vercel.app`. |
| `GIFTS_JSON_PATH` | Optional | Absolute path to `gifts.json` for the **resolver** and for **non-production** empty-DB demo seed (defaults under `DATA_DIR` / `backend/data`). |

Copy `backend/.env.example` as a checklist. Do not commit real secrets.

## 4. CORS and the Mini App

The Mini App loads your SPA from **your** Vercel origin. Browser `fetch`/`axios` calls send `Origin: https://quanton-nine.vercel.app`. That origin must be allowed (built-in default + `CORS_ORIGINS` / `FRONTEND_URL`).

CORS is configured with **`credentials: true`** so you can add cookies or credentialed requests later; the allowed origin is reflected explicitly (never `*`).

`curl` and server-side calls often send no `Origin` header and are still allowed.

## 5. Frontend (`VITE_API_URL`)

Production builds target **`https://quanton.onrender.com`** by default (`frontend/src/config.js`). `frontend/vercel.json` sets `build.env.VITE_API_URL` so Vercel builds work without manual env setup. Override in the Vercel dashboard if the API host changes.

## 6. Telegram production notes

- Use **HTTPS** for `MINI_APP_URL` on the public internet; Telegram blocks insecure schemes except localhost.
- **Polling** is used (single instance). If you scale to multiple instances, switch to webhooks or a single worker — duplicate polling will conflict.
- The process handles **SIGTERM** / **SIGINT**: stops Telegram polling and **closes the MongoDB connection** before HTTP shutdown.

## 7. Smoke test after deploy

```bash
curl -sS "https://quanton.onrender.com/health"
curl -sS "https://quanton.onrender.com/gifts"
```

Expect `health.ok === true` and `storage.mongo === true` after Atlas is reachable.
