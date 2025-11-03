import type { Event } from "@tauri-apps/api/event";
import {
  currentMonitor,
  getAllWindows,
  getCurrentWindow,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { onCleanup, onMount } from "solid-js";
import PipControls from "~/components/video/PipControls";
import { useVideoContext } from "~/contexts/video-context";
import { commands } from "~/lib/tauri";

function nearestCorner(
  currentX: number,
  currentY: number,
  screenWidth: number,
  screenHeight: number,
  windowWidth: number,
  windowHeight: number,
  padding: number
): [number, number] {
  const corners: [number, number][] = [
    [padding, padding], // TopLeft
    [screenWidth - windowWidth - padding, padding], // TopRight
    [padding, screenHeight - windowHeight - padding], // BottomLeft
    [
      screenWidth - windowWidth - padding,
      screenHeight - windowHeight - padding,
    ], // BottomRight
  ];

  let nearest = corners[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const [cx, cy] of corners) {
    const dx = currentX - cx;
    const dy = currentY - cy;
    const distance = dx * dx + dy * dy;

    if (distance < minDistance) {
      minDistance = distance;
      nearest = [cx, cy];
    }
  }

  return nearest;
}

function onMoveEnd(
  callback: (event: Event<PhysicalPosition>) => Promise<void>,
  delay = 200
) {
  let timeout: NodeJS.Timeout;
  return (event: Event<PhysicalPosition>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(event), delay);
  };
}

export default function PipPage() {
  const [state, setState] = useVideoContext();

  onMount(async () => {
    const window = getCurrentWindow();

    if (window.label !== "pip") {
      return;
    }

    const onMoveWindow = async (event: Event<PhysicalPosition>) => {
      const monitor = await currentMonitor();
      const windowSize = await window.outerSize();

      if (!monitor) {
        return;
      }

      const [x, y] = nearestCorner(
        event.payload.x,
        event.payload.y,
        monitor.size.width,
        monitor.size.height,
        windowSize.width,
        windowSize.height,
        16 // padding
      );

      window.setPosition(new PhysicalPosition(x, y));
    };

    const unlisten = await window.onMoved(onMoveEnd(onMoveWindow, 300));

    onCleanup(() => {
      unlisten();
    });
  });

  const handleClose = async () => {
    setState("isPip", () => false);
    await commands.hidePipWindow();
    const windows = await getAllWindows();
    const main = windows.find((win) => win.label === "main");

    if (!main) {
      return;
    }
    await main.setFocus();
    await main.show();
  };

  return (
    <div class="h-full w-full bg-transparent" data-tauri-drag-region>
      <PipControls
        isPlaying={!state.pause}
        onClose={handleClose}
        onTogglePlay={() => setState("pause", (value) => !value)}
      />
    </div>
  );
}
