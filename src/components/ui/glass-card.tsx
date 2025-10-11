import { type ComponentProps, splitProps } from 'solid-js';
import { cn } from '~/lib/utils';
import { getGlassClasses, type GlassVariants } from '~/lib/glass-utils';

export interface GlassCardProps
  extends ComponentProps<'div'>,
    GlassVariants {
  preset?: 'panel' | 'card' | 'overlay' | 'control' | 'dropdown';
}

export function GlassCard(props: GlassCardProps) {
  const [local, others] = splitProps(props, [
    'class',
    'preset',
    'blur',
    'background',
    'border',
    'shadow',
    'rounded',
    'elevation',
    'children',
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

