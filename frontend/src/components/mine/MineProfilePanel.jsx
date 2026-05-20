import { motion } from "framer-motion";
import { getTelegramUser } from "../../lib/telegramUser.js";
import { hapticImpact, hapticNotification } from "../../lib/telegramUser.js";

function displayUsername() {
  const tg = getTelegramUser();
  if (tg?.username) return `@${tg.username}`;
  if (tg?.first_name) return tg.first_name;
  return "Quanton Miner";
}

export default function MineProfilePanel({ profile, referral, loading, onCopy }) {
  if (loading && !referral && !profile) {
    return (
      <section className="mineProfile mineProfile--loading" aria-busy="true">
        <div className="mineSkeleton mineSkeleton--hero" />
        <div className="mineSkeleton mineSkeleton--card" />
      </section>
    );
  }

  const upgradeLevels = (profile?.upgrades || []).reduce((s, u) => s + (u.level ?? 0), 0);
  const disabled = referral?.rewardsDisabled;

  async function handleCopy() {
    hapticImpact("light");
    try {
      await navigator.clipboard.writeText(referral?.referralLink || "");
      hapticNotification("success");
      onCopy?.();
    } catch {
      hapticNotification("error");
    }
  }

  function handleShare() {
    hapticImpact("medium");
    const url = referral?.shareUrl || referral?.referralLink;
    try {
      window.Telegram?.WebApp?.openTelegramLink?.(url);
    } catch {
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <motion.section
      className="mineProfile"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mineProfileHero glass">
        <div
          className="mineProfileBadge"
          style={{ "--level-color": profile?.levelColor || "#a855f7" }}
        >
          <span className="mineProfileBadge__lvl mono">Lv {profile?.level ?? 1}</span>
          <span className="mineProfileBadge__rank">{profile?.levelTitle || "Miner"}</span>
        </div>
        <div className="mineProfileHero__meta">
          <h2 className="mineProfileHero__name">{displayUsername()}</h2>
          <p className="mineProfileHero__sub mono">Quanton Mining Profile</p>
        </div>
      </div>

      <div className="mineProfileGrid">
        <div className="mineProfileStat glass">
          <span className="mineProfileStat__val mono">{(profile?.shards ?? 0).toLocaleString()}</span>
          <span className="mineProfileStat__label">Total shards</span>
        </div>
        <div className="mineProfileStat glass">
          <span className="mineProfileStat__val mono">{(profile?.totalTaps ?? 0).toLocaleString()}</span>
          <span className="mineProfileStat__label">Total taps</span>
        </div>
        <div className="mineProfileStat glass">
          <span className="mineProfileStat__val mono">{upgradeLevels}</span>
          <span className="mineProfileStat__label">Upgrade levels</span>
        </div>
        <div className="mineProfileStat glass">
          <span className="mineProfileStat__val mono">{referral?.referralCount ?? 0}</span>
          <span className="mineProfileStat__label">Friends invited</span>
        </div>
      </div>

      <div className="mineProfileInvite glass">
        <p className="mineProfileInvite__kicker mono">REFERRAL</p>
        <h3>Invite Friends</h3>
        <p className="mineProfileInvite__sub">
          Earn +{referral?.inviterReward?.shards ?? 500} shards per friend. They get a starter bonus too.
        </p>
        <p className="mineProfileInvite__earned mono">
          {(referral?.referralRewardsEarned ?? 0).toLocaleString()} shards earned from referrals
        </p>
        {referral?.referralCode ? (
          <p className="mineProfileInvite__code mono">
            Code <strong>{referral.referralCode}</strong>
          </p>
        ) : null}
        {disabled ? (
          <p className="mineProfileInvite__demo mono">Open in Telegram to enable invites.</p>
        ) : null}
        <div className="mineProfileInvite__actions">
          <button type="button" className="mineProfileBtn mineProfileBtn--ghost" onClick={handleCopy} disabled={disabled}>
            Copy link
          </button>
          <button type="button" className="mineProfileBtn mineProfileBtn--primary" onClick={handleShare} disabled={disabled}>
            Invite Friends
          </button>
        </div>
        {referral?.referralLink ? (
          <p className="mineProfileInvite__link mono" title={referral.referralLink}>
            {referral.referralLink}
          </p>
        ) : null}
      </div>
    </motion.section>
  );
}
