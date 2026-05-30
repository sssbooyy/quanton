import { getTelegramUser, getTelegramUserIdForMining } from "../../lib/telegramUser.js";
import { sapphireDisplay, sapphireNumber } from "../../lib/sapphireFormat.js";

function resolveUsername() {
  const tg = getTelegramUser();
  if (tg?.username) return `@${tg.username}`;
  if (tg?.first_name) return tg.first_name;
  return null;
}

export default function ProfileOverview({ profile, referral }) {
  const username = resolveUsername();
  const telegramId = getTelegramUserIdForMining();

  return (
    <section className="sapphire-profile sapphire-glass" aria-label="Profile overview">
      <h2 className="sapphire-sectionTitle">Profile</h2>

      <div className="sapphire-profile__header">
        <h3 className="sapphire-profile__name">{sapphireDisplay(username)}</h3>
        <p className="sapphire-profile__id sapphire-mono">Telegram ID: {sapphireDisplay(telegramId)}</p>
      </div>

      <div className="sapphire-profile__grid">
        <div className="sapphire-profile__stat">
          <span className="sapphire-profile__statVal sapphire-mono">{sapphireNumber(profile?.level)}</span>
          <span className="sapphire-profile__statLabel">Level</span>
        </div>
        <div className="sapphire-profile__stat">
          <span className="sapphire-profile__statVal sapphire-mono">{sapphireNumber(profile?.shards)}</span>
          <span className="sapphire-profile__statLabel">Total Shards</span>
        </div>
        <div className="sapphire-profile__stat">
          <span className="sapphire-profile__statVal sapphire-mono">{sapphireNumber(profile?.totalTaps)}</span>
          <span className="sapphire-profile__statLabel">Total Taps</span>
        </div>
        <div className="sapphire-profile__stat">
          <span className="sapphire-profile__statVal sapphire-mono">{sapphireNumber(referral?.referralCount)}</span>
          <span className="sapphire-profile__statLabel">Referrals</span>
        </div>
        <div className="sapphire-profile__stat" style={{ gridColumn: "1 / -1" }}>
          <span className="sapphire-profile__statVal sapphire-mono">{sapphireNumber(referral?.referralRewardsEarned)}</span>
          <span className="sapphire-profile__statLabel">Referral Earnings</span>
        </div>
      </div>
    </section>
  );
}
