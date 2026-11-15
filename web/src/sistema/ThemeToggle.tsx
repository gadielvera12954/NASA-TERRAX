import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({
  language = "en",
}: {
  language?: "en" | "es";
}) {
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme !== "light",
  );

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (
        event.storageArea !== window.localStorage ||
        (event.key !== "terra-theme" && event.key !== null)
      )
        return;
      const isDark = event.newValue !== "light";
      document.documentElement.dataset.theme = isDark ? "dark" : "light";
      setDark(isDark);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const label =
    language === "es"
      ? dark
        ? "Activar modo claro"
        : "Activar modo oscuro"
      : dark
        ? "Switch to light mode"
        : "Switch to dark mode";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        setDark(next === "dark");
        try {
          localStorage.setItem("terra-theme", next);
        } catch {
          // The selected appearance still works when browser storage is unavailable.
        }
      }}
    >
      {dark ? (
        <Sun size={19} aria-hidden="true" />
      ) : (
        <Moon size={19} aria-hidden="true" />
      )}
    </button>
  );
}
