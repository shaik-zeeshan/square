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

export interface GlassVolumeSliderProps
  extends Omit<ComponentProps<"div">, "onChange">,
    VariantProps<typeof sliderVariants> {
  value: number; // 0-200
  onChange: (value: number) => void;
  maxVolume?: number; // default 200
}

export function GlassVolumeSlider(props: GlassVolumeSliderProps) {
  const [local, others] = splitProps(props, [
    "class",
    "variant",
    "size",
    "value",
    "onChange",
    "maxVolume",
  ]);

  const maxVolume = () => local.maxVolume ?? 200;
  const normalMax = 100;

  const handleClick = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * maxVolume();
    local.onChange(Math.min(Math.max(percentage, 0), maxVolume()));
  };

  // Calculate fill percentages
  // White bar: 0-100 volume maps to 0-100% of slider width
  const baseFillPercentage = () => {
    const clampedValue = Math.min(local.value, normalMax);
    return (clampedValue / normalMax) * 100;
  };

  // Orange bar: 100-200 volume maps to 0-100% of slider width (appears on top of white)
  const warningFillPercentage = () => {
    if (local.value <= normalMax) {
      return 0;
    }
    const overVolume = local.value - normalMax;
    return (overVolume / normalMax) * 100;
  };

  return (
    <div
      aria-valuemax={maxVolume()}
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
      {/* Base fill (white) - 0 to 100% volume (0-100% of slider width) */}
      <div
        class={sliderFillVariants({ variant: local.variant })}
        style={{ width: `${baseFillPercentage()}%` }}
      />

      {/* Warning fill (orange) - 100-200% volume (0-100% of slider width, overlays on top) */}
      <div
        class="absolute top-0 left-0 h-full rounded-full bg-orange-500 transition-all duration-200"
        style={{
          width: `${warningFillPercentage()}%`,
          opacity: warningFillPercentage() > 0 ? 0.9 : 0,
        }}
      />
    </div>
  );
}
