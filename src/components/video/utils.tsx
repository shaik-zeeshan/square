import { openUrl } from '@tauri-apps/plugin-opener';

export const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const OpenInIINAButton = (props: {
  url: string;
  beforePlaying?: () => void;
}) => {
  const params = [
    `url=${encodeURIComponent(props.url).replace(/'/g, '%27')}`,
    'mpv_input-ipc-server=/tmp/sreal',
  ];

  const openIninna = () => {
    if (props.beforePlaying) {
      props.beforePlaying();
    }
    const iinaurl = `iina://open?${params.join('&')}`;

    openUrl(iinaurl);
  };

  return (
    <button class="cursor-pointer" on:click={openIninna}>
      <span>
        <img src="https://raw.githubusercontent.com/iina/iina/master/iina/Assets.xcassets/AppIcon.appiconset/iina-icon-32.png" />
      </span>
    </button>
  );
};
