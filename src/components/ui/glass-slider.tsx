import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

const sliderVariants = cva(
  "group relative w-full cursor-pointer transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-gray-300 dark:bg-gray-600",
        subtle: "bg-gray-200 dark:bg-gray-700",
        strong: "bg-gray-400 dark:bg-gray-500",
      },
      size: {
        sm: "h-0.5 rounded-full hover:h-1",
        md: "h-1 rounded-full hover:h-1.5",
        lg: "h-1.5 rounded-full hover:h-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

const sliderFillVariants = cva(
  "absolute top-0 left-0 h-full rounded-full transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-blue-500",
        subtle: "bg-blue-400",
        strong: "bg-blue-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface GlassSliderProps
  extends Omit<ComponentProps<"div">, "onChange">,
    VariantProps<typeof sliderVariants> {
  value: number;
  onChange: (value: number) => void;
}

export function GlassSlider(props: GlassSliderProps) {
  const [local, others] = splitProps(props, [
    "class",
    "variant",
    "size",
    "value",
    "onChange",
  ]);

  const handleClick = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    local.onChange(Math.min(Math.max(percentage, 0), 100));
  };

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={local.value}
      class={cn(
        sliderVariants({ variant: local.variant, size: local.size }),
        local.class
      )}
      onClick={handleClick}
      role="slider"
      tabindex={0}
      {...others}
    >
      <div
        class={sliderFillVariants({ variant: local.variant })}
        style={{ width: `${local.value}%` }}
      />
    </div>
  );
}
