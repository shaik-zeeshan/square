import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { commands } from '~/lib/tauri';
import { useJellyfin } from '~/components/jellyfin-provider';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client';
import type { Track, OpenPanel, Chapter } from '~/components/video/types';
import {
  DEFAULT_AUDIO_LANG,
  DEFAULT_SUBTITLE_LANG,
} from '~/components/video/types';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useVideoPlayback(itemId: () => string, itemDetails: any) {
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
    chapters: [] as Chapter[],
    duration: 0,
    showControls: true,
    controlsLocked: false,
    url: '',
    currentItemId: itemId(),
    isHoveringControls: false,
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

    // Only set timeout to hide if not hovering over controls
    if (!state.isHoveringControls) {
      const timeout = setTimeout(() => {
        setState('showControls', false);
        commands.toggleTitlebarHide(true);
      }, 1000);

      setHideControlsTimeout(timeout);
    }
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

  const navigateToChapter = (chapter: Chapter) => {
    // Convert ticks to seconds (1 tick = 100 nanoseconds = 0.0000001 seconds)
    const startTimeSeconds = chapter.startPositionTicks / 10000000;
    console.log('Navigating to chapter:', chapter.name, 'at time:', startTimeSeconds);
    
    // Use relative time approach like handleProgressClick
    const currentTime = Number(state.currentTime);
    const relativeTime = startTimeSeconds - currentTime;
    
    console.log('Current time:', currentTime, 'Target time:', startTimeSeconds, 'Relative time:', relativeTime);
    
    // Only call the seek command - let the 'playback-time' event update the state
    console.log('Calling playbackSeek with relative time:', relativeTime);
    commands.playbackSeek(relativeTime);
    
    // Don't immediately update state - let Tauri's playback-time event handle it
    // This prevents the state from being overwritten by stale time events
  };

  const handleProgressClick = (value: number) => {
    if (state.duration === 0) return;
    const newTime = (value / 100) * state.duration;
    let relativeTime = newTime - Number(state.currentTime);
    console.log('Progress click - Current time:', state.currentTime, 'New time:', newTime, 'Relative time:', relativeTime);
    commands.playbackSeek(relativeTime);
    setState('currentTime', newTime.toString());
  };

  const loadNewVideo = (url: string, newItemId: string) => {
    setState('url', url);
    setState('currentItemId', newItemId);
    setState('currentTime', '0');
    setState('duration', 0);
    setState('playing', true);
    commands.playbackLoad(url);
  };

  const handleControlMouseEnter = () => {
    setState('isHoveringControls', true);
    // Clear any existing timeout when entering control area
    const existing = hideControlsTimeout();
    if (existing) clearTimeout(existing);
  };

  const handleControlMouseLeave = () => {
    setState('isHoveringControls', false);
    // Start timeout to hide controls when leaving control area
    if (!state.controlsLocked) {
      const timeout = setTimeout(() => {
        setState('showControls', false);
        commands.toggleTitlebarHide(true);
      }, 1000);
      setHideControlsTimeout(timeout);
    }
  };

  createEffect(async () => {
    const currentItemId = itemId();
    let token = jf.api?.accessToken;
    let basePath = jf.api?.basePath;

    if (!token || !jf.api || !currentItemId) {
      return;
    }

    let url = `${basePath}/Videos/${currentItemId}/Stream?api_key=${token}&container=mp4&static=true`;
    console.log('Loading video:', url);
    setState('url', url);
    setState('currentItemId', currentItemId);
    setState('currentTime', '0');
    setState('duration', 0);
    
    // Process chapters from item details
    console.log('Item details:', itemDetails.data);
    console.log('All item details keys:', Object.keys(itemDetails.data || {}));
    
    let chapters: Chapter[] = [];
    
    // Check for chapters in different possible fields
    if (itemDetails.data?.Chapters) {
      console.log('Found chapters in Chapters field:', itemDetails.data.Chapters);
      if (Array.isArray(itemDetails.data.Chapters)) {
        chapters = itemDetails.data.Chapters.map((chapter: any) => ({
          startPositionTicks: chapter.StartPositionTicks || 0,
          name: chapter.Name || null,
          imagePath: chapter.ImagePath || null,
          imageDateModified: chapter.ImageDateModified || null,
          imageTag: chapter.ImageTag || null,
        }));
      } else if (typeof itemDetails.data.Chapters === 'string') {
        // Handle case where chapters are stored as JSON string
        try {
          const chaptersData = JSON.parse(itemDetails.data.Chapters);
          console.log('Found chapters as JSON string:', chaptersData);
          chapters = chaptersData.map((chapter: any) => ({
            startPositionTicks: chapter.StartPositionTicks || 0,
            name: chapter.Name || null,
            imagePath: chapter.ImagePath || null,
            imageDateModified: chapter.ImageDateModified || null,
            imageTag: chapter.ImageTag || null,
          }));
        } catch (e) {
          console.error('Failed to parse chapters JSON:', e);
        }
      }
    } else if (itemDetails.data?.MediaSources?.[0]?.Chapters) {
      console.log('Found chapters in MediaSources field:', itemDetails.data.MediaSources[0].Chapters);
      chapters = itemDetails.data.MediaSources[0].Chapters.map((chapter: any) => ({
        startPositionTicks: chapter.StartPositionTicks || 0,
        name: chapter.Name || null,
        imagePath: chapter.ImagePath || null,
        imageDateModified: chapter.ImageDateModified || null,
        imageTag: chapter.ImageTag || null,
      }));
    } else {
      // Check all possible fields that might contain chapter data
      const possibleFields = ['Chapters', 'ChapterInfo', 'ChapterList', 'MediaChapters'];
      for (const field of possibleFields) {
        if (itemDetails.data?.[field]) {
          console.log(`Found potential chapters in ${field}:`, itemDetails.data[field]);
          if (typeof itemDetails.data[field] === 'string') {
            try {
              const chaptersData = JSON.parse(itemDetails.data[field]);
              chapters = chaptersData.map((chapter: any) => ({
                startPositionTicks: chapter.StartPositionTicks || 0,
                name: chapter.Name || null,
                imagePath: chapter.ImagePath || null,
                imageDateModified: chapter.ImageDateModified || null,
                imageTag: chapter.ImageTag || null,
              }));
              break;
            } catch (e) {
              console.error(`Failed to parse ${field} JSON:`, e);
            }
          }
        }
      }
    }
    
    console.log('Processed chapters:', chapters);
    setState('chapters', chapters);
    
    commands.playbackLoad(url);
    commands.playbackPlay();
  });

  

  createEffect(async () => {
    const currentItemId = itemId();
    // Clean up existing listeners when itemId changes
    unlistenFuncs.forEach((unlisten) => {
      unlisten();
    });
    unlistenFuncs = [];

    const fileLoaded = await listen('file-loaded', (event) => {
      console.log('File loaded');
      commands.playbackPlay();
    });

    unlistenFuncs.push(fileLoaded);

    const playbackTime = await listen('playback-time', async (event) => {
      const newTime = event.payload as string;
      console.log('Playback time event received:', newTime);
      setState('currentTime', newTime);

      // Report progress to Jellyfin every 3 seconds
      const now = Date.now();
      if (now - lastProgressReportTime >= 3000 && jf.api) {
        lastProgressReportTime = now;
        try {
          const playstateApi = getPlaystateApi(jf.api);
          await playstateApi.reportPlaybackProgress({
            playbackProgressInfo: {
              ItemId: currentItemId,
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
            ItemId: currentItemId,
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
            ItemId: itemId(),
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
    loadNewVideo,
    handleControlMouseEnter,
    handleControlMouseLeave,
    navigateToChapter,
  };
}
