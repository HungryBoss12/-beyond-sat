import type { Transition, Variants } from "motion/react";

export const VOCAB_EASE = [0.22, 1, 0.36, 1] as const;

export const sheetTransition: Transition = {
  duration: 0.45,
  ease: VOCAB_EASE,
};

export const sheetEnterTransition: Transition = {
  duration: 0.4,
  ease: VOCAB_EASE,
};

export const flipTransition: Transition = {
  duration: 0.28,
  ease: VOCAB_EASE,
};

export const fadeTransition: Transition = {
  duration: 0.35,
  ease: VOCAB_EASE,
};

export const footerTransition: Transition = {
  duration: 0.3,
  ease: VOCAB_EASE,
};

/** Top-edge peel: card pulled down and off like a sheet. */
export function sheetPeelVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.15 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  return {
    initial: {
      opacity: 0,
      y: 24,
      rotateX: 0,
      scale: 1,
    },
    animate: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      scale: 1,
      transition: sheetEnterTransition,
    },
    exit: {
      opacity: 0,
      y: "85%",
      rotateX: -22,
      scale: 0.98,
      transition: sheetTransition,
    },
  };
}

/** Front/back flip on the same card — no full peel. */
export function flipRevealVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.12 } },
      exit: { opacity: 0, transition: { duration: 0.08 } },
    };
  }
  return {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0, transition: flipTransition },
    exit: { opacity: 0, y: 8, transition: { duration: 0.18, ease: VOCAB_EASE } },
  };
}

export function fadeInVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: fadeTransition },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };
}

export function footerSlideVariants(reduced: boolean): Variants {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: footerTransition },
    exit: { opacity: 0, y: 12, transition: { duration: 0.2 } },
  };
}

/** Shared motion props for 3D peel container. */
export const vocabStageStyle = {
  perspective: 1200,
  transformStyle: "preserve-3d" as const,
};

export const vocabSheetStyle = {
  transformOrigin: "top center",
  transformStyle: "preserve-3d" as const,
  backfaceVisibility: "hidden" as const,
};
