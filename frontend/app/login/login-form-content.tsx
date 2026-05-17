"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Nav } from "@/components/nav";
import { getApiClient } from "@/lib/api-client-unified";
import { useToast } from "@/components/toast";

export default function LoginFormContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  
  // Get the redirect URL from query params (e.g., ?from=/scribe)
  const [redirectFrom, setRedirectFrom] = useState<string | null>(null);
  
  useEffect(() => {
    const from = searchParams.get('from');
    if (from) {
      setRedirectFrom(decodeURIComponent(from));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const client = getApiClient();
      const result = await client.auth.login(email, password);
      
      // Store access token in localStorage
      localStorage.setItem('accessToken', result.accessToken);
      
      // Store user data with organization_id (already normalized by API client)
      const userData = {
        id: result.user.id,
        email: result.user.email,
        first_name: result.user.first_name || "User",
        last_name: result.user.last_name || "Unknown",
        role: result.user.role || "Healthcare Provider",
        organization_id: result.user.organization_id,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Also store in cookie for middleware validation
      document.cookie = `accessToken=${result.accessToken}; path=/; max-age=86400`;
      
      // Log for debugging organization-based access control
      addToast({
        type: "success",
        title: "Login Successful",
        message: `Welcome back, ${result.user.email}!`,
        duration: 3000,
      });
      
      // Add a small delay to ensure token is set before redirecting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to the requested page or home
      const redirectUrl = redirectFrom || '/scribe';
      router.push(redirectUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      addToast({
        type: "error",
        title: "Login Failed",
        message: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.35),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(63,63,70,0.25),transparent_60%)]">
      <Nav />

      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-20 sm:py-24">
        <motion.div
          className="relative grid gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1,
              },
            },
          }}
        >
          {/* Left side - Welcome content */}
          <motion.div
            className="space-y-6"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.08,
                  delayChildren: 0.1,
                },
              },
            }}
          >
            <motion.p
              className="text-sm uppercase tracking-[0.3em] text-[color:var(--text-secondary)]"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.6,
                  },
                },
              }}
            >
              Secure Access Portal
            </motion.p>
            <motion.h1
              className="text-4xl font-semibold leading-tight text-[color:var(--text-primary)] sm:text-5xl"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.6,
                  },
                },
              }}
              transition={{ delay: 0.1 }}
            >
              Welcome back to Medclara
            </motion.h1>
            <motion.p
              className="max-w-xl text-lg text-[color:var(--text-secondary)]"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.6,
                  },
                },
              }}
              transition={{ delay: 0.2 }}
            >
              Access your multilingual clinical documentation platform and continue transforming patient conversations into accurate reports.
            </motion.p>
            <motion.div
              className="flex flex-wrap items-center gap-4"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    duration: 0.6,
                  },
                },
              }}
              transition={{ delay: 0.3 }}
            >
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] px-6 py-3 text-sm font-semibold !text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-base)]"
              >
                ← Back to Home
              </Link>
              <motion.span
                className="text-sm text-[color:var(--text-tertiary)]"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 6, repeat: Infinity }}
              >
                HIPAA-compliant secure login
              </motion.span>
            </motion.div>
          </motion.div>

          {/* Right side - Login form */}
          <motion.div
            className="relative isolate flex h-full items-center justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <motion.div
              className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-white/80 via-white/40 to-transparent blur-3xl dark:from-white/10 dark:via-white/5"
              animate={{ rotate: [0, 1.5, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-8 shadow-2xl"
              whileHover={{ y: -6, boxShadow: "0 25px 60px rgba(15, 23, 42, 0.45)" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="text-center mb-8">
                <motion.h2
                  className="text-2xl font-semibold text-[color:var(--text-primary)] mb-2"
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: 0.6,
                      },
                    },
                  }}
                >
                  Sign in to your account
                </motion.h2>
                <motion.p
                  className="text-[color:var(--text-secondary)]"
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: 0.6,
                      },
                    },
                  }}
                  transition={{ delay: 0.1 }}
                >
                  Access your clinical documentation tools
                </motion.p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm text-[color:var(--text-secondary)]" htmlFor="email">
                    <span className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-tertiary)]">Email address</span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] px-4 py-3 text-sm text-[color:var(--text-primary)] shadow-sm transition focus:border-sky-400/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-100"
                      placeholder="Enter your email"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-[color:var(--text-secondary)]" htmlFor="password">
                    <span className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-tertiary)]">Password</span>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-base)] px-4 py-3 text-sm text-[color:var(--text-primary)] shadow-sm transition focus:border-sky-400/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-100"
                      placeholder="Enter your password"
                    />
                  </label>
                </div>


                <div className="flex justify-center">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] !text-[color:var(--text-primary)] hover:bg-[color:var(--surface-base)]"
                  >
                    {isLoading ? "Signing in…" : "Sign in"}
                  </button>
                </div>
              </form>

              <motion.div
                className="mt-6 text-center"
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.6,
                    },
                  },
                }}
                transition={{ delay: 0.4 }}
              >
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
