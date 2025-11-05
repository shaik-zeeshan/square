import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center border transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        solid:
          "border-transparent bg-primary text-primary-foreground hover:opacity-90 active:scale-95",
        ghost:
          "border-transparent bg-transparent hover:bg-gray-100 active:scale-95 dark:hover:bg-gray-800",
        outline:
          "border-gray-300 bg-transparent hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-900",
        default:
          "border-gray-300 bg-white hover:bg-gray-50 active:scale-95 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-sm",
        md: "h-10 rounded-lg px-4 text-base",
        lg: "h-12 rounded-xl px-6 text-lg",
        icon: "h-10 w-10 rounded-md",
        "icon-sm": "h-8 w-8 rounded-md",
        "icon-lg": "h-12 w-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface GlassButtonProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

export function GlassButton(props: GlassButtonProps) {
  const [local, others] = splitProps(props, [
    "class",
    "variant",
    "size",
    "children",
  ]);

  return (
    <button
      class={cn(
        buttonVariants({
          variant: local.variant,
          size: local.size,
        }),
        local.class
      )}
      {...others}
    >
      {local.children}
    </button>
  );
}
