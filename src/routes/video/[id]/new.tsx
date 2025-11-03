import type { RouteSectionProps } from "@solidjs/router";
import { splitProps } from "solid-js";
import { ShowOSD } from "~/components/video-osd";
import { VideoProgressBar } from "~/components/video-progress-bar";
import { useVideo } from "~/hooks/useVideo";
import { useVideoShortcuts } from "~/hooks/useVideoShortcuts";

export default function Page(props: RouteSectionProps) {
  const [{ params }] = splitProps(props, ["params"]);

  useVideo(params.id);

  useVideoShortcuts("mpv");

  return (
    <div>
      <ShowOSD />
      <VideoProgressBar />
    </div>
  );
}
