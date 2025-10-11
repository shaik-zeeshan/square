import { A } from "@solidjs/router";
import { GlassButton, GlassCard } from "~/components/ui";

export default function NotFound() {
  return (
    <main class="h-full w-full grid place-items-center p-4">
      <div class="text-center">
        <h1 class="text-8xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
          404
        </h1>
        <GlassCard preset="card" class="p-8 space-y-6">
          <div class="space-y-2">
            <h2 class="text-3xl font-semibold">Page Not Found</h2>
            <p class="opacity-70">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          <div class="flex gap-4 justify-center">
            <A href="/">
              <GlassButton variant="glass">
                Go Home
              </GlassButton>
            </A>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
