import { cva, type VariantProps } from "class-variance-authority";

/**
 * Glass effect variants using CVA - simplified for media cards only
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
 * Preset glass styles for media cards only
 */
export const glassPresets = {
  card: {
    blur: "subtle" as const,
    background: "light" as const,
    border: "subtle" as const,
    shadow: "sm" as const,
    rounded: "lg" as const,
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
