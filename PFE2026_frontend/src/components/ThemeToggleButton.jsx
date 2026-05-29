import { useTheme } from "../theme/ThemeProvider.jsx";

export default function ThemeToggleButton({
  compact = false,
  className = "",
  style,
}) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "dark" ? "Mode clair" : "Mode sombre";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`themeToggle ${compact ? "compact" : ""} ${className}`.trim()}
      style={style}
      aria-label={nextLabel}
      title={nextLabel}
    >
      <span className={`themeSwitch ${theme === "light" ? "light" : ""}`}>
        <span className="themeSwitchThumb" />
      </span>
      <span>{theme === "dark" ? "Sombre" : "Clair"}</span>
    </button>
  );
}
