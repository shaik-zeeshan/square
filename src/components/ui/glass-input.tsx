import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

const inputVariants = cva(
  "w-full border outline-none transition-all duration-200 focus:outline-none",
  {
    variants: {
      variant: {
        solid:
          "border-input bg-background placeholder:text-muted-foreground focus:border-ring",
        default:
          "border-gray-300 bg-white placeholder:text-gray-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:focus:border-blue-400 dark:placeholder:text-gray-400",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-sm",
        md: "h-10 rounded-lg px-4 text-base",
        lg: "h-12 rounded-xl px-5 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface GlassInputProps
  extends Omit<ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  class?: string;
}

export function GlassInput(props: GlassInputProps) {
  const [local, others] = splitProps(props, ["class", "variant", "size"]);

  return (
    <input
      class={cn(
        inputVariants({
          variant: local.variant,
          size: local.size,
        }),
        local.class
      )}
      {...others}
    />
  );
}
