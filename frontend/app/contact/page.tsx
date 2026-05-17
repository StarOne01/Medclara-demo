'use client';

import { motion, Variants } from "framer-motion";
import React from "react";
import { Nav } from "@/components/nav";
import { MobileMenu } from "@/components/mobile-menu";
import { useState } from "react";

const contactChannels = [
  {
    title: "Email",
    description: "Send us your inquiries anytime",
    contact: "contact@medclara.in",
    href: "mailto:contact@medclara.in",
    icon: EmailIcon,
  },
  {
    title: "LinkedIn",
    description: "Follow our latest updates and insights",
    contact: "@medclara",
    href: "https://www.linkedin.com/company/medclara/",
    icon: LinkedInIcon,
  },
  {
    title: "Support",
    description: "Technical support and documentation",
    contact: "support@medclara.in",
    href: "mailto:support@medclara.in",
    icon: SupportIcon,
  },
];

const faqItems = [
  {
    question: "What languages does Medclara support?",
    answer:
      "Medclara supports multilingual transcription and reporting with special focus on Indian languages including Tamil, Malayalam, Telugu, Kannada, Hindi, and Bengali, as well as English and 100+ other languages globally.",
  },
  {
    question: "How does Medclara handle patient privacy?",
    answer:
      "All patient data is encrypted at rest and in transit using industry-standard protocols. We implement row-level security in our PostgreSQL database and maintain strict access controls with comprehensive audit trails.",
  },
  {
    question: "How accurate is the medical AI?",
    answer:
      "Our AI is trained on clinical datasets and validated by medical professionals. We maintain high accuracy in key medical entity extraction and continuously improve through feedback from clinical teams.",
  },
  {
    question: "What is the pricing model?",
    answer:
      "Medclara offers flexible pricing based on usage volume and team size. We provide custom quotes for enterprise deployments and specialized pricing for pilot programs. Contact our sales team for details.",
  },
];

const easeOutExpo: [number, number, number, number] = [0.12, 0.12, 0.1, 0.1];

