import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { calculateAiScore } from "./services/aiScore.js";
import { initTelegramBot, sendAdminAlert, stopTelegramBot } from "./services/telegramBot.js";
import { DATA_DIR, GIFTS_FILE_PATH, PORT, isProduction } from "./config.js";
import { createCorsMiddleware } from "./middleware/cors.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(createCorsMiddleware());
app.use(express.json({ limit: "512kb" }));

function ensureGiftsFile() {
  const dir = path.dirname(GIFTS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(GIFTS_FILE_PATH)) {
    fs.writeFileSync(GIFTS_FILE_PATH, "[]", "utf-8");
  }
}

function readSavedGifts() {
  ensureGiftsFile();
  const data = fs.readFileSync(GIFTS_FILE_PATH, "utf-8");
  try {
    const parsed = JSON.parse(data || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGifts(gifts) {
  ensureGiftsFile();
  const serialized = JSON.stringify(gifts, null, 2);
  const tmp = `${GIFTS_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, serialized, "utf-8");
    fs.renameSync(tmp, GIFTS_FILE_PATH);
  } catch (e) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

app.get("/health", (_req, res) => {
  let giftsWritable = false;
  try {
    ensureGiftsFile();
    fs.accessSync(path.dirname(GIFTS_FILE_PATH), fs.constants.W_OK);
    giftsWritable = true;
  } catch {
    giftsWritable = false;
  }

  const storage = isProduction
    ? {
        giftsWritable,
        customDataDir: Boolean(process.env.DATA_DIR?.trim()),
        customGiftsPath: Boolean(process.env.GIFTS_JSON_PATH?.trim()),
      }
    : {
        giftsWritable,
        giftsFile: GIFTS_FILE_PATH,
        dataDir: DATA_DIR,
      };

  res.json({
    ok: true,
    service: "quanton-market-api",
    time: new Date().toISOString(),
    uptime: process.uptime(),
    env: isProduction ? "production" : "development",
    storage,
  });
});

app.get("/gifts", (_req, res) => {
  const savedGifts = readSavedGifts();

  const result = savedGifts.map((gift) => ({
    ...gift,
    ...calculateAiScore(gift),
  }));

  res.json(result);
});

app.get("/gifts/undervalued", (_req, res) => {
  const result = readSavedGifts()
    .map((gift) => ({ ...gift, ...calculateAiScore(gift) }))
    .filter((gift) => gift.undervaluedPercent >= 15)
    .sort((a, b) => b.aiScore - a.aiScore);

  res.json(result);
});

app.post("/alerts/test", async (req, res) => {
  const enriched = readSavedGifts().map((gift) => ({
    ...gift,
    ...calculateAiScore(gift),
  }));

  if (!enriched.length) {
    return res.status(400).json({
      error: "No listings on file. Add a listing before sending a test alert.",
    });
  }

  const bestGift = [...enriched].sort((a, b) => b.aiScore - a.aiScore)[0];

  const message = `🚨 <b>Quanton Market — desk alert</b>\n\n🎁 ${bestGift.name}\n💎 Ask: ${bestGift.priceTon} TON\n📊 Floor: ${bestGift.floorTon} TON\n🤖 Model score: ${bestGift.aiScore}/100\n📈 vs floor: ${bestGift.undervaluedPercent}%\n⚡ Signal: ${bestGift.signal}`;

  await sendAdminAlert(message);

  res.json({ ok: true, sent: true, gift: bestGift });
});

app.post("/gifts", (req, res) => {
  const {
    name,
    collection,
    image,
    priceTon,
    floorTon,
    rarity,
    telegramUser,
  } = req.body;

  const nameTrim = typeof name === "string" ? name.trim() : "";
  const collectionTrim = typeof collection === "string" ? collection.trim() : "";
  const imageTrim = typeof image === "string" ? image.trim() : "";

  const priceNum = Number(priceTon);
  const floorNum = Number(floorTon);
  const rarityNum = Number(rarity);

  if (!nameTrim) {
    return res.status(400).json({ error: "Gift name is required." });
  }
  if (!collectionTrim) {
    return res.status(400).json({ error: "Collection is required." });
  }
  if (!imageTrim) {
    return res.status(400).json({ error: "Image URL is required." });
  }
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return res.status(400).json({ error: "Price in TON must be a number greater than 0." });
  }
  if (!Number.isFinite(floorNum) || floorNum <= 0) {
    return res.status(400).json({ error: "Floor price in TON must be a number greater than 0." });
  }
  if (!Number.isInteger(rarityNum) || rarityNum < 1 || rarityNum > 100) {
    return res.status(400).json({ error: "Rarity must be a whole number from 1 to 100." });
  }

  const savedGifts = readSavedGifts();

  const newGift = {
    id: `gift_${Date.now()}`,
    name: nameTrim,
    collection: collectionTrim,
    image: imageTrim,
    priceTon: priceNum,
    floorTon: floorNum,
    rarity: rarityNum,
    sales24h: 0,
    volumeGrowth: 0,
    liquidity: "Unknown",
    risk: "Unknown",
    status: "pending",
    telegramUser: telegramUser ?? null,
    createdAt: new Date().toISOString(),
  };

  savedGifts.push(newGift);
  saveGifts(savedGifts);

  res.status(201).json({
    ...newGift,
    ...calculateAiScore(newGift),
  });
});

initTelegramBot();

const host = "0.0.0.0";
const server = app.listen(PORT, host, () => {
  console.log(`[server] Quanton Market API listening on http://${host}:${PORT}`);
  console.log(`[server] Gifts file: ${GIFTS_FILE_PATH}`);
});

function shutdown(signal) {
  console.log(`[server] ${signal} received, closing...`);
  stopTelegramBot()
    .catch(() => {})
    .finally(() => {
      server.close(() => {
        console.log("[server] HTTP server closed");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("[server] Forced exit after timeout");
        process.exit(1);
      }, 15_000).unref();
    });
}

["SIGTERM", "SIGINT"].forEach((sig) => {
  process.on(sig, () => shutdown(sig));
});
