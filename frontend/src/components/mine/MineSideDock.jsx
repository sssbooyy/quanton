import { motion } from "framer-motion";
import MineIcon from "./MineIcon.jsx";
import { sideDockIcon } from "../../lib/mineIcons.js";

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
          <span className="mineSideBtn__icon" aria-hidden="true">
            <MineIcon
              src={sideDockIcon(action.id)}
              size={36}
              glow="purple"
              pulse={action.highlight}
              active={!action.disabled && action.highlight}
            />
          </span>
          <span className="mineSideBtn__label">{action.label}</span>
          {action.badge ? <span className="mineSideBtn__badge">{action.badge}</span> : null}
        </motion.button>
      ))}
    </div>
  );
}
