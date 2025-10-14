import { LoaderCircleIcon } from "lucide-solid";
import {  splitProps } from "solid-js";
import { cn } from "~/lib/utils";

export interface LoadingProps {
  /** Custom loading message */
  message?: string;
  /** Loading size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show backdrop */
  backdrop?: boolean;
  /** Additional CSS classes */
  class?: string;
}

export function Loading(props: LoadingProps) {
  const size = props.size || "md";
  const backdrop = props.backdrop ?? true;

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const content = (
    <div class={cn("flex", props.class)}>
      <div class="relative">
        <div>
          <LoaderCircleIcon class={cn(sizeClasses[size], "animate-spin text-inherit")} />
        </div>
      </div>
    </div>
  );

  if (backdrop) {
    return (
      <div class="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}

export function PageLoading() {
  return (
    <div class="min-h-screen bg-background flex items-center justify-center">
      <Loading size="lg" />
    </div>
  );
}

export function InlineLoading(props: Omit<LoadingProps, "backdrop">) {
  let [{ class: classes }, others] = splitProps(props, ['class']);

  return <Loading  backdrop={false} class={cn("text-foreground/80", classes)} {...others} />;
}

export function FullscreenLoading() {
  return <Loading size="lg" backdrop={false} />;
}
