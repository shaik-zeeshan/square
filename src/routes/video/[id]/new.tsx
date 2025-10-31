import type { RouteSectionProps } from "@solidjs/router";
import { splitProps } from "solid-js";
import { VideoProgressBar } from "~/components/video-progress-bar";
import { useVideo } from "~/hooks/useVideo";
import { useVideoShortcuts } from "~/hooks/useVideoShortcuts";

function formatTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "UTC",
  });
}

export default function Page(props: RouteSectionProps) {
  const [{ params }] = splitProps(props, ["params"]);

  const _ = useVideo(params.id);

  useVideoShortcuts("mpv");

  return (
    <div>
      <VideoProgressBar />
    </div>
  );
}
