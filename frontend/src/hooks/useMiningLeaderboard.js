import { useCallback, useEffect, useState } from "react";
import { getMineLeaderboard } from "../api.js";
import { formatMiningApiError } from "../lib/miningApiError.js";
import { miningAuthHeaders } from "../lib/telegramUser.js";

const LEADERBOARD_TYPES = ["shards", "level", "taps", "referrals"];

export function useMiningLeaderboard(enabled = false) {
  const [type, setType] = useState("shards");
  const [entries, setEntries] = useState([]);
  const [viewerEntry, setViewerEntry] = useState(null);
  const [viewerRank, setViewerRank] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextType = type) => {
    setLoading(true);
    try {
      setError("");
      const data = await getMineLeaderboard(nextType, miningAuthHeaders());
      setEntries(data.entries || []);
      setViewerEntry(data.viewerEntry || null);
      setViewerRank(data.viewerRank ?? null);
      return data;
    } catch (e) {
      setError(formatMiningApiError(e, "/mine/leaderboard"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (!enabled) return undefined;
    load(type);
    return undefined;
  }, [enabled, type, load]);

  const setLeaderboardType = useCallback((next) => {
    if (LEADERBOARD_TYPES.includes(next)) setType(next);
  }, []);

  return {
    type,
    setLeaderboardType,
    entries,
    viewerEntry,
    viewerRank,
    loading,
    error,
    refresh: () => load(type),
    types: LEADERBOARD_TYPES,
  };
}

export function leaderboardStatLabel(type) {
  switch (type) {
    case "level":
      return "Level";
    case "taps":
      return "Taps";
    case "referrals":
      return "Referrals";
    default:
      return "Shards";
  }
}

export function formatLeaderboardStat(entry, type) {
  if (!entry) return "0";
  switch (type) {
    case "level":
      return entry.level ?? 1;
    case "taps":
      return (entry.totalTaps ?? 0).toLocaleString();
    case "referrals":
      return entry.referralCount ?? 0;
    default:
      return (entry.shards ?? 0).toLocaleString();
  }
}
