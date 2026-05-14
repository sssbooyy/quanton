import crypto from "crypto";
import express from "express";
import dotenv from "dotenv";
import { initTelegramBot, sendAdminAlert, stopTelegramBot } from "./services/telegramBot.js";
import { PORT, isProduction } from "./config.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { connectMongo, disconnectMongo, isMongoConnected } from "./db/connect.js";
import {
  createGiftFromBody,
  giftToApiResponse,
  listGiftsForApi,
  listUndervaluedForApi,
  seedGiftsFromJsonIfEmpty,
} from "./services/giftApi.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(createCorsMiddleware());
app.use(express.json({ limit: "512kb" }));

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
