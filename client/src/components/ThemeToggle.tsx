import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { getStoredUser, saveUser } from "../utils/auth";
import { updateUser } from "../services/userService";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getStoredUser()?.theme ?? "dark");

  useEffect(() => {
    const onAuthChange = () => {
      const storedTheme = getStoredUser()?.theme;
      if (storedTheme) setTheme(storedTheme);
    };

    window.addEventListener("aethrix-auth-change", onAuthChange);
    return () => window.removeEventListener("aethrix-auth-change", onAuthChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const user = getStoredUser();
    if (!user?.email || user.theme === theme) return;

    saveUser({ ...user, theme });
    void updateUser(user.email, { theme }).catch((error) => {
      console.error("Failed to save theme preference:", error);
    });
  }, [theme]);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      {isLight ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
