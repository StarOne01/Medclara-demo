'use client';
import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
    const [mounted, setMounted] = React.useState(false);
    const { theme, setTheme } = useTheme();

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="h-9 w-9" />
        );
    }

    return (
        <button
            aria-label="Toggle Dark Mode"
            type="button"
            className="group relative inline-flex h-9 w-16 items-center rounded-full bg-[color:var(--surface-card-strong)] transition-all hover:bg-[color:var(--surface-card-hover)] shadow-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
            <span
                className={`inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-[color:var(--surface-base)] shadow-md transition-all duration-300 ${
                    theme === "dark" ? "translate-x-8" : "translate-x-1"
                }`}
            >
                {theme === "dark" ? (
                    <Moon className="h-4 w-4 text-[color:var(--button-primary-bg)]" />
                ) : (
                    <Sun className="h-4 w-4 text-amber-500" />
                )}
            </span>
        </button>
    );
}
