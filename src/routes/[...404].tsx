import { A } from '@solidjs/router';
import { GlassButton, GlassCard } from '~/components/ui';

export default function NotFound() {
  return (
    <main class="grid h-full w-full place-items-center p-4">
      <div class="text-center">
        <h1 class="mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text font-bold text-8xl text-transparent">
          404
        </h1>
        <GlassCard class="space-y-6 p-8" preset="card">
          <div class="space-y-2">
            <h2 class="font-semibold text-3xl">Page Not Found</h2>
            <p class="opacity-70">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          <div class="flex justify-center gap-4">
            <A href="/">
              <GlassButton variant="glass">Go Home</GlassButton>
            </A>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
