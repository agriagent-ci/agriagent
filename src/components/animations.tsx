import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};

export const pageTransitionConfig = {
  initial: 'initial' as const,
  animate: 'animate' as const,
  exit: 'exit' as const,
  transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageTransition}
      {...pageTransitionConfig}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

export function MotionCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={fadeInUp}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}
