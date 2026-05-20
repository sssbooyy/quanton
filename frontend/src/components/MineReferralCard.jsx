import { motion } from "framer-motion";
import { hapticImpact, hapticNotification } from "../lib/telegramUser.js";

function RewardPill({ label, shards, xp }) {
  return (
    <div className="mineRefPill">
      <span className="mineRefPill__label">{label}</span>
      <span className="mineRefPill__val mono">+{shards} shards · +{xp} XP</span>
    </div>
  );
}

export default function MineReferralCard({ referral, loading, onCopy, onShare }) {
  if (loading && !referral) {
    return (
      <section className="mineRef mineRef--loading" aria-busy="true">
        <div className="mineSkeleton mineSkeleton--card" style={{ height: 180 }} />
      </section>
    );
  }

  if (!referral) return null;

  const disabled = referral.rewardsDisabled;

  async function handleCopy() {
    hapticImpact("light");
    try {
      await navigator.clipboard.writeText(referral.referralLink);
      hapticNotification("success");
      onCopy?.();
    } catch {
      hapticNotification("error");
    }
  }

  function handleShare() {
    hapticImpact("medium");
    const url = referral.shareUrl || referral.referralLink;
    try {
      window.Telegram?.WebApp?.openTelegramLink?.(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    onShare?.();
  }

  return (
    <motion.section
      className="mineRef"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      aria-label="Invite friends"
    >
      <div className="mineRef__glow" aria-hidden="true" />
      <header className="mineRef__head">
        <p className="mineRef__kicker mono">VIRAL REWARDS</p>
        <h2 className="mineRef__title">Invite Friends</h2>
        <p className="mineRef__sub">
          Share Quanton Mining. When a friend joins via your link, you both earn shard bonuses.
        </p>
      </header>

      <div className="mineRefStats">
        <div className="mineRefStat">
          <motion.span
            key={referral.referralCount}
            className="mineRefStat__val mono"
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
          >
            {referral.referralCount ?? 0}
          </motion.span>
          <span className="mineRefStat__label">Referrals</span>
        </div>
        <div className="mineRefStat">
          <motion.span
            key={referral.referralRewardsEarned}
            className="mineRefStat__val mono"
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
          >
            {(referral.referralRewardsEarned ?? 0).toLocaleString()}
          </motion.span>
          <span className="mineRefStat__label">Shards earned</span>
        </div>
      </div>

      <div className="mineRefRewards">
        <RewardPill
          label="You get"
          shards={referral.inviterReward?.shards ?? 500}
          xp={referral.inviterReward?.xp ?? 250}
        />
        <RewardPill
          label="Friend gets"
          shards={referral.inviteeReward?.shards ?? 250}
          xp={referral.inviteeReward?.xp ?? 100}
        />
      </div>

      <div className="mineRefCode mono">
        <span className="mineRefCode__label">Code</span>
        <strong>{referral.referralCode}</strong>
      </div>

      {disabled ? (
        <p className="mineRefDemo mono">Referral rewards are disabled in browser demo mode. Open in Telegram to invite friends.</p>
      ) : null}

      <div className="mineRefActions">
        <button type="button" className="mineRefBtn mineRefBtn--copy" onClick={handleCopy} disabled={disabled}>
          Copy link
        </button>
        <button type="button" className="mineRefBtn mineRefBtn--share" onClick={handleShare} disabled={disabled}>
          Share on Telegram
        </button>
      </div>

      <p className="mineRefLink mono" title={referral.referralLink}>
        {referral.referralLink}
      </p>
    </motion.section>
  );
}
