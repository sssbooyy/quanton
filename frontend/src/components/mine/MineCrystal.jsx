import { motion, AnimatePresence } from "framer-motion";

export default function MineCrystal({ profile, tapping, floats, onTap }) {
  const energy = profile?.energy ?? 0;
  const disabled = energy <= 0;

  return (
    <div className="mineCrystalWrap">
      <motion.div
        className="mineCrystalShards"
        key={profile?.shards}
        initial={{ scale: 1.02 }}
        animate={{ scale: 1 }}
      >
        <span className="mineCrystalShards__label">SHARDS</span>
        <span className="mineCrystalShards__val mono">{(profile?.shards ?? 0).toLocaleString()}</span>
      </motion.div>

      <motion.button
        type="button"
        className={`mineMineBtn ${tapping ? "mineMineBtn--active" : ""} ${disabled ? "mineMineBtn--empty" : ""}`}
        disabled={disabled}
        whileTap={{ scale: 0.97 }}
        onPointerDown={(e) => {
          e.preventDefault();
          onTap(1);
        }}
        style={{ touchAction: "manipulation" }}
        aria-label="Mine shards"
      >
        Mine Shards
      </motion.button>

      <p className="mineMineBtn__hint mono">
        {disabled
          ? "Recharging energy…"
          : `+${profile?.shardsPerTap ?? 1} / tap · ×${profile?.maxTapBatch ?? 5}`}
      </p>

      <AnimatePresence>
        {floats.map((f, i) => (
          <motion.span
            key={f.id}
            className={`mineCrystalFloat mono ${f.amount < 0 ? "mineCrystalFloat--cost" : ""}`}
            initial={{ opacity: 0, y: 8, scale: 0.5 }}
            animate={{ opacity: 1, y: -64 - i * 10, scale: 1 }}
            exit={{ opacity: 0, y: -90 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {f.amount > 0 ? `+${f.amount}` : f.amount}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}
