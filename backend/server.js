import crypto from "crypto";
import express from "express";
import dotenv from "dotenv";
import { initTelegramBot, sendAdminAlert, stopTelegramBot } from "./services/telegramBot.js";
import { PORT, isProduction, METADATA_SYNC_SECRET } from "./config.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { connectMongo, disconnectMongo, isMongoConnected } from "./db/connect.js";
import {
  createGiftFromBody,
  giftToApiResponse,
  listGiftsForApi,
  listUndervaluedForApi,
  seedGiftsFromJsonIfEmpty,
} from "./services/giftApi.js";
import { refreshGiftByListingId, syncStaleGiftMetadata } from "./services/metadataRefresh.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(createCorsMiddleware());
app.use(express.json({ limit: "512kb" }));

/** Batch/single metadata refresh: require secret in production; dev allows open calls when unset. */
function assertMetadataJobAllowed(req, res) {
  if (METADATA_SYNC_SECRET) {
    const h = String(req.headers["x-metadata-sync-secret"] ?? "").trim();
    const auth = String(req.headers.authorization ?? "").trim();
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (h === METADATA_SYNC_SECRET || bearer === METADATA_SYNC_SECRET) return true;
    res.status(401).json({ error: "Invalid or missing metadata sync credentials." });
    return false;
  }
  if (isProduction) {
    res.status(503).json({
      error: "Set METADATA_SYNC_SECRET to enable metadata refresh endpoints in production.",
    });
    return false;
  }
  return true;
}

app.get("/health", (_req, res) => {
  const mongoReady = isMongoConnected();
  const storage = isProduction
    ? { mongo: mongoReady }
    : { mongo: mongoReady };

  res.json({
    ok: true,
    service: "quanton-market-api",
    time: new Date().toISOString(),
    uptime: process.uptime(),
    env: isProduction ? "production" : "development",
    storage,
  });
});

app.get("/gifts", async (_req, res, next) => {
  try {
    res.json(await listGiftsForApi());
  } catch (e) {
    next(e);
  }
});

app.get("/gifts/undervalued", async (_req, res, next) => {
  try {
    res.json(await listUndervaluedForApi());
  } catch (e) {
    next(e);
  }
});

app.post("/alerts/test", async (req, res, next) => {
  try {
    const enriched = await listGiftsForApi();

    if (!enriched.length) {
      return res.status(400).json({
        error: "No listings on file. Add a listing before sending a test alert.",
      });
    }

    const bestGift = [...enriched].sort((a, b) => b.aiScore - a.aiScore)[0];

    const message = `🚨 <b>Quanton Market — desk alert</b>\n\n🎁 ${bestGift.name}\n💎 Ask: ${bestGift.priceTon} TON\n📊 Floor: ${bestGift.floorTon} TON\n🤖 Model score: ${bestGift.aiScore}/100\n📈 vs floor: ${bestGift.undervaluedPercent}%\n⚡ Signal: ${bestGift.signal}`;

    await sendAdminAlert(message);

    res.json({ ok: true, sent: true, gift: bestGift });
  } catch (e) {
    next(e);
  }
});

app.post("/gifts", async (req, res, next) => {
  try {
    const suffix = crypto.randomBytes(3).toString("hex");
    const result = await createGiftFromBody(req.body, suffix);
    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    res.status(201).json(giftToApiResponse(result.gift));
  } catch (e) {
    next(e);
  }
});

app.post("/gifts/:listingId/metadata/refresh", async (req, res, next) => {
  try {
    if (!assertMetadataJobAllowed(req, res)) return;
    const listingId = String(req.params.listingId ?? "").trim();
    if (!listingId) {
      return res.status(400).json({ error: "listingId is required." });
    }
    const result = await refreshGiftByListingId(listingId);
    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    res.json(giftToApiResponse(result.gift));
  } catch (e) {
    next(e);
  }
});

app.post("/gifts/metadata/sync-stale", async (req, res, next) => {
  try {
    if (!assertMetadataJobAllowed(req, res)) return;
    const maxAgeHours = Number(req.body?.maxAgeHours);
    const limit = Number(req.body?.limit);
    const out = await syncStaleGiftMetadata({
      maxAgeHours: Number.isFinite(maxAgeHours) ? maxAgeHours : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  console.error("[server]", err);
  res.status(500).json({ error: "Internal server error." });
});

initTelegramBot();

const host = "0.0.0.0";

async function start() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("[server] MONGODB_URI is required (MongoDB Atlas connection string).");
    process.exit(1);
  }

  await connectMongo(uri);
  await seedGiftsFromJsonIfEmpty();

  const server = app.listen(PORT, host, () => {
    console.log(`[server] Quanton Market API listening on http://${host}:${PORT}`);
    console.log("[server] Gifts storage: MongoDB Atlas");
  });

  async function shutdown(signal) {
    console.log(`[server] ${signal} received, closing...`);
    try {
      await stopTelegramBot();
    } catch {
      /* ignore */
    }
    try {
      await disconnectMongo();
    } catch {
      /* ignore */
    }
    server.close(() => {
      console.log("[server] HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[server] Forced exit after timeout");
      process.exit(1);
    }, 15_000).unref();
  }

  ["SIGTERM", "SIGINT"].forEach((sig) => {
    process.on(sig, () => shutdown(sig));
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
