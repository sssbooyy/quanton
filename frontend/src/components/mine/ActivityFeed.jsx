const EVENT_TYPE_LABELS = [
  "Upgrade Purchased",
  "Level Up",
  "Referral Reward",
  "Energy Refilled",
];

export default function ActivityFeed() {
  return (
    <section className="sapphire-activity sapphire-glass" aria-label="Activity feed">
      <h2 className="sapphire-sectionTitle">Activity Feed</h2>

      <div className="sapphire-activity__types" aria-hidden="true">
        {EVENT_TYPE_LABELS.map((label) => (
          <span key={label} className="sapphire-activity__type">
            {label}
          </span>
        ))}
      </div>

      <ul className="sapphire-activity__list">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="sapphire-activity__row" aria-hidden="true" />
        ))}
      </ul>
    </section>
  );
}
