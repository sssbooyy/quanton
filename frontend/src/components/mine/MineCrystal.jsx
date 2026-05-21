import { motion, AnimatePresence } from "framer-motion";
import { mineIcons } from "../../lib/mineIcons.js";

export default function MineCrystal({ profile, tapping, floats, onTap }) {
  const energy = profile?.energy ?? 0;
  const disabled = energy <= 0;

  return (
    <div className="mineCrystalWrap">
      <motion.div
        className="mineCrystalShards"
        key={profile?.shards}
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
      >
        <span className="mineCrystalShards__label">SHARDS</span>
        <span className="mineCrystalShards__val mono">{(profile?.shards ?? 0).toLocaleString()}</span>
      </motion.div>

      <div className="mineCrystalAura" aria-hidden="true" />
      <div className="mineCrystalRings" aria-hidden="true" />

      <motion.button
        type="button"
        className={`mineCrystal ${tapping ? "mineCrystal--active" : ""} ${disabled ? "mineCrystal--empty" : ""}`}
        disabled={disabled}
        whileTap={{ scale: 0.92 }}
        animate={
          tapping
            ? { filter: "drop-shadow(0 0 32px rgba(168, 85, 247, 0.9))" }
            : { filter: "drop-shadow(0 0 20px rgba(139, 92, 246, 0.55))" }
        }
        onPointerDown={(e) => {
          e.preventDefault();
          onTap(1);
        }}
        style={{ touchAction: "manipulation" }}
        aria-label="Tap to mine shards"
      >
        <span className="mineCrystal__gem" aria-hidden="true">
          <motion.img
            src={mineIcons.mineTap}
            alt=""
            className="mineCrystal__gemImg"
            draggable={false}
            loading="eager"
            animate={
              tapping
                ? { scale: [1, 1.06, 1], rotate: [0, -2, 2, 0] }
                : { scale: [1, 1.02, 1] }
            }
            transition={
              tapping
                ? { duration: 0.35 }
                : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
            }
          />
        </span>
        <span className="mineCrystal__cta">TAP TO MINE</span>
        <span className="mineCrystal__hint mono">
          {disabled
            ? "Recharging energy…"
            : `+${profile?.shardsPerTap ?? 1} / tap · ×${profile?.maxTapBatch ?? 5}`}
        </span>
      </motion.button>

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
