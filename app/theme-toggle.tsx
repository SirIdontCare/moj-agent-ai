"use client";

import { useEffect, useState } from "react";
import Pictogram from "./pictogram";

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
      <Pictogram name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
