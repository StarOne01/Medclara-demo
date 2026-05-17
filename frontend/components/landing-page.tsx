"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  motion,
  useScroll,
  useSpring,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import { InterestForm } from "@/components/interest-form";
import {Nav} from "@/components/nav";
import { MobileMenu } from "@/components/mobile-menu";

// Fallback hardcoded content for offline/error scenarios
const DEFAULT_PAIN_POINTS = [
  {
    title: "Documentation overload",
    description:
      "Doctors spend over 5 hours daily on manual note-taking and reports, leading to burnout.",
    stat: "5+ hours lost each day",
    icon: DocumentIcon,
  },
  {
    title: "Language barriers",
    description:
      "Language differences in diverse patient populations create inaccuracies and delays in care.",
    stat: "110+ languages in clinics",
    icon: GlobeIcon,
  },
  {
    title: "Administrative friction",
    description:
      "Administrative burdens reduce face-to-face patient time and increase documentation errors.",
    stat: "50% of clinician time spent on paperwork",
    icon: ClockIcon,
  },
];

const DEFAULT_STEPS = [
  {
    title: "Capture",
    description:
      "Record conversations in any language, with special focus on Indian languages (Tamil, Malayalam, Telugu, Kannada, Hindi, Bengali), using real-time multilingual ASR.",
    icon: WaveformIcon,
    mediaAlt: "Multilingual transcription interface",
  },
  {
    title: "Analyze",
    description:
      "AI processes dialogue to identify key findings, diagnoses, medications and care recommendations with medical-grade accuracy.",
    icon: SparkIcon,
    mediaAlt: "Clinical insights generated from audio",
  },
  {
    title: "Extract",
    description:
      "Instantly produce customizable reports, summaries, or billing codes tailored to every specialty.",
    icon: DocumentIcon,
    mediaAlt: "Exported medical report ready to review",
  },
];

const DEFAULT_FEATURES = [
  {
    title: "Multilingual intelligence",
    description:
      "Automatic transcription and report generation across global languages and dialects.",
    icon: GlobeIcon,
  },
  {
    title: "Specialty templates",
    description:
      "Configurable templates for cardiology, pediatrics, telehealth and more.",
    icon: LayersIcon,
  },
  {
    title: "HIPAA-grade security",
    description:
      "Protected, encrypted storage aligned with HIPAA, GDPR and SOC 2.",
    icon: ShieldIcon,
  },
  {
    title: "EHR integrations",
    description:
      "Seamless sync with leading EHR platforms to streamline workflows.",
    icon: PuzzleIcon,
  },
  {
    title: "Real-time collaboration",
    description:
      "Invite care teams to review, edit and finalize documentation together.",
    icon: UsersIcon,
  },
  {
    title: "Continuous improvement",
    description:
      "Adaptive learning models that refine accuracy with every interaction.",
    icon: SparkIcon,
  },
];

const DEFAULT_TESTIMONIALS = [
  {
    quote:
      "I lose track of nuances in complex cases because I'm trying to document everything in real-time. Patients deserve my full attention, but I'm dividing it between them and my keyboard!",
    name: "Dr. Rajkumar K Seenivasagam",
    role: "Oncology surgeon, Coimbatore",
  },
  {
    quote:
      "EHR systems are supposed to make things easier, but they're often clunky and slow. I find myself fighting with the interface typing instead of focusing on patient care.",
    name: "Dr. Venkat Subramanian",
    role: "Internal Medicine, Salem",
  },
  {
    quote:
      "The complexity of medical documentation requirements keeps increasing, but our time with each patient keeps decreasing. We need better tools to bridge this gap.",
    name: "Dr. Kavitha Raghavan",
    role: "Obstetrics & Gynecology, Erode",
  },
  {
    quote:
      "When I'm rushing through documentation to keep up with patient flow, I worry about missing critical details or making errors. The pressure to be both fast and accurate is constant!",
    name: "Dr. Sangeetha Krishnan",
    role: "Pulmonology, Thanjavur",
  },
];

const easeOutExpo: [number, number, number, number] = [0.12, 0.12, 0.1, 0.1];

export function LandingPage() {
  return <LandingPageContent />;
}

