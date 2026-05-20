import { useCallback, useEffect, useRef, useState } from "react";
import { getMineProfile, postMineDaily, postMineTap, postMineUpgrade } from "../api.js";
import { formatMiningApiError } from "../lib/miningApiError.js";
import {
  getTelegramUserIdForMining,
  hapticNotification,
  isTelegramMiniApp,
  miningAuthBody,
  miningAuthHeaders,
} from "../lib/telegramUser.js";

const PROFILE_POLL_MS = 8000;
const TELEGRAM_INIT_WAIT_MS = 400;

export function useMining() {
  const [profile, setProfile] = useState(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tapping, setTapping] = useState(false);
  const [upgradingId, setUpgradingId] = useState(null);
  const [upgradeFlash, setUpgradeFlash] = useState(null);
  const [floats, setFloats] = useState([]);
  const tapLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const boot = () => {
      try {
        window.Telegram?.WebApp?.ready?.();
        window.Telegram?.WebApp?.expand?.();
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        const id = getTelegramUserIdForMining();
        console.log("[mining] identity ready", {
          telegramId: id,
          inTelegram: isTelegramMiniApp(),
        });
        setIdentityReady(true);
      }
    };
    if (isTelegramMiniApp()) {
      const t = window.setTimeout(boot, TELEGRAM_INIT_WAIT_MS);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const telegramId = getTelegramUserIdForMining();
    const headers = miningAuthHeaders();
    try {
      setError("");
      const data = await getMineProfile(headers);
      setProfile(data.profile);
      console.log("[mining] profile loaded", {
        telegramId,
        shards: data.profile?.shards,
        energy: data.profile?.energy,
        level: data.profile?.level,
      });
      return data.profile;
    } catch (e) {
      setError(formatMiningApiError(e, "/mine/profile"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!identityReady) return undefined;
    refresh();
    const id = window.setInterval(refresh, PROFILE_POLL_MS);
    return () => window.clearInterval(id);
  }, [identityReady, refresh]);

  const addFloat = useCallback((amount) => {
    const id = `${Date.now()}_${Math.random()}`;
    setFloats((prev) => [...prev.slice(-6), { id, amount }]);
    window.setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 900);
  }, []);

  const tap = useCallback(async () => {
    if (tapLock.current || tapping) return null;
    if ((profile?.energy ?? 0) <= 0) {
      hapticNotification("error");
      return null;
    }
    tapLock.current = true;
    setTapping(true);
    try {
      const data = await postMineTap(miningAuthBody({ tapCount: 1 }), miningAuthHeaders());
      if (data.profile) setProfile(data.profile);
      if (data.shardsEarned) addFloat(data.shardsEarned);
      console.log("[mining] tap ok", data.shardsEarned);
      return data;
    } catch (e) {
      if (e.response?.data?.profile) setProfile(e.response.data.profile);
      setError(formatMiningApiError(e, "/mine/tap"));
      hapticNotification("error");
      return null;
    } finally {
      setTapping(false);
      window.setTimeout(() => {
        tapLock.current = false;
      }, 80);
    }
  }, [addFloat, profile?.energy, tapping]);

  const claimDaily = useCallback(async () => {
    try {
      setError("");
      const data = await postMineDaily(miningAuthBody(), miningAuthHeaders());
      if (data.profile) setProfile(data.profile);
      hapticNotification("success");
      console.log("[mining] daily claimed", data.reward);
      return data;
    } catch (e) {
      if (e.response?.data?.profile) setProfile(e.response.data.profile);
      setError(formatMiningApiError(e, "/mine/daily"));
      hapticNotification("error");
      return null;
    }
  }, []);

  const purchaseUpgrade = useCallback(async (upgradeId) => {
    if (!upgradeId || upgradingId) return null;
    setUpgradingId(upgradeId);
    try {
      setError("");
      const data = await postMineUpgrade(
        miningAuthBody({ upgradeId }),
        miningAuthHeaders()
      );
      if (data.profile) setProfile(data.profile);
      setUpgradeFlash({ upgradeId, cost: data.cost, at: Date.now() });
      window.setTimeout(() => setUpgradeFlash(null), 1200);
      if (data.cost) addFloat(-data.cost);
      hapticNotification("success");
      console.log("[mining] upgrade purchased", data);
      return data;
    } catch (e) {
      if (e.response?.data?.profile) setProfile(e.response.data.profile);
      setError(formatMiningApiError(e, "/mine/upgrade"));
      hapticNotification("error");
      return null;
    } finally {
      setUpgradingId(null);
    }
  }, [addFloat, upgradingId]);

  const energyPct =
    profile && profile.maxEnergy > 0 ? Math.min(100, (profile.energy / profile.maxEnergy) * 100) : 0;

  return {
    profile,
    loading,
    error,
    tapping,
    floats,
    energyPct,
    refresh,
    tap,
    claimDaily,
    purchaseUpgrade,
    upgradingId,
    upgradeFlash,
    setError,
  };
}
