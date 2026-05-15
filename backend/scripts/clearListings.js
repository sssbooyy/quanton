/**
 * Delete ALL marketplace listings from MongoDB (Gift model → collection `gifts`).
 * Does not touch `users` or any other collections (none other than Gift/User exist here).
 *
 * Safety:
 * - Set CLEAR_LISTINGS_CONFIRM=DELETE_ALL_MARKETPLACE_LISTINGS
 * - If NODE_ENV=production, also pass --production OR set CLEAR_LISTINGS_ALLOW_PRODUCTION=1
 *
 * Afterward: GET /gifts should return []. In non-production, restarting the API may re-seed
 * from gifts.json if the file exists (see seedGiftsFromJsonIfEmpty); production never auto-seeds.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const [{ connectMongo, disconnectMongo }, { Gift }] = await Promise.all([
  import("../db/connect.js"),
  import("../models/Gift.js"),
]);

const CONFIRM_TOKEN = "DELETE_ALL_MARKETPLACE_LISTINGS";

function wantsProductionBypass(argv) {
  return argv.includes("--production");
}

async function main() {
  const confirm = process.env.CLEAR_LISTINGS_CONFIRM?.trim();
  if (confirm !== CONFIRM_TOKEN) {
    console.error(
      `[clear-listings] Refusing to run. Export exactly:\n  CLEAR_LISTINGS_CONFIRM=${CONFIRM_TOKEN}`
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("[clear-listings] MONGODB_URI is required.");
    process.exit(1);
  }

  const isProduction =
    (process.env.NODE_ENV || "development").trim().toLowerCase() === "production";
  if (isProduction) {
    const allow =
      process.env.CLEAR_LISTINGS_ALLOW_PRODUCTION?.trim() === "1" ||
      wantsProductionBypass(process.argv.slice(2));
    if (!allow) {
      console.error(
        "[clear-listings] NODE_ENV=production: add flag --production OR set CLEAR_LISTINGS_ALLOW_PRODUCTION=1"
      );
      process.exit(1);
    }
  }

  await connectMongo(uri);
  try {
    const coll = Gift.collection.name;
    const before = await Gift.countDocuments();
    console.log(`[clear-listings] Target: MongoDB collection "${coll}" (Gift / marketplace listings only)`);
    console.log(`[clear-listings] countDocuments before: ${before}`);

    const result = await Gift.deleteMany({});

    const after = await Gift.countDocuments();
    console.log(`[clear-listings] deletedCount: ${result.deletedCount}`);
    console.log(`[clear-listings] countDocuments after: ${after}`);

    if (after !== 0) {
      console.warn("[clear-listings] Expected 0 documents after delete; investigate.");
      process.exitCode = 2;
    }
  } finally {
    await disconnectMongo();
  }
}

await main().catch((err) => {
  console.error("[clear-listings] failed:", err);
  process.exit(1);
});