// Content: Using hardcoded defaults only (API removed)
// The landing page content is static and doesn't require dynamic loading
function useLandingPageContent() {
  return {
    content: {
      painPoints: DEFAULT_PAIN_POINTS,
      steps: DEFAULT_STEPS,
      features: DEFAULT_FEATURES,
      testimonials: DEFAULT_TESTIMONIALS,
    },
    loading: false,
  };
}

function LandingPageContent() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.2,
  });
  
  // Load dynamic content from API or use defaults
  const { content, loading } = useLandingPageContent();
  const { painPoints, steps, features, testimonials } = content;
  return (
    <div className="relative overflow-hidden" id="home">

      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--border-subtle),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(63,63,70,0.25),transparent_60%)]" />
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 py-12 sm:px-6 sm:py-20 lg:py-24">
        <HeroSection />
        <AnimatedSection id="pain-points" className="space-y-12">
          <div className="max-w-2xl space-y-3">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              The documentation burden overwhelms your teams.
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Healthcare providers lose critical time to fragmented workflows, manual entry and language gaps. Medclara addresses the pressure points that slow clinics down.
            </motion.p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {painPoints.map(({ title, description, stat, icon: Icon }, index) => (
              <motion.article
                key={title}
                className="group flex flex-col gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm transition"
                variants={staggerItem}
                whileHover={{ y: -6, boxShadow: "0 20px 45px rgba(15,23,42,0.12)" }}
              >
                <IconWrapper>
                  <Icon />
                </IconWrapper>
                <div className="space-y-3">
                  <h3 className="text-xl font-medium text-brand-primary">{title}</h3>
                  <p className="text-sm text-brand-secondary">{description}</p>
                </div>
                <motion.p
                  className="mt-auto text-xs uppercase tracking-[0.2em] text-brand-tertiary"
                  animate={{ letterSpacing: ["0.2em", "0.25em", "0.2em"] }}
                  transition={{ duration: 6, repeat: Infinity, delay: index * 0.6 }}
                >
                  {stat}
                </motion.p>
              </motion.article>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection id="how-it-works" className="space-y-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl space-y-3">
              <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
                How Medclara turns conversations into care plans.
              </motion.h2>
              <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
                Inspired by leading clinical workflows, Medclara streamlines every step from capture to final report with secure, multilingual intelligence.
              </motion.p>
            </div>
            <motion.span className="text-sm text-brand-tertiary" variants={fadeUp} transition={{ delay: 0.15 }}>
              Designed for hybrid, in-person and telehealth care teams.
            </motion.span>
          </div>
          <motion.div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3" variants={staggerContainer}>
            {steps.map(({ title, description, icon: Icon, mediaAlt }, index) => (
              <motion.article
                key={title}
                className="flex flex-col gap-6 rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-card)] to-[var(--surface-card)] p-6"
                variants={staggerItem}
                whileHover={{ y: -8, scale: 1.02, boxShadow: "0 24px 50px rgba(15,23,42,0.18)" }}
              >
                <div className="flex items-center justify-between">
                  <IconWrapper>
                    <Icon />
                  </IconWrapper>
                  <span className="text-xs uppercase tracking-[0.3em] text-brand-tertiary">Step {index + 1}</span>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold text-brand-primary">{title}</h3>
                  <p className="text-sm text-brand-secondary">{description}</p>
                </div>
                <motion.div
                  className="relative mt-auto aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)]"
                  whileHover={{ rotateX: 4, rotateY: -4 }}
                  transition={{ type: "spring", stiffness: 120, damping: 12 }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--border-subtle),transparent_60%)]" />
                  <div className="relative flex h-full flex-col justify-center gap-2 p-6 text-xs text-brand-secondary">
                    <p className="font-semibold text-brand-primary">{title}</p>
                    <p className="text-brand-tertiary">{mediaAlt}</p>
                  </div>
                </motion.div>
              </motion.article>
            ))}
          </motion.div>
        </AnimatedSection>

        <AnimatedDivider />

        <AnimatedSection id="features" className="space-y-12">
          <div className="max-w-2xl space-y-3">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              Built for precision, trust and clinical adaptability.
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Medclara combines multilingual intelligence with enterprise-grade security so every clinician can document faster without sacrificing accuracy.
            </motion.p>
          </div>
          <motion.div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" variants={staggerContainer}>
            {features.map(({ title, description, icon: Icon }) => (
              <motion.article
                key={title}
                className="group flex flex-col gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-sm transition"
                variants={staggerItem}
                whileHover={{ y: -6, boxShadow: "0 20px 45px rgba(15,23,42,0.12)" }}
              >
                <IconWrapper>
                  <Icon />
                </IconWrapper>
                <div className="space-y-3">
                  <h3 className="text-xl font-medium text-brand-primary">{title}</h3>
                  <p className="text-sm text-brand-secondary">{description}</p>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </AnimatedSection>

        <AnimatedDivider />

        <AnimatedSection id="security" className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="lg:space-y-6">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              Security and privacy engineered for healthcare.
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Medclara prioritizes data security with end-to-end encryption and best-in-class privacy standards across HIPAA, GDPR, ISO 27001, NDHM integration,  and SOC 2 frameworks.
            </motion.p>
            <motion.ul
              className="grid gap-4 text-sm mt-8 text-brand-secondary sm:grid-cols-2"
              variants={staggerContainer}
            >
              <motion.li className="flex items-start gap-3" variants={staggerItem}>
                <ShieldIcon />
                <div>
                  <p className="font-medium text-brand-primary">HIPAA compliant infrastructure</p>
                  <p className="text-sm text-brand-tertiary">Audited access controls, PHI safeguards and audit trails.</p>
                </div>
              </motion.li>
              <motion.li className="flex items-start gap-3" variants={staggerItem}>
                <LockIcon />
                <div>
                  <p className="font-medium text-brand-primary">End-to-end encryption</p>
                  <p className="text-sm text-brand-tertiary">AES-256 data at rest and TLS 1.3 in transit.</p>
                </div>
              </motion.li>
              <motion.li className="flex items-start gap-3" variants={staggerItem}>
                <ShieldCheckIcon />
                <div>
                  <p className="font-medium text-brand-primary">GDPR alignment</p>
                  <p className="text-sm text-brand-tertiary">Regional data residency and right-to-erasure workflows.</p>
                </div>
              </motion.li>
              <motion.li className="flex items-start gap-3" variants={staggerItem}>
                <ServerIcon />
                <div>
                  <p className="font-medium text-brand-primary">Secured backend</p>
                  <p className="text-sm text-brand-tertiary">Managed PostgreSQL with row-level security and audit logging.</p>
                </div>
              </motion.li>
            </motion.ul>
          </div>
          <motion.div
            className="relative rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface-card)] to-transparent p-8 shadow-xl"
            variants={fadeUp}
            whileHover={{ y: -10, boxShadow: "0 25px 60px rgba(15, 23, 42, 0.45)" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="text-xs uppercase tracking-[0.3em] text-brand-tertiary">
              Compliance Snapshot
            </span>
            <div className="mt-6 space-y-6">
              <motion.div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-5 shadow-sm" variants={fadeUp}>
                <p className="text-sm font-semibold text-brand-primary">Continuous security</p>
                <p className="mt-2 text-sm text-brand-secondary">
                  Real-time security posture updates and automated incident alerts keep your team informed without manual effort.
                </p>
              </motion.div>
              <motion.div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-5 shadow-sm" variants={fadeUp} transition={{ delay: 0.1 }}>
                <p className="text-sm font-semibold text-brand-primary">Data governance controls</p>
                <p className="mt-2 text-sm text-brand-secondary">
                  Granular permissions, audit logging and secure data retention policies protect PHI throughout its lifecycle.
                </p>
              </motion.div>
              <motion.div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-5 shadow-sm" variants={fadeUp} transition={{ delay: 0.2 }}>
                <p className="text-sm font-semibold text-brand-primary">Certified partners</p>
                <p className="mt-2 text-sm text-brand-secondary">
                  Built on healthcare-ready infrastructure with dedicated compliance reviews and third-party attestations.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </AnimatedSection>

        <AnimatedDivider />

        {/* <AnimatedSection id="testimonials" className="space-y-12">
          <div className="max-w-2xl space-y-3">
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              The Documentation Crisis: Voices from the Frontlines
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Healthcare providers spend more time on documentation than with patients - up to 5 hours daily on administrative tasks alone. This burden fuels burnout and reduces care quality. Here's what doctors are facing:
            </motion.p>
          </div>
          <motion.div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2" variants={staggerContainer}>
            {testimonials.map(({ quote, name, role }) => (
              <motion.blockquote
                key={name}
                className="flex h-full flex-col gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-sm text-brand-secondary shadow-sm"
                variants={staggerItem}
                whileHover={{ borderColor: "rgba(99,102,241,0.35)", y: -6 }}
              >
                <motion.p className="text-lg leading-relaxed text-brand-primary" layout>
                  "{quote}"
                </motion.p>
                <div className="mt-auto text-xs uppercase tracking-[0.3em] text-brand-tertiary">
                  <p className="text-brand-primary">{name}</p>
                  <p className="mt-1 text-sm normal-case tracking-normal text-brand-secondary">{role}</p>
                </div>
              </motion.blockquote>
            ))}
          </motion.div>
        </AnimatedSection> */}

        <AnimatedDivider />

                <AnimatedSection id="contact" className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-6">
            <motion.p className="text-sm uppercase tracking-[0.3em] text-brand-tertiary" variants={fadeUp}>
              Request early access
            </motion.p>
            <motion.h2 className="text-3xl font-semibold text-brand-primary sm:text-4xl" variants={fadeUp}>
              Be the first to experience Medclara.
            </motion.h2>
            <motion.p className="text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.1 }}>
              Share your details and we'll reach out with beta access, demos and implementation guidance tailored to your practice.
            </motion.p>
            <motion.ul className="space-y-3 text-sm text-brand-secondary" variants={fadeUp} transition={{ delay: 0.2 }}>
              <li>• Designed for physicians, clinic administrators and enterprise health systems.</li>
              <li>• Secured submissions stored in a dedicated interest registry.</li>
              <li>• No spam, just meaningful updates on availability and roadmap.</li>
            </motion.ul>
          </div>
          <motion.div variants={fadeUp}>
            <InterestForm />
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

export default LandingPage;

function HeroSection() {
  return (
    <AnimatedSection className="relative grid gap-16 min-h-[calc(100vh-200px)] lg:grid-cols-[1.05fr_0.95fr] items-center lg:justify-center">
      <motion.div
        className="space-y-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.p className="text-sm uppercase tracking-[0.3em] text-brand-secondary" variants={fadeUp}>
          Multilingual Clinical Documentation
        </motion.p>
        <motion.h1
          className="text-4xl font-semibold leading-tight text-brand-primary sm:text-5xl"
          variants={fadeUp}
          transition={{ delay: 0.1 }}
        >
          Medclara: Multilingual AI for Effortless Medical Reporting.
        </motion.h1>
        <motion.p className="max-w-xl text-lg text-brand-secondary" variants={fadeUp} transition={{ delay: 0.2 }}>
          Transform doctor-patient conversations into accurate, multilingual reports instantly, reclaim your time for what matters.
        </motion.p>
        <motion.div className="flex flex-wrap items-center gap-4" variants={fadeUp} transition={{ delay: 0.3 }}>
          <motion.a
            href="#contact"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-6 py-3 text-sm font-semibold !text-slate-900 dark:!text-slate-900 transition hover:bg-zinc-200"
            whileHover={{ scale: 1.04, boxShadow: "0 12px 32px rgba(244, 244, 245, 0.2)" }}
            whileTap={{ scale: 0.96 }}
          >
            Show Interest
          </motion.a>
          <motion.span className="text-sm text-brand-tertiary" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 6, repeat: Infinity }}>
            Trusted AI partner for modern, multilingual practices.
          </motion.span>
        </motion.div>
      </motion.div>
      <motion.div
        className="relative isolate hidden lg:flex h-full items-center justify-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      >

        <motion.div
          className="relative w-full  max-w-md overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-card)] via-[var(--surface-card)] to-[var(--surface-base)] p-6 shadow-2xl"
          variants={tiltCard}
          whileHover="hover"
        >
          <motion.div
            className="flex items-center justify-between gap-4 text-xs text-brand-tertiary"
            variants={fadeUp}
          >
            <div className="flex flex-col">
              <span>Live consult transcription</span>
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                00:14:25
              </motion.span>
            </div>
            <InteractiveMic />
          </motion.div>
          <motion.div className="mt-6 space-y-4 font-mono text-xs text-brand-secondary" variants={staggerContainer}>
            <TranscriptionBubble
              label="Doctor (EN)"
              text="“Let's talk about your chest discomfort. When did it start?”"
              emphasis
            />
            <TranscriptionBubble
              label="Patient (TA)"
              text="“Doctor, rendu vaaram aagudhu, especially moochu edukkumbodhu konjam kashtama irukku.”"
            />
            <TranscriptionBubble
              label="Doctor (EN)"
              text="“Have you had any recent respiratory infections or colds?”"
            />
          </motion.div>
          <motion.div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 text-xs text-brand-secondary" variants={fadeUp}>
            <p className="uppercase tracking-[0.2em] text-brand-tertiary">Summary</p>
            <p className="mt-2 text-brand-primary">
              Multilingual transcript compiled. Draft report ready for cardiology template and billing code suggestions (ICD-10 R07.89).
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatedSection>
  );
}

function InteractiveMic() {
  const [isActive, setIsActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  const stopListening = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    dataArrayRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {
        // Swallow close errors that may happen on stale contexts.
      });
      audioContextRef.current = null;
    }

    setLevel(0);
  }, []);

  const updateAudioLevel = useCallback(() => {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;

    if (!analyser || !dataArray) {
      return;
    }

    analyser.getByteTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i += 1) {
      const value = dataArray[i] / 128 - 1;
      sumSquares += value * value;
    }

    const rms = Math.sqrt(sumSquares / dataArray.length);
    setLevel((previous) => previous * 0.6 + rms * 0.4);

    animationRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const startListening = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError("Microphone access isn't supported in this browser.");
      return;
    }

    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          stopListening();
          setIsActive(false);
        });
      });

      const AudioContextClass =
        typeof window !== "undefined"
          ? window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;

      if (!AudioContextClass) {
        setPermissionError("AudioContext is not supported in this environment.");
        return;
      }

      const audioContext = new AudioContextClass();
      await audioContext.resume();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;

      source.connect(analyser);

    sourceRef.current = source;

    analyserRef.current = analyser;
    dataArrayRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;

      setIsActive(true);
      animationRef.current = requestAnimationFrame(updateAudioLevel);
    } catch (error) {
      const message =
        error instanceof DOMException
          ? error.message
          : "We couldn't access your microphone.";
      setPermissionError(message);
      stopListening();
      setIsActive(false);
    }
  }, [stopListening, updateAudioLevel]);

  const handleToggle = useCallback(async () => {
    if (isActive) {
      stopListening();
      setIsActive(false);
      return;
    }

    await startListening();
  }, [isActive, startListening, stopListening]);

  useEffect(() => () => stopListening(), [stopListening]);

  const visualBars = useMemo(() => {
    const base = level * 60 + (isActive ? 18 : 0);
    return Array.from({ length: 8 }, (_, index) => {
      const attenuation = Math.max(0.2, 1 - index * 0.08);
      const height = Math.min(32, Math.max(6, base * attenuation));
      return Math.round(height);
    });
  }, [level, isActive]);

  return (
    <div className="flex flex-col items-end gap-2 text-right">
      <motion.button
        type="button"
        onClick={handleToggle}
        className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200/70 bg-white text-slate-800 shadow-[0_8px_24px_rgba(15,23,42,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 dark:border-white/20 dark:bg-white/[0.05] dark:text-white dark:shadow-[0_8px_30px_rgba(15,23,42,0.45)]"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-pressed={isActive}
        aria-label={isActive ? "Stop microphone preview" : "Start microphone preview"}
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-sky-400/20"
          animate={isActive ? { opacity: [0.4, 0.85, 0.4], scale: [1, 1.18, 1] } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 1.6, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
        />
        <span className="relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-black/70">
          <MicrophoneIcon />
        </span>
      </motion.button>
      <div className="flex items-end justify-center gap-[3px]" aria-hidden>
        {visualBars.map((height, index) => (
          <motion.span
            key={index}
            className="w-[6px] rounded-full bg-sky-400/60"
            style={{ height }}
            animate={isActive ? { height: [height * 0.6, height, height * 0.75] } : { height }}
            transition={{ duration: 0.8, repeat: isActive ? Infinity : 0, repeatType: "mirror", delay: index * 0.05 }}
          />
        ))}
      </div>

      {permissionError ? (
        <motion.span
          className="max-w-[14rem] text-[11px] text-amber-600 dark:text-amber-300/80"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {permissionError}
        </motion.span>
      ) : null}
    </div>
  );
}

function TranscriptionBubble({
  label,
  text,
  emphasis,
}: {
  label: string;
  text: string;
  emphasis?: boolean;
}) {
  return (
    <motion.div
      className={`rounded-2xl border p-4 shadow-xl transition ${
        emphasis
          ? "border-[var(--border-subtle)] bg-[var(--surface-base)] text-brand-primary"
          : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-brand-secondary"
      }`}
      variants={fadeUp}
      whileHover={{ borderColor: "rgba(99,102,241,0.4)" }}
    >
      <p className="text-xs font-medium text-brand-tertiary">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{text}</p>
    </motion.div>
  );
}

function AnimatedDivider() {
  return <div className="h-px w-full bg-slate-200 dark:bg-white/10" aria-hidden />;
}

type AnimatedSectionProps = HTMLMotionProps<"section"> & {
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

function IconWrapper({ children }: { children: ReactNode }) {
  return (
    <motion.span
      className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-base)] text-brand-primary"
      whileHover={{ scale: 1.05 }}
    >
      {children}
    </motion.span>
  );
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

const tiltCard = {
  hidden: { rotateX: 0, rotateY: 0 },
  hover: { rotateX: -2, rotateY: 2 },
};

function MicrophoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="7" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4 10.5C4 13.5376 6.46243 16 9.5 16H10.5C13.5376 16 16 13.5376 16 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M9.5 18.5H10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="10" cy="10" rx="3" ry="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 6.5V10.5L12.5 12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WaveformIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 10H5L6.2 5L8 15L10 4L12 15L13.8 5L15 10H17"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2L11.2 6.3H16L12.2 8.9L13.5 13.2L10 10.6L6.5 13.2L7.8 8.9L4 6.3H8.8L10 2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 3H11L15 7V17C15 17.5523 14.5523 18 14 18H6C5.44772 18 5 17.5523 5 17V4C5 3.44772 5.44772 3 6 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M10 3V8H15" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 7L10 4L16 7L10 10L4 7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M4 11L10 14L16 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M4 14.5L10 17.5L16 14.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 3L4 5V10C4 13.866 6.68629 16.3529 10 17.5C13.3137 16.3529 16 13.866 16 10V5L10 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PuzzleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M7 4H4V9H5.5C6.32843 9 7 9.67157 7 10.5C7 11.3284 6.32843 12 5.5 12H4V16H8V14.5C8 13.6716 8.67157 13 9.5 13C10.3284 13 11 13.6716 11 14.5V16H15V11H13.5C12.6716 11 12 10.3284 12 9.5C12 8.67157 12.6716 8 13.5 8H15V4H11V5.5C11 6.32843 10.3284 7 9.5 7C8.67157 7 8 6.32843 8 5.5V4H7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 16.5C4 13.5 6 12 9 12C12 12 14 13.5 14.5 16.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M14.5 8C14.5 6.89543 15.3954 6 16.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16.5 11C15.4 11 14.6 11.5 14.2 12.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="5" y="9" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M7.5 9V6.5C7.5 4.567 9.067 3 11 3C12.933 3 14.5 4.567 14.5 6.5V9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="12.5" r="1" fill="currentColor" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 3L4 5V10C4 13.866 6.68629 16.3529 10 17.5C13.3137 16.3529 16 13.866 16 10V5L10 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10.2L9.3 12L12.5 8.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="4" y="4" width="12" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="4" y="11" width="12" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="6.5" r="0.9" fill="currentColor" />
      <circle cx="7" cy="13.5" r="0.9" fill="currentColor" />
    </svg>
  );
}
