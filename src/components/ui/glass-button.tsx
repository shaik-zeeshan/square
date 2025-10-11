import { type ComponentProps, splitProps } from 'solid-js';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center backdrop-blur-md border transition-all duration-[var(--glass-transition-base)] cursor-pointer disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        glass: 'bg-[var(--glass-bg-light)] border-[var(--glass-border-light)] hover:bg-[var(--glass-bg-medium)] hover:border-[var(--glass-border-medium)] active:scale-95',
        'glass-subtle': 'bg-[var(--glass-bg-subtle)] border-[var(--glass-border-subtle)] hover:bg-[var(--glass-bg-light)] hover:border-[var(--glass-border-light)] active:scale-95',
        'glass-strong': 'bg-[var(--glass-bg-medium)] border-[var(--glass-border-medium)] hover:bg-[var(--glass-bg-heavy)] hover:border-[var(--glass-border-strong)] active:scale-95',
        solid: 'bg-primary text-primary-foreground border-transparent hover:opacity-90 active:scale-95',
        ghost: 'bg-transparent border-transparent hover:bg-[var(--glass-bg-subtle)] active:scale-95',
        outline: 'bg-transparent border-[var(--glass-border-medium)] hover:bg-[var(--glass-bg-subtle)]',
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-md',
        md: 'h-10 px-4 text-base rounded-lg',
        lg: 'h-12 px-6 text-lg rounded-xl',
        icon: 'h-10 w-10 rounded-md',
        'icon-sm': 'h-8 w-8 rounded-md',
        'icon-lg': 'h-12 w-12 rounded-lg',
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

export interface GlassButtonProps
  extends ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {}

export function GlassButton(props: GlassButtonProps) {
  const [local, others] = splitProps(props, [
    'class',
    'variant',
    'size',
    'blur',
    'children',
  ]);

  return (
    <button
      class={cn(
        buttonVariants({
          variant: local.variant,
          size: local.size,
          blur: local.blur,
        }),
        local.class
      )}
      {...others}
    >
      {local.children}
    </button>
  );
}

