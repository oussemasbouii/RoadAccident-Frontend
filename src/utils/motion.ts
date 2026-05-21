import type { Variants, Transition } from 'framer-motion'

// Apple / Linear-quality physics presets
export const spring = {
  // Nav pills, button press — immediate tactile snap
  snappy: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 } as const,
  // Card hover, drawer open — smooth but responsive
  smooth: { type: 'spring', stiffness: 320, damping: 30, mass: 1 } as const,
  // Modals, page layers — relaxed, purposeful
  gentle: { type: 'spring', stiffness: 200, damping: 26, mass: 1 } as const,
}

// Material Design deceleration curve — matches Apple's ease-out feel
export const easeDecel: [number, number, number, number] = [0.0, 0.0, 0.2, 1.0]
export const easeStandard: [number, number, number, number] = [0.4, 0.0, 0.2, 1.0]

export const dur = {
  micro: 0.10,
  fast: 0.16,
  normal: 0.22,
  moderate: 0.30,
  slow: 0.45,
}

// ─── Page transitions ────────────────────────────────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: dur.moderate, ease: easeDecel },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: { duration: dur.fast, ease: easeDecel },
  },
}

// ─── Staggered containers ────────────────────────────────────────────────────
export const listParent: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
}

export const listChild: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: dur.moderate, ease: easeDecel },
  },
}

// Lighter, faster version for dense data rows
export const tableParent: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.028 } },
}

export const tableRow: Variants = {
  initial: { opacity: 0, x: -6 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: dur.normal, ease: easeDecel },
  },
}

// ─── Fade only (skeleton → content) ─────────────────────────────────────────
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: dur.moderate, ease: easeDecel } },
}

// ─── Scale pop (badges, chips, counters) ─────────────────────────────────────
export const scalePop: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: spring.snappy,
  },
}
