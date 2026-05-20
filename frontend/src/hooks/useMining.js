import { useCallback, useEffect, useRef, useState } from "react";
import { getMineProfile, postMineDaily, postMineTap } from "../api.js";
import { formatMiningApiError } from "../lib/miningApiError.js";
import { getTelegramUserIdForMining, hapticNotification, miningAuthBody, miningAuthHeaders } from "../lib/telegramUser.js";

const PROFILE_POLL_MS = 8000;

export function useMining() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tapping, setTapping] = useState(false);
  const [floats, setFloats] = useState([]);
  const tapLock = useRef(false);

  const refresh = useCallback(async () => {
    const headers = miningAuthHeaders();
    try {
      setError("");
      const data = await getMineProfile(headers);
      setProfile(data.profile);
      console.log("[mining] profile loaded", {
        telegramId: getTelegramUserIdForMining(),
        shards: data.profile?.shards,
        energy: data.profile?.energy,
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
    refresh();
    const id = window.setInterval(refresh, PROFILE_POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

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
    setError,
  };
}
