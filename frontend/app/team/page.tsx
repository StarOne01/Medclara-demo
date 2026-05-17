'use client';

import { motion, Variants } from "framer-motion";
import React, { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { MobileMenu } from "@/components/mobile-menu";

const teamMembers = [
  {
    name: "Mr. Mukunthan",
    role: "Co-Founder & CEO",
    expertise: ["MS-4", "Clinical Validation"],
  },
  {
    name: "Mr. Prashanth",
    role: "Co-Founder & CTO",
    expertise: ["Tech Founder","Product Development"],
  },
];

const values = [
  {
    title: "Patient-Centric Design",
    description: "Every feature is built to reduce clinician burden and improve patient outcomes, not to optimize metrics.",
  },
  {
    title: "Clinical Excellence",
    description: "We work closely with healthcare providers to ensure our AI meets the highest standards of medical accuracy.",
  },
  {
    title: "Inclusive Technology",
    description: "Our multilingual approach ensures no patient is left behind due to language barriers or healthcare access gaps.",
  },
  {
    title: "Radical Transparency",
    description: "We're open about our AI's capabilities, limitations, and how it's being used to improve clinical care.",
  },
];

const easeOutExpo: [number, number, number, number] = [0.12, 0.12, 0.1, 0.1];

export default function TeamPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--border-subtle),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(63,63,70,0.25),transparent_60%)]" />
            <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-12 sm:px-6 sm:py-20 lg:py-24">
        {/* Hero Section */}
        <AnimatedSection className="space-y-6">
          <motion.p className="text-sm uppercase tracking-[0.3em] text-brand-secondary" variants={fadeUp}>
            Our Team
          </motion.p>
          <motion.h1
            className="text-4xl font-semibold leading-tight text-brand-primary sm:text-5xl"
            variants={fadeUp}
            transition={{ delay: 0.1 }}
          >
            Building the future of clinical documentation.
          </motion.h1>
          <motion.p className="max-w-2xl text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.2 }}>
            We're a diverse team of clinicians, AI researchers, and healthcare technologists united by one mission: to reclaim clinicians' time for what matters most—patient care.
          </motion.p>
        </AnimatedSection>

        {/* Values Section */}
        <AnimatedSection className="space-y-12">
          <div className="max-w-2xl space-y-3">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              Our core values
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Everything we do is guided by these principles.
            </motion.p>
          </div>
          <motion.div className="grid gap-6 md:grid-cols-2" variants={staggerContainer}>
            {values.map(({ title, description }) => (
              <motion.article
                key={title}
                className="group flex flex-col gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm transition"
                variants={staggerItem}
                whileHover={{ y: -6, boxShadow: "0 20px 45px rgba(15,23,42,0.12)" }}
              >
                <h3 className="text-xl font-medium text-brand-primary">{title}</h3>
                <p className="text-sm text-brand-secondary">{description}</p>
              </motion.article>
            ))}
          </motion.div>
        </AnimatedSection>

        <div className="h-px w-full bg-slate-200 dark:bg-white/10" aria-hidden />

        {/* Team Members Section */}
        <AnimatedSection className="space-y-12">
          <div className="max-w-2xl space-y-3">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              Meet the team
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Clinical experts, technologists, and healthcare builders working to transform medical documentation.
            </motion.p>
          </div>
          <motion.div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" variants={staggerContainer}>
            {teamMembers.map(({ name, role, expertise }, index) => (
              <motion.article
                key={name}
                className="group flex flex-col gap-4 rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface-card)] to-[var(--surface-card)] p-6 shadow-sm transition"
                variants={staggerItem}
                whileHover={{ y: -8, boxShadow: "0 24px 50px rgba(15,23,42,0.18)" }}
              >
                {/* Avatar Placeholder */}
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-base)]">
                  <span className="text-xl font-semibold text-brand-tertiary">
                    {name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-brand-primary">{name}</h3>
                  <p className="text-xs uppercase tracking-[0.2em] text-brand-tertiary">{role}</p>
                </div>


                <div className="mt-auto flex flex-wrap gap-2 pt-4 border-t border-[var(--border-subtle)]">
                  {expertise.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-1 text-xs text-brand-tertiary"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.article>
            ))}
          </motion.div>
        </AnimatedSection>

        <div className="h-px w-full bg-slate-200 dark:bg-white/10" aria-hidden />


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
