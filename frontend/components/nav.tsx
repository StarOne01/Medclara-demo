'use client';
import Link from "next/link";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";

const navigation = [
  { label: "Home", href: "/#home" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Contact", href: "/contact" },
  { label: "Clara", href: "/scribe" },
];

export function Nav() {
    return (
              <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="sticky top-0 z-50 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center">
          <Link href="/#home" className="mr-4 flex items-center gap-2">
            <span className="sr-only">Medclara Logo</span>
            <img src="/favicon.ico" alt="Medclara Logo" className="h-10 w-10 rounded-full object-cover" />
          </Link>
          <motion.div whileHover={{ scale: 1.05 }}>
            <Link href="/#home" className="text-lg font-semibold tracking-wide text-[color:var(--text-primary)]">
              Medclara
            </Link>
          </motion.div>
          </div>
          <nav className="hidden gap-8 text-sm text-[color:var(--text-secondary)] md:flex">
            {navigation.map((item) => (
              <motion.a
                key={item.href}
                href={item.href}
                className="transition hover:text-[color:var(--text-primary)]"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.label}
              </motion.a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          <motion.a
            href="/#contact"
            className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-card)]"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
          >
            Show Interest
          </motion.a>
          </div> 
        </div>
      </motion.header>
    );
}