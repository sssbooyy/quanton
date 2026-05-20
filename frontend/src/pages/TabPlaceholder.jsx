export default function TabPlaceholder({ title, subtitle }) {
  return (
    <main className="tabPlaceholder">
      <div className="tabPlaceholder__card">
        <p className="tabPlaceholder__kicker mono">QUANTON</p>
        <h1 className="tabPlaceholder__title">{title}</h1>
        <p className="tabPlaceholder__sub">{subtitle || "Coming soon in a future update."}</p>
      </div>
    </main>
  );
}
