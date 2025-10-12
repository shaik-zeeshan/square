import { openUrl } from '@tauri-apps/plugin-opener';

interface OpenInIINAButtonProps {
  url: string;
  beforePlaying?: () => void;
}

export const OpenInIINAButton = (props: OpenInIINAButtonProps) => {
  const params = [
    `url=${encodeURIComponent(props.url).replace(/'/g, '%27')}`,
    `mpv_input-ipc-server=/tmp/sreal`,
  ];

  const openIninna = () => {
    if (props.beforePlaying) {
      props.beforePlaying();
    }
    let iinaurl = `iina://open?${params.join('&')}`;

    openUrl(iinaurl);
  };

  return (
    <button on:click={openIninna} class="cursor-pointer">
      <span>
        <img src="https://raw.githubusercontent.com/iina/iina/master/iina/Assets.xcassets/AppIcon.appiconset/iina-icon-32.png" />
      </span>
    </button>
  );
};
