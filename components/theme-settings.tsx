"use client";
import { useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
type Theme = "light" | "dark" | "system";
const subscribe = (callback: () => void) => {
  window.addEventListener("cfh-theme", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("cfh-theme", callback);
    window.removeEventListener("storage", callback);
  };
};
const read = (): Theme => {
  try {
    const t = localStorage.getItem("cfh-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
};
export function ThemeSettings() {
  const theme = useSyncExternalStore(subscribe, read, () => "system");
  function change(value: Theme) {
    try {
      localStorage.setItem("cfh-theme", value);
    } catch {
      /* The selection still applies for this visit. */
    }
    document.documentElement.dataset.theme = value;
    window.dispatchEvent(new Event("cfh-theme"));
  }
  return (
    <fieldset className="theme-settings">
      <legend>Appearance</legend>
      <div>
        {(
          [
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
            ["system", "System", Monitor],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => change(value)}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
