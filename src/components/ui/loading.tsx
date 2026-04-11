import { splitProps } from "solid-js";
import { cn } from "~/lib/utils";
import { UserDropdown } from "../user-dropdown";

export interface LoadingProps {
  /** Custom loading message */
  message?: string;
  /** Loading size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show a full-screen backdrop */
  backdrop?: boolean;
  /** Additional CSS classes */
  class?: string;
}

// ── Shared amber ring spinner ─────────────────────────────────────────────────
const ringSize = {
  sm: { outer: "h-5 w-5", inner: "h-1.5 w-1.5", text: "text-xs" },
  md: { outer: "h-8 w-8", inner: "h-2 w-2", text: "text-sm" },
  lg: { outer: "h-12 w-12", inner: "h-3 w-3", text: "text-base" },
} as const;

function AmberSpinner(props: { size?: "sm" | "md" | "lg"; class?: string }) {
  const sz = () => ringSize[props.size ?? "md"];

  return (
    <div
      class={cn("relative flex items-center justify-center", props.class)}
      style={{ "flex-shrink": 0 }}
    >
      {/* Outer dim track */}
      <div
        class={cn("rounded-full border-2 border-white/[0.08]", sz().outer)}
      />
      {/* Spinning amber arc */}
      <div
        class={cn(
          "absolute rounded-full border-2 border-transparent border-t-amber-400/80",
          sz().outer
        )}
        style={{ animation: "spinRing 900ms linear infinite" }}
      />
      {/* Centre dot */}
      <div
        class={cn("absolute rounded-full bg-amber-400/50", sz().inner)}
        style={{ animation: "pulse 1.8s ease-in-out infinite" }}
      />
    </div>
  );
}

// ── Loading (inline or with backdrop) ────────────────────────────────────────
export function Loading(props: LoadingProps) {
  const size = props.size ?? "md";
  const backdrop = props.backdrop ?? true;

  const content = (
    <div class={cn("flex items-center gap-2.5", props.class)}>
      <AmberSpinner size={size} />
      {props.message && (
        <span class={cn("font-medium text-white/50", ringSize[size].text)}>
          {props.message}
        </span>
      )}
    </div>
  );

  if (backdrop) {
    return (
      <div class="fixed inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}

// ── Full page transition state ────────────────────────────────────────────────
export function PageLoading() {
  return (
    <div
      class={cn(
        "isolate flex min-h-screen flex-col items-center justify-center",
        "bg-[oklch(0.085_0_0)]"
      )}
      style={{
        animation: "fadeSlideUp 350ms cubic-bezier(0.22,1,0.36,1) both",
      }}
    >
      {/* User dropdown accessible during route transitions */}
      <div class="absolute top-5 right-5 z-20">
        <UserDropdown variant="dark" />
      </div>

      {/* Spinner + label */}
      <div class="flex flex-col items-center gap-4">
        <AmberSpinner size="lg" />
        <p
          class="font-medium text-sm text-white/30 tracking-wide"
          style={{
            animation:
              "fadeSlideUp 400ms 150ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          Loading…
        </p>
      </div>
    </div>
  );
}

// ── Inline, no backdrop ───────────────────────────────────────────────────────
export function InlineLoading(props: Omit<LoadingProps, "backdrop">) {
  const [{ class: classes }, others] = splitProps(props, ["class"]);

  return (
    <Loading
      backdrop={false}
      class={cn("text-white/60", classes)}
      {...others}
    />
  );
}

// ── Used when a section of a page is loading ─────────────────────────────────
export function FullscreenLoading() {
  return <Loading backdrop={false} size="lg" />;
}
