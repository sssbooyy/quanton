import { hapticImpact, hapticNotification } from "../../lib/telegramUser.js";
import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";

export default function ReferralCard({ referral, onCopy }) {
  const disabled = referral?.rewardsDisabled;
  const link = referral?.referralLink;

  async function handleCopy() {
    if (!link) return;
    hapticImpact("light");
    try {
      await navigator.clipboard.writeText(link);
      hapticNotification("success");
      onCopy?.();
    } catch {
      hapticNotification("error");
    }
  }

  return (
    <section className="sapphire-referral sapphire-glass sapphire-glow" aria-label="Referral program">
      <h2 className="sapphire-sectionTitle">Referral</h2>

      <div className="sapphire-referral__linkBox sapphire-mono" title={link || undefined}>
        {sapphireDisplay(link)}
      </div>

      <div className="sapphire-referral__actions">
        <button
          type="button"
          className="sapphire-referral__btn sapphire-referral__btn--primary"
          onClick={handleCopy}
          disabled={disabled || !link}
        >
          Copy Link
        </button>
      </div>

      <div className="sapphire-referral__stats">
        <div className="sapphire-referral__stat">
          <span className="sapphire-label">Referrals</span>
          <span className="sapphire-value sapphire-mono" style={{ fontSize: "1rem" }}>
            {sapphireNumber(referral?.referralCount)}
          </span>
        </div>
        <div className="sapphire-referral__stat">
          <span className="sapphire-label">Earnings</span>
          <span className="sapphire-value sapphire-mono" style={{ fontSize: "1rem" }}>
            {sapphireNumber(referral?.referralRewardsEarned)}
          </span>
        </div>
      </div>

      {referral?.referralCode ? (
        <p className="sapphire-referral__note sapphire-mono">
          Code: <strong>{referral.referralCode}</strong>
        </p>
      ) : null}

      {disabled ? (
        <p className="sapphire-referral__note sapphire-mono">Open in Telegram to enable referrals.</p>
      ) : null}
    </section>
  );
}
