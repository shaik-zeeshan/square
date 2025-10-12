import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { commands } from '~/lib/tauri';
import { useJellyfin } from '~/components/jellyfin-provider';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client';
import type { Track, OpenPanel } from '~/components/video/types';
import {
  DEFAULT_AUDIO_LANG,
  DEFAULT_SUBTITLE_LANG,
} from '~/components/video/types';
import { getCurrentWindow } from '@tauri-apps/api/window';


export function useVideoPlayback(itemId: string, itemDetails: any) {
  const jf = useJellyfin();

  let [state, setState] = createStore({
    audioIndex: -1,
    subtitleIndex: -1,
    currentTime: '',
    playing: true,
    volume: 100,
    isMuted: false,
    playbackSpeed: 1,
    audioList: [] as Track[],
    subtitleList: [] as Track[],
    duration: 0,
    showControls: true,
    controlsLocked: false,
    url: '',
  });

  const [openPanel, setOpenPanel] = createSignal<OpenPanel>(null);
  const [hideControlsTimeout, setHideControlsTimeout] =
    createSignal<NodeJS.Timeout>();

  let unlistenFuncs: UnlistenFn[] = [];

  // Jellyfin playback reporting
  const playSessionId = crypto.randomUUID();
  let lastProgressReportTime = 0;

  const showControls = async () => {
    if (state.controlsLocked) return;
    setState('showControls', true);
    commands.toggleTitlebarHide(false);

    const existing = hideControlsTimeout();
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      commands.toggleTitlebarHide(true);
    }, 1000);

    setHideControlsTimeout(timeout);
  };

  const toggleControlsLock = () => {
    setState('controlsLocked', !state.controlsLocked);
    if (!state.controlsLocked) {
      // When unlocking, show controls immediately
      setState('showControls', true);
      commands.toggleTitlebarHide(false);
      // Clear any existing timeout
      const existing = hideControlsTimeout();
      if (existing) clearTimeout(existing);
    } else {
      // When locking, hide controls immediately
      setState('showControls', false);
      commands.toggleTitlebarHide(true);
      const existing = hideControlsTimeout();
      if (existing) clearTimeout(existing);
    }
  };

  const togglePlay = () => {
    if (state.playing) {
      commands.playbackPause();
    } else {
      commands.playbackPlay();
    }
  };

  const toggleMute = () => {
    if (state.isMuted) {
      const lastVolume = state.volume || 100;
      commands.playbackVolume(lastVolume);
      setState('volume', lastVolume);
      setState('isMuted', false);
    } else {
      commands.playbackVolume(0);
      setState('isMuted', true);
    }
  };

  const handleVolumeChange = (value: number) => {
    const newVolume = Math.round(value);
    commands.playbackVolume(newVolume);
    setState('volume', newVolume);
    setState('isMuted', newVolume === 0);
  };

  const setSpeed = (speed: number) => {
    commands.playbackSpeed(speed);
    setState('playbackSpeed', speed);
  };

  const handleProgressClick = (value: number) => {
    if (state.duration === 0) return;
    const newTime = (value / 100) * state.duration;
    let relativeTime = newTime - Number(state.currentTime);
    commands.playbackSeek(relativeTime);
    setState('currentTime', newTime.toString());
  };

  onMount(async () => {
    let token = jf.api?.accessToken;
    let basePath = jf.api?.basePath;

    if (!token || !jf.api) {
      return;
    }

    let url = `${basePath}/Videos/${itemId}/Stream?api_key=${token}&container=mp4&static=true`;
    setState('url', url);

    commands.playbackLoad(url);
  });

  createEffect(async () => {
    const playbackTime = await listen('playback-time', async (event) => {
      setState('currentTime', event.payload as string);

      // Report progress to Jellyfin every 3 seconds
      const now = Date.now();
      if (now - lastProgressReportTime >= 3000 && jf.api) {
        lastProgressReportTime = now;
        try {
          const playstateApi = getPlaystateApi(jf.api);
          await playstateApi.reportPlaybackProgress({
            playbackProgressInfo: {
              ItemId: itemId,
              PlaySessionId: playSessionId,
              PositionTicks: Math.floor(Number(state.currentTime) * 10000000),
              IsPaused: !state.playing,
              IsMuted: state.isMuted,
              VolumeLevel: Math.min(state.volume, 100),
              CanSeek: true,
              PlayMethod: PlayMethod.DirectStream,
              AudioStreamIndex:
                state.audioIndex >= 0 ? state.audioIndex : undefined,
              SubtitleStreamIndex:
                state.subtitleIndex > 0 ? state.subtitleIndex : undefined,
            },
          });
        } catch (error) {
          console.error('Failed to report playback progress:', error);
        }
      }
    });

    unlistenFuncs.push(playbackTime);

    const pause = await listen('pause', (event) => {
      setState('playing', !(event.payload as boolean));
    });

    unlistenFuncs.push(pause);

    const audioList = await listen('audio-list', (event) => {
      setState('audioList', event.payload as Track[]);
      if (state.audioIndex >= -1) return;
      let defaultAudio = (event.payload as Track[]).find((track) =>
        DEFAULT_AUDIO_LANG.includes(track.lang ?? '')
      );
      if (defaultAudio) {
        commands.playbackChangeAudio(defaultAudio.id.toString());
        setState('audioIndex', defaultAudio.id as number);
      } else if (state.audioList.length > 0) {
        commands.playbackChangeAudio(state.audioList[0].id.toString());
        setState('audioIndex', state.audioList[0].id);
      }
    });

    unlistenFuncs.push(audioList);

    const subtitleList = await listen('subtitle-list', (event) => {
      setState('subtitleList', event.payload as Track[]);
      if (state.subtitleIndex >= -1) return;
      let defaultSubtitle = (event.payload as Track[]).find((track) =>
        DEFAULT_SUBTITLE_LANG.includes(track.lang ?? '')
      );
      if (defaultSubtitle) {
        commands.playbackChangeSubtitle(defaultSubtitle.id.toString());
        setState('subtitleIndex', defaultSubtitle.id);
      }
    });

    unlistenFuncs.push(subtitleList);

    const duration = await listen('duration', async (event) => {
      setState('duration', Number(event.payload as string));

      // Resume from saved position if available
      const savedPosition = itemDetails.data?.UserData?.PlaybackPositionTicks;
      if (savedPosition && savedPosition > 0) {
        // Convert ticks to seconds (1 tick = 0.0000001 seconds)
        const savedSeconds = savedPosition / 10000000;
        // Only resume if not near the end (more than 5% remaining)
        const duration = Number(event.payload as string);
        if (savedSeconds < duration * 0.95) {
          commands.playbackSeek(savedSeconds);
          setState('currentTime', savedSeconds.toString());
        }
      }

      try {
        if (!jf.api) return;
        const playstateApi = getPlaystateApi(jf.api);
        await playstateApi.reportPlaybackStart({
          playbackStartInfo: {
            ItemId: itemId,
            PlaySessionId: playSessionId,
            CanSeek: true,
            IsPaused: false,
            IsMuted: state.isMuted,
            VolumeLevel: Math.min(state.volume, 100), // Clamp to 100 for Jellyfin
            PlayMethod: PlayMethod.DirectStream,
            AudioStreamIndex:
              state.audioIndex >= 0 ? state.audioIndex : undefined,
            SubtitleStreamIndex:
              state.subtitleIndex > 0 ? state.subtitleIndex : undefined,
          },
        });

        // Initialize last progress report time
        lastProgressReportTime = Date.now();
      } catch (error) {
        console.error('Failed to report playback start:', error);
      }
    });

    unlistenFuncs.push(duration);

    const aid = await listen('aid', (event) => {
      setState('audioIndex', Number(event.payload as string));
    });

    unlistenFuncs.push(aid);

    const sid = await listen('sid', (event) => {
      setState('subtitleIndex', Number(event.payload as string));
    });

    unlistenFuncs.push(sid);

    const speed = await listen('speed', (event) => {
      setState('playbackSpeed', Number(event.payload as string));
    });

    unlistenFuncs.push(speed);
  });

  const offFullscreenIfOnWhenCleanup = async () => {
    const window = getCurrentWindow();
    if (await window.isFullscreen()) {
      commands.toggleFullscreen();
    }
  };

  onCleanup(async () => {
    offFullscreenIfOnWhenCleanup();
    unlistenFuncs.forEach((unlisten) => {
      unlisten();
    });
    clearTimeout(hideControlsTimeout());

    // Report playback stopped to Jellyfin
    if (jf.api) {
      try {
        const playstateApi = getPlaystateApi(jf.api);
        await playstateApi.reportPlaybackStopped({
          playbackStopInfo: {
            ItemId: itemId,
            PlaySessionId: playSessionId,
            PositionTicks: Math.floor(Number(state.currentTime) * 10000000),
          },
        });
      } catch (error) {
        console.error('Failed to report playback stopped:', error);
      }
    }

    commands.toggleTitlebarHide(false);
    commands.playbackClear();
  });

  return {
    state,
    setState,
    openPanel,
    setOpenPanel,
    showControls,
    toggleControlsLock,
    togglePlay,
    toggleMute,
    handleVolumeChange,
    setSpeed,
    handleProgressClick,
  };
}
