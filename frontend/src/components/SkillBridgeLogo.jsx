import "./SkillBridgeLogo.css";

export function SkillBridgeLogo({ className = "", size = "medium", theme = "dark" }) {
  const classes = ["sb-logo", `sb-logo--${size}`, `sb-logo--${theme}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <span className="sb-logo-mark">
        <svg aria-hidden="true" viewBox="0 0 48 48" fill="none">
          <path d="M4.5 17.5 24 7l19.5 10.5L24 28 4.5 17.5Z" />
          <path d="M12 22v8.5c6.4 6.6 17.6 6.6 24 0V22M43.5 18v12" />
          <circle cx="43.5" cy="32.5" r="1.5" />
        </svg>
      </span>
      <span className="sb-logo-word">SkillBridge</span>
    </span>
  );
}
