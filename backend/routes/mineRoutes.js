import { Router } from "express";
import { requireTelegramUser } from "../middleware/resolveTelegramUser.js";
import {
  claimDailyReward,
  getMiningProfile,
  getOrCreateMiningUser,
  processMiningTap,
  purchaseMiningUpgrade,
  UPGRADE_CATALOG,
} from "../services/miningService.js";

const router = Router();

router.use(requireTelegramUser);

router.get("/profile", async (req, res, next) => {
  try {
    console.log("[mining] GET /profile", { telegramId: req.telegramUserId });
    const result = await getMiningProfile(req.telegramUserId, req.telegramProfilePatch);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ ok: true, ...result, catalog: UPGRADE_CATALOG });
  } catch (e) {
    next(e);
  }
});

router.post("/tap", async (req, res, next) => {
  try {
    console.log("[mining] POST /tap", { telegramId: req.telegramUserId });
    const result = await processMiningTap(req.telegramUserId, {
      tapCount: req.body?.tapCount ?? 1,
    });
    if (result.error) {
      const status = result.code === "no_energy" ? 409 : result.code === "rate_limit" || result.code === "cooldown" ? 429 : 400;
      return res.status(status).json(result);
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.post("/daily", async (req, res, next) => {
  try {
    await getOrCreateMiningUser(req.telegramUserId, req.telegramProfilePatch);
    const result = await claimDailyReward(req.telegramUserId);
    if (result.error) {
      return res.status(409).json(result);
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.post("/upgrade", async (req, res, next) => {
  try {
    const upgradeId = String(req.body?.upgradeId ?? "").trim();
    console.log("[mining] POST /upgrade", { telegramId: req.telegramUserId, upgradeId });
    const result = await purchaseMiningUpgrade(req.telegramUserId, upgradeId);
    if (result.error) {
      const status =
        result.code === "insufficient_shards" || result.code === "max_level"
          ? 409
          : result.code === "invalid_upgrade"
            ? 400
            : 400;
      return res.status(status).json(result);
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

export default router;
