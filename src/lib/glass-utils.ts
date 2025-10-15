import { cva, type VariantProps } from "class-variance-authority";

/**
 * Glass effect variants using CVA
 */
export const glassVariants = cva("border backdrop-blur-md transition-all", {
  variants: {
    blur: {
      subtle: "backdrop-blur-[var(--glass-blur-subtle)]",
      medium: "backdrop-blur-[var(--glass-blur-medium)]",
      strong: "backdrop-blur-[var(--glass-blur-strong)]",
      ultra: "backdrop-blur-[var(--glass-blur-ultra)]",
    },
    background: {
      subtle: "bg-[var(--glass-bg-subtle)]",
      light: "bg-[var(--glass-bg-light)]",
      medium: "bg-[var(--glass-bg-medium)]",
      heavy: "bg-[var(--glass-bg-heavy)]",
    },
    border: {
      none: "border-transparent",
      subtle: "border-[var(--glass-border-subtle)]",
      light: "border-[var(--glass-border-light)]",
      medium: "border-[var(--glass-border-medium)]",
      strong: "border-[var(--glass-border-strong)]",
    },
    shadow: {
      none: "shadow-none",
      sm: "shadow-[var(--glass-shadow-sm)]",
      md: "shadow-[var(--glass-shadow-md)]",
      lg: "shadow-[var(--glass-shadow-lg)]",
      xl: "shadow-[var(--glass-shadow-xl)]",
    },
    rounded: {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
      "2xl": "rounded-2xl",
      full: "rounded-full",
    },
    elevation: {
      "1": "bg-[var(--glass-elevation-1)]",
      "2": "bg-[var(--glass-elevation-2)]",
      "3": "bg-[var(--glass-elevation-3)]",
      "4": "bg-[var(--glass-elevation-4)]",
    },
  },
  defaultVariants: {
    blur: "medium",
    background: "light",
    border: "light",
    shadow: "md",
    rounded: "lg",
  },
});

export type GlassVariants = VariantProps<typeof glassVariants>;

/**
 * Preset glass styles for common use cases
 */
export const glassPresets = {
  panel: {
    blur: "medium" as const,
    background: "medium" as const,
    border: "light" as const,
    shadow: "md" as const,
    rounded: "2xl" as const,
  },
  card: {
    blur: "subtle" as const,
    background: "light" as const,
    border: "subtle" as const,
    shadow: "sm" as const,
    rounded: "lg" as const,
  },
  overlay: {
    blur: "strong" as const,
    background: "heavy" as const,
    border: "none" as const,
    shadow: "xl" as const,
    rounded: "none" as const,
  },
  control: {
    blur: "medium" as const,
    background: "light" as const,
    border: "light" as const,
    shadow: "sm" as const,
    rounded: "md" as const,
  },
  dropdown: {
    blur: "medium" as const,
    background: "medium" as const,
    border: "light" as const,
    shadow: "lg" as const,
    rounded: "2xl" as const,
  },
} as const;

/**
 * Helper function to get glass style classes
 */
export function getGlassClasses(
  preset?: keyof typeof glassPresets,
  overrides?: GlassVariants
) {
  const baseStyles = preset ? glassPresets[preset] : {};
  return glassVariants({ ...baseStyles, ...overrides });
}

/**
 * Animation variants for glass components
 */
export const glassAnimations = {
  fadeIn: "animate-in fade-in duration-200",
  slideIn: "animate-in slide-in-from-bottom-2 duration-200",
  scaleIn: "animate-in zoom-in-95 duration-200",
  slideDown: "animate-in slide-in-from-top-2 duration-200",
} as const;

/**
 * Transition classes
 */
export const glassTransitions = {
  fast: "transition-all duration-[var(--glass-transition-fast)]",
  base: "transition-all duration-[var(--glass-transition-base)]",
  slow: "transition-all duration-[var(--glass-transition-slow)]",
} as const;