export default function ContactPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--border-subtle),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(63,63,70,0.25),transparent_60%)]" />
            <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-12 sm:px-6 sm:py-20 lg:py-24">
        {/* Hero Section */}
        <AnimatedSection className="space-y-6">
          <motion.p className="text-sm uppercase tracking-[0.3em] text-brand-secondary" variants={fadeUp}>
            Get in Touch
          </motion.p>
          <motion.h1
            className="text-4xl font-semibold leading-tight text-brand-primary sm:text-5xl"
            variants={fadeUp}
            transition={{ delay: 0.1 }}
          >
            Let's talk about transforming your practice.
          </motion.h1>
          <motion.p className="max-w-2xl text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.2 }}>
            Whether you're a clinic administrator, healthcare provider, or healthcare system, we're here to help you implement Medclara and unlock efficiency in your clinical workflows.
          </motion.p>
        </AnimatedSection>

        {/* Contact Channels */}
        <AnimatedSection className="space-y-12">
          <div className="max-w-2xl space-y-3">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              Reach us directly
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Multiple ways to connect with our team.
            </motion.p>
          </div>
          <motion.div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" variants={staggerContainer}>
            {contactChannels.map(({ title, description, contact, href, icon: Icon }) => (
              <motion.a
                key={title}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className="group flex flex-col gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm transition hover:border-[var(--border-strong)]"
                variants={staggerItem}
                whileHover={{ y: -6, boxShadow: "0 20px 45px rgba(15,23,42,0.12)" }}
              >
                <motion.div
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-base)] text-brand-primary"
                  whileHover={{ scale: 1.1, rotate: 10 }}
                >
                  <Icon />
                </motion.div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium text-brand-primary">{title}</h3>
                  <p className="text-sm text-brand-secondary">{description}</p>
                </div>
                <p className="mt-auto font-mono text-sm font-semibold text-brand-tertiary">{contact}</p>
              </motion.a>
            ))}
          </motion.div>
        </AnimatedSection>

        <div className="h-px w-full bg-slate-200 dark:bg-white/10" aria-hidden />

        {/* FAQ Section */}
        <AnimatedSection className="space-y-12">
          <div className="max-w-2xl space-y-3">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              Frequently asked questions
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Quick answers to common questions about Medclara.
            </motion.p>
          </div>
          <motion.div className="space-y-4" variants={staggerContainer}>
            {faqItems.map(({ question, answer }, index) => (
              <motion.div
                key={index}
                className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden"
                variants={staggerItem}
              >
                <button
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                  className="w-full px-6 py-5 text-left transition hover:bg-[var(--surface-card-hover)] flex items-center justify-between gap-4"
                >
                  <h3 className="text-lg font-medium text-brand-primary pr-4">{question}</h3>
                  <motion.div
                    animate={{ rotate: expandedIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0"
                  >
                    <ChevronIcon />
                  </motion.div>
                </button>
                <motion.div
                  initial={false}
                  animate={{
                    height: expandedIndex === index ? "auto" : 0,
                    opacity: expandedIndex === index ? 1 : 0,
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden border-t border-[var(--border-subtle)]"
                >
                  <p className="px-6 py-4 text-sm text-brand-secondary">{answer}</p>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatedSection>

        <div className="h-px w-full bg-slate-200 dark:bg-white/10" aria-hidden />

        {/* CTA Section */}
        <AnimatedSection className="rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-r from-[var(--surface-card)] to-[var(--surface-card)] p-6 sm:p-12 shadow-sm">
          <motion.div className="space-y-6" variants={fadeUp}>
            <h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl">
              Ready to transform your documentation?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-brand-secondary">
              Join healthcare providers across India who are reclaiming time for patient care.
            </p>
            <motion.a
              href="/#contact"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-6 py-3 text-sm font-semibold !text-slate-900 dark:!text-slate-900 transition hover:bg-zinc-200"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              Request Early Access
            </motion.a>
          </motion.div>
        </AnimatedSection>
      </main>

      <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-card)] py-10 text-brand-secondary">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Medclara. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <motion.a href="/privacy-policy" className="transition hover:text-brand-primary" whileHover={{ y: -2 }}>
              Privacy Policy
            </motion.a>
            <motion.a href="/terms-and-conditions" className="transition hover:text-brand-primary" whileHover={{ y: -2 }}>
              Terms of Use
            </motion.a>
            <motion.a
              href="https://www.linkedin.com/company/medclara/"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-brand-primary"
              whileHover={{ y: -2 }}
            >
              LinkedIn
            </motion.a>
            <motion.a href="mailto:contact@medclara.in" className="transition hover:text-brand-primary" whileHover={{ y: -2 }}>
              contact@medclara.in
            </motion.a>
          </div>
        </div>
      </footer>

      {/* Mobile Menu */}
      <MobileMenu />
    </div>
  );
}

type AnimatedSectionProps = React.ComponentProps<typeof motion.section> & {
  delay?: number;
};

function AnimatedSection({ delay = 0, className, children, ...rest }: AnimatedSectionProps) {
  const composedClassName = `scroll-mt-1 sm:scroll-mt-10 lg:scroll-mt-1 ${className ?? ""}`.trim();

  return (
    <motion.section
      {...rest}
      className={composedClassName}
      variants={sectionVariants(delay)}
      initial="visible"
      animate="visible"
    >
      {children}
    </motion.section>
  );
}

function sectionVariants(delay: number): Variants {
  return {
    hidden: { opacity: 0, y: 48 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay,
        duration: 0.7,
        ease: easeOutExpo,
        when: "beforeChildren",
      },
    },
  };
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: easeOutExpo,
    },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: easeOutExpo,
    },
  },
};

function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M2 4H18C18.5523 4 19 4.44772 19 5V15C19 15.5523 18.5523 16 18 16H2C1.44772 16 1 15.5523 1 15V5C1 4.44772 1.44772 4 2 4Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M1 5L10 11L19 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 3C3.44772 3 3 3.44772 3 4V16C3 16.5523 3.44772 17 4 17H16C16.5523 17 17 16.5523 17 16V4C17 3.44772 16.5523 3 16 3H4Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M6 11V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 7.5C6.55228 7.5 7 7.05228 7 6.5C7 5.94772 6.55228 5.5 6 5.5C5.44772 5.5 5 5.94772 5 6.5C5 7.05228 5.44772 7.5 6 7.5Z" fill="currentColor" />
      <path
        d="M11 14V11C11 10.134 10.6083 9.5 9.7 9.5C9.0326 9.5 8.53448 9.97299 8.34049 10.45M14 11V14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M2 11C2 6.58172 5.58172 3 10 3C14.4183 3 18 6.58172 18 11C18 15.4183 14.4183 19 10 19C9.31317 19 8.64054 18.9184 8 18.7611"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="6" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="11" r="1" fill="currentColor" />
      <circle cx="14" cy="11" r="1" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 8L10 13L15 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
