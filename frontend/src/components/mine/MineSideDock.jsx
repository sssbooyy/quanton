import { motion } from "framer-motion";

export default function MineSideDock({ side, actions }) {
  return (
    <div className={`mineSideDock mineSideDock--${side}`}>
      {actions.map((action) => (
        <motion.button
          key={action.id}
          type="button"
          className={`mineSideBtn ${action.highlight ? "mineSideBtn--highlight" : ""} ${action.disabled ? "mineSideBtn--disabled" : ""}`}
          disabled={action.disabled}
          whileTap={{ scale: 0.92 }}
          onClick={action.onClick}
          title={action.label}
        >
          <span className="mineSideBtn__label">{action.label}</span>
          {action.badge ? <span className="mineSideBtn__badge">{action.badge}</span> : null}
        </motion.button>
      ))}
    </div>
  );
}
