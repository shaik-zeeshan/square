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
  let timeout: NodeJS.Timeout | null = null;

  const listener = (event: Event<PhysicalPosition>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => callback(event), delay);
  };

  const cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return { listener, cancel };
}

export default function PipPage() {
  const [state, setState] = useVideoContext();
  let isRecoveringFromPip = false;
  let cancelPendingMoveEnd: (() => void) | null = null;

  const recoverFromPip = async () => {
    if (isRecoveringFromPip) {
      return;
    }

    cancelPendingMoveEnd?.();
    isRecoveringFromPip = true;
    setState("isPipTransitioning", true);
    try {
      setState("isPip", false);

      try {
        await commands.hidePipWindow();
      } catch {
        // window may already be destroyed from external PiP controls
      }

      const windows = await getAllWindows();
      const main = windows.find((win) => win.label === "main");

      if (!main) {
        return;
      }

      await main.setFocus();
      await main.show();
    } finally {
      isRecoveringFromPip = false;
      setState("isPipTransitioning", false);
    }
  };

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

      const monitorOriginX = monitor.position.x;
      const monitorOriginY = monitor.position.y;

      const [x, y] = nearestCorner(
        event.payload.x - monitorOriginX,
        event.payload.y - monitorOriginY,
        monitor.size.width,
        monitor.size.height,
        windowSize.width,
        windowSize.height,
        16 // padding
      );

      window.setPosition(
        new PhysicalPosition(x + monitorOriginX, y + monitorOriginY)
      );
    };

    const { listener: onMovedListener, cancel: cancelMoveEnd } = onMoveEnd(
      onMoveWindow,
      300
    );
    cancelPendingMoveEnd = cancelMoveEnd;

    const unlistenMoved = await window.onMoved(onMovedListener);
    const unlistenCloseRequested = await window.onCloseRequested((event) => {
      event.preventDefault();

      recoverFromPip().catch(() => {
        // no-op: close/destroy recovery should not block teardown
      });
    });
    const unlistenDestroyed = await window.listen("tauri://destroyed", () => {
      recoverFromPip().catch(() => {
        // no-op: close/destroy recovery should not block teardown
      });
    });

    onCleanup(() => {
      cancelPendingMoveEnd?.();
      cancelPendingMoveEnd = null;
      unlistenMoved();
      unlistenCloseRequested();
      unlistenDestroyed();
    });
  });

  const handleClose = async () => {
    await recoverFromPip();
  };

  const handleTogglePlay = async () => {
    if (state.pause) {
      await commands.playbackPlay();
      setState("pause", false);
      return;
    }

    await commands.playbackPause();
    setState("pause", true);
  };

  return (
    <div class="h-full w-full bg-transparent" data-tauri-drag-region>
      <PipControls
        isPlaying={!state.pause}
        onClose={handleClose}
        onTogglePlay={handleTogglePlay}
      />
    </div>
  );
}
