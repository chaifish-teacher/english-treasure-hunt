import { Icon } from "./Art.jsx";

export function Bilingual({ en, zh, className = "" }) {
  return (
    <span className={`bilingual ${className}`}>
      <span lang="en">{en}</span>
      <span lang="zh-Hant">{zh}</span>
    </span>
  );
}
export function ActionButton({
  en,
  zh,
  onClick,
  disabled,
  type = "button",
  secondary = false,
  icon = "arrow",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`action-button ${secondary ? "secondary" : ""}`}
    >
      <Bilingual en={en} zh={zh} />
      <Icon name={icon} />
    </button>
  );
}
