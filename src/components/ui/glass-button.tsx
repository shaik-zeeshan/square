import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, splitProps } from 'solid-js';
import { cn } from '~/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center border backdrop-blur-md transition-all duration-[var(--glass-transition-base)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        glass:
          'border-[var(--glass-border-light)] bg-[var(--glass-bg-light)] hover:border-[var(--glass-border-medium)] hover:bg-[var(--glass-bg-medium)] active:scale-95',
        'glass-subtle':
          'border-[var(--glass-border-subtle)] bg-[var(--glass-bg-subtle)] hover:border-[var(--glass-border-light)] hover:bg-[var(--glass-bg-light)] active:scale-95',
        'glass-strong':
          'border-[var(--glass-border-medium)] bg-[var(--glass-bg-medium)] hover:border-[var(--glass-border-strong)] hover:bg-[var(--glass-bg-heavy)] active:scale-95',
        solid:
          'border-transparent bg-primary text-primary-foreground hover:opacity-90 active:scale-95',
        ghost:
          'border-transparent bg-transparent hover:bg-[var(--glass-bg-subtle)] active:scale-95',
        outline:
          'border-[var(--glass-border-medium)] bg-transparent hover:bg-[var(--glass-bg-subtle)]',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-sm',
        md: 'h-10 rounded-lg px-4 text-base',
        lg: 'h-12 rounded-xl px-6 text-lg',
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
