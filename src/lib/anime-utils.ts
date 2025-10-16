import { animate, createTimeline, stagger } from "animejs";

// Animation presets for video player components
export const animationPresets = {
  // Fade in with scale animation
  fadeInScale: {
    opacity: [0, 1],
    scale: [0.8, 1],
    duration: 300,
    ease: "outQuart",
  },

  // Pulsing effect for loading indicators
  pulse: {
    scale: [1, 1.1, 1],
    duration: 1000,
    loop: true,
    ease: "inOutSine",
  },

  // Slide in from direction with easing
  slideIn: {
    translateY: [-20, 0],
    opacity: [0, 1],
    duration: 400,
    ease: "outBack",
  },

  // Shimmer/wave effect for progress
  shimmer: {
    translateX: ["-100%", "100%"],
    duration: 1500,
    loop: true,
    ease: "inOutSine",
  },

  // Elastic bounce for feedback
  elasticBounce: {
    scale: [1, 1.2, 1],
    duration: 600,
    ease: "outElastic",
  },

  // Stagger fade in for multiple elements
  staggerFadeIn: {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 400,
    delay: stagger(100),
    ease: "outQuart",
  },

  // Circular progress animation
  circularProgress: {
    strokeDashoffset: [251.2, 0], // 251.2 is circumference of r=40 circle
    duration: 1000,
    ease: "inOutQuart",
  },

  // Wave/ripple effect
  wave: {
    scale: [0, 1],
    opacity: [0.8, 0],
    duration: 800,
    ease: "outQuart",
  },
};

// Helper function to create anime instance with SolidJS ref
export function createAnimeInstance(
  targets: HTMLElement | HTMLElement[] | string,
  animationConfig: Record<string, unknown>,
  onComplete?: () => void
) {
  return animate(targets, {
    ...animationConfig,
    ...(onComplete && { complete: onComplete }),
  });
}

// Helper function to create timeline (v4 API)
export function createAnimeTimeline(options: Record<string, unknown> = {}) {
  return createTimeline(options);
}

// Helper function for staggered animations (v4 API)
export function staggerAnimation(
  targets: HTMLElement[],
  animationConfig: Record<string, unknown>,
  staggerDelay = 100
) {
  return animate(targets, {
    ...animationConfig,
    delay: stagger(staggerDelay),
  });
}

// Helper function to animate progress bar
export function animateProgress(
  element: HTMLElement,
  from: number,
  to: number,
  duration = 500
) {
  return animate(element, {
    width: [`${from}%`, `${to}%`],
    duration,
    ease: "outQuart",
  });
}

// Helper function to animate circular progress
export function animateCircularProgress(
  element: HTMLElement,
  progress: number,
  duration = 800
) {
  const circumference = 2 * Math.PI * 40; // r=40
  const offset = circumference - (progress / 100) * circumference;

  return animate(element, {
    strokeDashoffset: [
      element.getAttribute("stroke-dashoffset") || circumference,
      offset,
    ],
    duration,
    ease: "inOutQuart",
  });
}

// Helper function to create counting animation
export function animateCount(
  element: HTMLElement,
  from: number,
  to: number,
  duration = 1000
) {
  return animate(
    { value: from },
    {
      value: to,
      duration,
      ease: "outQuart",
      onUpdate: (anim) => {
        element.textContent = Math.round(anim._currentTime).toString();
      },
    }
  );
}

// Helper function to clean up animations
export function cleanupAnimation(animation: unknown) {
  if (
    animation &&
    typeof animation === "object" &&
    animation !== null &&
    "pause" in animation &&
    typeof animation.pause === "function"
  ) {
    animation.pause();
  }
}

// Helper function to check if user prefers reduced motion
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Helper function to create animation with reduced motion support
export function createAccessibleAnimation(
  targets: HTMLElement | HTMLElement[] | string,
  animationConfig: Record<string, unknown>,
  reducedMotionConfig?: Record<string, unknown>
) {
  const config = prefersReducedMotion()
    ? { ...animationConfig, ...reducedMotionConfig }
    : animationConfig;

  return createAnimeInstance(targets, config);
}
