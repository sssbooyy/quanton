import { motion } from "framer-motion";

export default function MineIcon({
  src,
  alt = "",
  size = 40,
  className = "",
  glow = "purple",
  pulse = false,
  active = false,
  lazy = true,
}) {
  if (!src) return null;

  const glowClass = glow ? `mineIcon--glow-${glow}` : "";

  return (
    <motion.span
      className={`mineIcon ${glowClass} ${pulse ? "mineIcon--pulse" : ""} ${active ? "mineIcon--active" : ""} ${className}`.trim()}
      style={{ "--mine-icon-size": `${size}px` }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      aria-hidden={alt ? undefined : true}
    >
      <img
        src={src}
        alt={alt}
        className="mineIcon__img"
        width={size}
        height={size}
        loading={lazy ? "lazy" : "eager"}
        decoding="async"
        draggable={false}
      />
    </motion.span>
  );
}
