import { hapticImpact } from "../lib/telegramUser.js";

const TABS = [
  { id: "market", label: "Market", icon: "market" },
  { id: "mine", label: "Mine", icon: "mine" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "profile", label: "Profile", icon: "profile" },
];

function NavIcon({ type }) {
  if (type === "mine") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L6 21l2.3-7-6-4.6h7.6L12 2z" fill="currentColor" opacity="0.9" />
      </svg>
    );
  }
  if (type === "activity") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 14v4M10 10v8M16 6v12M22 2v20" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "profile") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
    </svg>
  );
}

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottomNav" role="tablist" aria-label="Main navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? "bottomNav__item bottomNav__item--active" : "bottomNav__item"}
          onClick={() => {
            hapticImpact("light");
            onChange(tab.id);
          }}
        >
          <span className="bottomNav__icon">
            <NavIcon type={tab.icon} />
          </span>
          <span className="bottomNav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
