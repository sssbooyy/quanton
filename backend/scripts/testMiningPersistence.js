/**
 * Persistence smoke test (requires MONGODB_URI).
 * Usage: node backend/scripts/testMiningPersistence.js
 */
import dotenv from "dotenv";
import { connectMongo, disconnectMongo } from "../db/connect.js";
import { getMiningProfile, processMiningTap } from "../services/miningService.js";
import { User } from "../models/User.js";

dotenv.config();

const TEST_ID = `persist_test_${Date.now().toString(36)}`;

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("MONGODB_URI required");
    process.exit(1);
  }
  await connectMongo(uri);

  const p1 = await getMiningProfile(TEST_ID);
  const shards1 = p1.profile.shards;
  console.log("[test] profile 1", { telegramId: TEST_ID, shards: shards1, energy: p1.profile.energy });

  const tap = await processMiningTap(TEST_ID, { tapCount: 1 });
  if (tap.error) {
    console.error("[test] tap failed", tap);
    process.exit(1);
  }
  console.log("[test] tap", { shardsEarned: tap.shardsEarned, totalShards: tap.profile.shards });

  const doc = await User.findOne({ telegramId: TEST_ID }).lean();
  console.log("[test] mongo doc", { shards: doc.shards, energy: doc.energy, totalTaps: doc.totalTaps });

  const p2 = await getMiningProfile(TEST_ID);
  console.log("[test] profile 2 (reload)", { shards: p2.profile.shards, energy: p2.profile.energy });

  if (p2.profile.shards <= shards1) {
    console.error("[test] FAIL: shards did not increase after tap");
    process.exit(1);
  }
  if (doc.shards !== p2.profile.shards) {
    console.error("[test] FAIL: API profile does not match MongoDB");
    process.exit(1);
  }

  await User.deleteOne({ telegramId: TEST_ID });
  console.log("[test] PASS: mining progress persisted across reload");
  await disconnectMongo();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
