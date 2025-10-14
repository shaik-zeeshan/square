import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, splitProps } from 'solid-js';
import { cn } from '~/lib/utils';

const inputVariants = cva(
  'w-full border outline-none backdrop-blur-md transition-all duration-[var(--glass-transition-base)] focus:outline-none',
  {
    variants: {
      variant: {
        glass:
          'border-[var(--glass-border-light)] bg-[var(--glass-bg-light)] placeholder:text-white/40 focus:border-[var(--glass-border-medium)] focus:bg-[var(--glass-bg-medium)]',
        'glass-subtle':
          'border-[var(--glass-border-subtle)] bg-[var(--glass-bg-subtle)] placeholder:text-white/30 focus:border-[var(--glass-border-light)] focus:bg-[var(--glass-bg-light)]',
        solid:
          'border-input bg-background placeholder:text-muted-foreground focus:border-ring',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-sm',
        md: 'h-10 rounded-lg px-4 text-base',
        lg: 'h-12 rounded-xl px-5 text-lg',
      },
      blur: {
        subtle: 'backdrop-blur-[var(--glass-blur-subtle)]',
        medium: 'backdrop-blur-[var(--glass-blur-medium)]',
        strong: 'backdrop-blur-[var(--glass-blur-strong)]',
      },
    },
    defaultVariants: {
      variant: 'glass',
      size: 'md',
      blur: 'medium',
    },
  }
);

export interface GlassInputProps
  extends ComponentProps<'input'>,
    VariantProps<typeof inputVariants> {}

export function GlassInput(props: GlassInputProps) {
  const [local, others] = splitProps(props, [
    'class',
    'variant',
    'size',
    'blur',
  ]);

  return (
    <input
      class={cn(
        inputVariants({
          variant: local.variant,
          size: local.size,
          blur: local.blur,
        }),
        local.class
      )}
      {...others}
    />
  );
}
