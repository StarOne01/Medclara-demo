"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  FileText,
  Settings,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "@/lib/sidebar-context";
import { useAuth } from "@/lib/hooks/useAuth";

const navigation = [
  { label: "Scribe", href: "/scribe", icon: FileText },
  { label: "Sessions", href: "/sessions", icon: Clock },
  { label: "Patients", href: "/patients", icon: User },
  { label: "Organization", href: "/org-details", icon: Building2 },
  { label: "Home", href: "/", icon: Home },
];

export function SideNav() {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { user, logout, organizationId } = useAuth();

  const doctorName = user ? `${user.first_name} ${user.last_name}` : "Undefined User";
  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase()
    : "UU";

  return (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{
        x: 0,
        opacity: 1,
        width: isCollapsed ? 80 : 256,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[color:var(--border-subtle)] bg-gradient-to-b from-[color:var(--surface-card)] via-[color:var(--surface-base)] to-[color:var(--surface-base)] backdrop-blur"
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] shadow-sm transition hover:bg-[color:var(--surface-card-hover)] hover:border-[color:var(--border-strong)]"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 text-[color:var(--text-secondary)]" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-[color:var(--text-secondary)]" />
        )}
      </button>

      {/* Doctor Profile - Top */}
      <div className="border-b border-[color:var(--border-subtle)] bg-gradient-to-b from-[color:var(--surface-card)] to-[color:var(--surface-base)] px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-gradient-to-br from-[color:var(--surface-card-strong)] to-[color:var(--surface-card)] px-4 py-3 transition hover:border-[color:var(--border-strong)]">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--button-primary-bg)]">
            <span className="text-xs font-bold text-[color:var(--button-primary-text)]">{initials}</span>
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-xs font-semibold text-[color:var(--text-primary)]">
                  {doctorName}
                </p>
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  {user?.role || "Healthcare Provider"}
                </p>
                {organizationId && (
                  <p className="text-xs text-[color:var(--text-quaternary)] truncate">
                    Org: {organizationId.substring(0, 8)}...
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Medclara Logo - Below Doctor */}
      <div className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] bg-gradient-to-b from-[color:var(--surface-card)] to-[color:var(--surface-base)] px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--button-primary-bg)]">
          <span className="text-sm font-bold text-[color:var(--button-primary-text)]">M</span>
        </div>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <h1 className="text-lg font-semibold tracking-tight text-[color:var(--text-primary)]">
                Medclara
              </h1>
              <p className="text-xs text-[color:var(--text-tertiary)]">Clinical Scribe</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${isActive
                    ? "bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] shadow-sm"
                    : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-card-hover)]"
                  }`}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="space-y-3 border-t border-[color:var(--border-subtle)] bg-gradient-to-t from-[color:var(--surface-base)] to-transparent px-3 py-4">
        <div className={`flex items-center justify-between ${isCollapsed ? "pb-2" : "px-4"}`}>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-medium uppercase tracking-[0.2em] text-[color:var(--text-tertiary)] overflow-hidden whitespace-nowrap"
              >
                Theme
              </motion.span>
            )}
          </AnimatePresence>
          <div className={`transition-transform duration-300 mt-2 ${isCollapsed ? "rotate-[90deg]" : "mb-2 ml-4"}`}>
            <ThemeToggle />
          </div>
        </div>

        <button
          className={`flex w-full items-center gap-3 rounded-xl py-3 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-card-hover)] hover:text-[color:var(--text-primary)] ${
            isCollapsed ? "px-3 justify-center" : "px-4"
          }`}
          onClick={logout}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" aria-hidden />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
