import type { JSAnimation } from "animejs";
import {
  AudioLines,
  BookOpen,
  Captions,
  Gauge,
  Home,
  type LucideIcon,
  Maximize,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  animationPresets,
  createAnimeInstance,
  prefersReducedMotion,
  staggerAnimation,
} from "~/lib/anime-utils";

interface KeyboardShortcutsHelpProps {
  visible: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  icon: LucideIcon;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

export function KeyboardShortcutsHelp(props: KeyboardShortcutsHelpProps) {
  const [animationInstance, setAnimationInstance] = createSignal<JSAnimation[]>(
    []
  );

  let overlayRef!: HTMLDivElement;
  let containerRef!: HTMLDivElement;
  let sectionsRef!: HTMLDivElement;

  const shortcutSections: ShortcutSection[] = [
    {
      title: "Playback Controls",
      items: [
        { keys: ["Space", "K"], description: "Play/Pause", icon: Play },
        { keys: ["M"], description: "Mute/Unmute", icon: VolumeX },
        { keys: ["F"], description: "Toggle Fullscreen", icon: Maximize },
      ],
    },
    {
      title: "Seeking & Navigation",
      items: [
        { keys: ["←", "J"], description: "Seek -10s", icon: SkipBack },
        { keys: ["→", "L"], description: "Seek +10s", icon: SkipForward },
        { keys: ["↑"], description: "Seek +1m", icon: SkipForward },
        { keys: ["↓"], description: "Seek -1m", icon: SkipBack },
        { keys: ["Shift", "←"], description: "Frame step -1s", icon: SkipBack },
        {
          keys: ["Shift", "→"],
          description: "Frame step +1s",
          icon: SkipForward,
        },
        { keys: ["Home"], description: "Jump to start", icon: Home },
        { keys: ["End"], description: "Jump to end", icon: SkipForward },
      ],
    },
    {
      title: "Volume Control",
      items: [
        { keys: ["+", "="], description: "Volume up", icon: Volume2 },
        { keys: ["-"], description: "Volume down", icon: VolumeX },
        {
          keys: ["Ctrl", "Scroll"],
          description: "Volume control",
          icon: Volume2,
        },
      ],
    },
    {
      title: "Speed & Quality",
      items: [
        { keys: ["["], description: "Speed down", icon: Gauge },
        { keys: ["]"], description: "Speed up", icon: Gauge },
        { keys: ["\\"], description: "Reset speed", icon: Gauge },
      ],
    },
    {
      title: "Audio & Subtitles",
      items: [
        { keys: ["A"], description: "Cycle audio tracks", icon: AudioLines },
        { keys: ["S"], description: "Cycle subtitles", icon: Captions },
      ],
    },
    {
      title: "Chapters",
      items: [
        { keys: ["C"], description: "Toggle chapters", icon: BookOpen },
        { keys: [","], description: "Previous chapter", icon: SkipBack },
        { keys: ["."], description: "Next chapter", icon: SkipForward },
      ],
    },
    {
      title: "Jump to Position",
      items: [
        { keys: ["0"], description: "Jump to 0%", icon: Home },
        { keys: ["1"], description: "Jump to 10%", icon: SkipForward },
        { keys: ["2"], description: "Jump to 20%", icon: SkipForward },
        { keys: ["3"], description: "Jump to 30%", icon: SkipForward },
        { keys: ["4"], description: "Jump to 40%", icon: SkipForward },
        { keys: ["5"], description: "Jump to 50%", icon: SkipForward },
        { keys: ["6"], description: "Jump to 60%", icon: SkipForward },
        { keys: ["7"], description: "Jump to 70%", icon: SkipForward },
        { keys: ["8"], description: "Jump to 80%", icon: SkipForward },
        { keys: ["9"], description: "Jump to 90%", icon: SkipForward },
      ],
    },
    {
      title: "Interface",
      items: [
        { keys: ["I", "?"], description: "Toggle help", icon: X },
        { keys: ["Esc"], description: "Close panels/Exit", icon: X },
      ],
    },
  ];

  onMount(() => {
    if (prefersReducedMotion()) {
      return;
    }

    // Use setTimeout to ensure refs are assigned
    setTimeout(() => {
      // Create overlay fade in
      const overlayAnimation = createAnimeInstance(overlayRef, {
        opacity: [0, 1],
        duration: 300,
        easing: "easeOutQuart",
      });

      // Create container slide in
      const containerAnimation = createAnimeInstance(containerRef, {
        ...animationPresets.fadeInScale,
        duration: 400,
        delay: 100,
      });

      // Create sections stagger animation
      const sectionElements =
        sectionsRef?.querySelectorAll(".shortcut-section");
      if (sectionElements) {
        const sectionsAnimation = staggerAnimation(
          Array.from(sectionElements) as HTMLElement[],
          {
            ...animationPresets.slideIn,
            translateY: [20, 0],
            opacity: [0, 1],
            duration: 400,
          },
          100
        );

        setAnimationInstance([
          overlayAnimation,
          containerAnimation,
          sectionsAnimation,
        ]);
      } else {
        setAnimationInstance([overlayAnimation, containerAnimation]);
      }
    }, 0);
  });

  onCleanup(() => {
    const instances = animationInstance();
    if (instances) {
      instances.forEach((instance: JSAnimation) => {
        if (instance && typeof instance.pause === "function") {
          instance.pause();
        }
      });
    }
  });

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === overlayRef) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "?" || e.key === "i" || e.key === "I") {
      props.onClose();
    }
  };

  return (
    <Show when={props.visible}>
      <div
        aria-label="Keyboard shortcuts help"
        aria-modal="true"
        class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={handleOverlayClick}
        onKeyDown={handleKeyDown}
        ref={overlayRef}
        role="dialog"
        tabindex="-1"
      >
        <div
          class="flex h-full w-full items-center justify-center p-4"
          ref={containerRef}
        >
          <div class="max-h-[90vh] w-full max-w-4xl overflow-y-auto">
            <div class="rounded-xl border border-white/20 bg-black/90 shadow-2xl backdrop-blur-md">
              {/* Header */}
              <div class="flex items-center justify-between border-white/20 border-b p-6">
                <h2 class="font-bold text-2xl text-white">
                  Keyboard Shortcuts
                </h2>
                <button
                  aria-label="Close help"
                  class="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={props.onClose}
                >
                  <X class="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div class="p-6" ref={sectionsRef}>
                <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                  <For each={shortcutSections}>
                    {(section) => (
                      <div class="shortcut-section">
                        <h3 class="mb-4 border-white/20 border-b pb-2 font-semibold text-lg text-white">
                          {section.title}
                        </h3>
                        <div class="space-y-3">
                          <For each={section.items}>
                            {(item) => (
                              <div class="flex items-center gap-3">
                                <div class="flex h-8 w-8 items-center justify-center rounded bg-white/10">
                                  <item.icon class="h-4 w-4 text-white/80" />
                                </div>
                                <div class="flex-1">
                                  <div class="flex flex-wrap gap-1">
                                    <For each={item.keys}>
                                      {(key, index) => (
                                        <>
                                          <kbd class="rounded bg-white/20 px-2 py-1 font-mono text-white text-xs">
                                            {key}
                                          </kbd>
                                          <Show
                                            when={
                                              index() < item.keys.length - 1
                                            }
                                          >
                                            <span class="text-white/50 text-xs">
                                              +
                                            </span>
                                          </Show>
                                        </>
                                      )}
                                    </For>
                                  </div>
                                  <div class="mt-1 text-sm text-white/70">
                                    {item.description}
                                  </div>
                                </div>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Footer */}
              <div class="border-white/20 border-t p-6">
                <p class="text-center text-sm text-white/60">
                  Press{" "}
                  <kbd class="rounded bg-white/20 px-2 py-1 font-mono text-xs">
                    Esc
                  </kbd>
                  ,
                  <kbd class="rounded bg-white/20 px-2 py-1 font-mono text-xs">
                    I
                  </kbd>
                  , or
                  <kbd class="rounded bg-white/20 px-2 py-1 font-mono text-xs">
                    ?
                  </kbd>{" "}
                  to close
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
