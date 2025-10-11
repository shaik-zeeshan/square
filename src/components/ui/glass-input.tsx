import { type ComponentProps, splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';

const inputVariants = cva(
  'w-full backdrop-blur-md border transition-all duration-[var(--glass-transition-base)] outline-none focus:outline-none',
  {
    variants: {
      variant: {
        glass: 'bg-[var(--glass-bg-light)] border-[var(--glass-border-light)] placeholder:text-white/40 focus:bg-[var(--glass-bg-medium)] focus:border-[var(--glass-border-medium)]',
        'glass-subtle': 'bg-[var(--glass-bg-subtle)] border-[var(--glass-border-subtle)] placeholder:text-white/30 focus:bg-[var(--glass-bg-light)] focus:border-[var(--glass-border-light)]',
        solid: 'bg-background border-input placeholder:text-muted-foreground focus:border-ring',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-md',
        md: 'h-10 px-4 text-base rounded-lg',
        lg: 'h-12 px-5 text-lg rounded-xl',
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

