'use client';
import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";

const navigation = [
  { label: "Home", href: "/#home" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Team", href: "/team" },
  { label: "Contact", href: "/contact" },
  { label: "Scribe", href: "/scribe" },
];

export function MobileMenu() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-16 w-16" />
    );
  }

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 md:hidden">
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-30"
              onClick={() => setIsOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Menu Items */}
            <motion.div
              className="relative z-40 flex flex-col gap-3 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {/* Theme Toggle */}
              <motion.div
                className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <span className="text-xs uppercase tracking-[0.2em] text-brand-tertiary">Theme</span>
                <button
                  aria-label="Toggle Dark Mode"
                  type="button"
                  className="group relative inline-flex h-8 w-14 items-center rounded-full bg-[color:var(--surface-card-strong)] transition-all hover:bg-[color:var(--surface-card-hover)] shadow-sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <span
                    className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-[color:var(--surface-base)] shadow-md transition-all duration-300 ${
                      theme === "dark" ? "translate-x-7" : "translate-x-1"
                    }`}
                  >
                    {theme === "dark" ? (
                      <Moon className="h-3 w-3 text-[color:var(--button-primary-bg)]" />
                    ) : (
                      <Sun className="h-3 w-3 text-amber-500" />
                    )}
                  </span>
                </button>
              </motion.div>

              {/* Navigation Items */}
              <nav className="flex flex-col gap-2">
                {navigation.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + index * 0.04 }}
                  >
                    <Link
                      href={item.href}
                      onClick={handleNavClick}
                      className="block rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[var(--surface-card-hover)] hover:text-[color:var(--text-primary)]"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* CTA Button */}
              <motion.div
                className="pt-3 border-t border-[var(--border-subtle)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Link
                  href="/#contact"
                  onClick={handleNavClick}
                  className="block rounded-full border border-[color:var(--border-subtle)] bg-gradient-to-r from-[color:var(--surface-card)] to-[color:var(--surface-card)] px-4 py-3 text-center text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card-hover)]"
                >
                  Show Interest
                </Link>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Menu Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:border-[var(--border-strong)] dark:shadow-[0_8px_30px_rgba(15,23,42,0.45)]"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={isOpen ? { backgroundColor: "rgba(99, 102, 241, 0.15)" } : { backgroundColor: "transparent" }}
          transition={{ duration: 0.3 }}
        />
        <motion.div
          className="relative z-10 flex items-center justify-center"
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
              >
                <X className="h-5 w-5 text-[color:var(--text-primary)]" />
              </motion.div>
            ) : (
              <motion.div
                key="menu"
                initial={{ opacity: 0, rotate: 90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: -90 }}
                transition={{ duration: 0.2 }}
              >
                <Menu className="h-5 w-5 text-[color:var(--text-primary)]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.button>
    </div>
  );
}
