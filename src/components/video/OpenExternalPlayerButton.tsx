import { openUrl } from "@tauri-apps/plugin-opener";
import { showErrorToast } from "../../lib/toast";
import { type ExternalPlayerId, getPlayerMeta } from "./external-players";

interface OpenExternalPlayerButtonProps {
  url: string;
  player: ExternalPlayerId;
  beforePlaying?: () => void;
}

export const OpenExternalPlayerButton = (
  props: OpenExternalPlayerButtonProps
) => {
  const open = async () => {
    if (props.beforePlaying) {
      props.beforePlaying();
    }
    const meta = getPlayerMeta(props.player);
    try {
      await openUrl(props.url, meta.openWith);
    } catch (err) {
      showErrorToast(`Failed to open in ${meta.label}`);
    }
  };

  return (
    <button
      class="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        open();
      }}
    >
      <span class="text-white text-xs">
        ▶ {getPlayerMeta(props.player).label}
      </span>
    </button>
  );
};
