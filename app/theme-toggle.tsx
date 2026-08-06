"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const storageKey = "agent-theme";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
  }

  const nextThemeLabel = theme === "dark" ? "jasny" : "ciemny";

  return (
    <button
      aria-label={`Włącz ${nextThemeLabel} motyw`}
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`}
      onClick={toggleTheme}
      title={`Włącz ${nextThemeLabel} motyw`}
      type="button"
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      {compact ? null : <small>{theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}</small>}
    </button>
  );
}
