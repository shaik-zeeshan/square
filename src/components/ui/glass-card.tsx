import { type ComponentProps, splitProps } from "solid-js";
import { type GlassVariants, getGlassClasses } from "~/lib/glass-utils";
import { cn } from "~/lib/utils";

export interface GlassCardProps extends ComponentProps<"div">, GlassVariants {
  preset?: "panel" | "card" | "overlay" | "control" | "dropdown";
}

export function GlassCard(props: GlassCardProps) {
  const [local, others] = splitProps(props, [
    "class",
    "preset",
    "blur",
    "background",
    "border",
    "shadow",
    "rounded",
    "elevation",
    "children",
  ]);

  const glassClasses = () =>
    getGlassClasses(local.preset, {
      blur: local.blur,
      background: local.background,
      border: local.border,
      shadow: local.shadow,
      rounded: local.rounded,
      elevation: local.elevation,
    });

  return (
    <div class={cn(glassClasses(), local.class)} {...others}>
      {local.children}
    </div>
  );
}
