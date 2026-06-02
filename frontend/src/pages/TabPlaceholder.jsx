export default function TabPlaceholder({ title, subtitle, variant = "default" }) {
  const isActivity = variant === "activity";
  const isProfile = variant === "profile";
  return (
    <main className="tabPlaceholder">
      <div className="tabPlaceholder__card">
        <p className="tabPlaceholder__kicker mono">QUANTON</p>
        <h1 className="tabPlaceholder__title">{title}</h1>
        <p className="tabPlaceholder__sub">{subtitle || "Coming soon in a future update."}</p>
        {isActivity ? (
          <div className="tabPlaceholder__grid">
            <article className="tabPlaceholder__tile">
              <p className="tabPlaceholder__tileTitle">Listings</p>
              <p className="tabPlaceholder__tileSub">New gift listings and delists</p>
            </article>
            <article className="tabPlaceholder__tile">
              <p className="tabPlaceholder__tileTitle">Sales</p>
              <p className="tabPlaceholder__tileSub">Completed purchases and fills</p>
            </article>
            <article className="tabPlaceholder__tile">
              <p className="tabPlaceholder__tileTitle">Price changes</p>
              <p className="tabPlaceholder__tileSub">Floor and listing reprices</p>
            </article>
          </div>
        ) : null}
        {isProfile ? (
          <div className="tabPlaceholder__grid">
            <article className="tabPlaceholder__tile tabPlaceholder__tile--profile">
              <p className="tabPlaceholder__tileTitle">Wallet / Telegram</p>
              <p className="tabPlaceholder__tileSub">Identity card and trust score</p>
            </article>
            <article className="tabPlaceholder__tile">
              <p className="tabPlaceholder__tileTitle">Seller stats</p>
              <p className="tabPlaceholder__tileSub">Volume, listings, fill rate</p>
            </article>
            <article className="tabPlaceholder__tile">
              <p className="tabPlaceholder__tileTitle">Purchase history</p>
              <p className="tabPlaceholder__tileSub">Recent buys and statuses</p>
            </article>
            <article className="tabPlaceholder__tile">
              <p className="tabPlaceholder__tileTitle">Listings</p>
              <p className="tabPlaceholder__tileSub">Active and sold gifts</p>
            </article>
          </div>
        ) : null}
      </div>
    </main>
  );
}
