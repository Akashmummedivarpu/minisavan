import React, { createContext, useEffect, useState, useCallback } from 'react';
import { audioManager, type AudioState } from '../core/AudioManager';
import { useRoomStore } from '../store';

interface AudioContextType extends AudioState {
  play: (url?: string, metadata?: MediaMetadataInit) => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  playNext: () => void;
  playPrevious: () => void;
}

export const AudioContext = createContext<AudioContextType | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playbackRate: 1,
    isLoading: false,
    hasError: false
  });

  // Connect to Zustand store for queue/playlist management
  const { playNext, playPrevious } = useRoomStore();

  useEffect(() => {
    const handleTrackEnd = () => {
      // Auto-play next track when current ends
      playNext();
    };

    const unsubscribe = audioManager.subscribe(
      (newState) => setAudioState(newState),
      handleTrackEnd
    );

    return () => unsubscribe();
  }, [playNext]);

  // Hook up Media Session handlers
  useEffect(() => {
    audioManager.setMediaSessionActionHandlers({
      onPlay: () => {
        // Sync room store state with media session playback
        const { togglePlay, roomId, roomRole, isPlaying } = useRoomStore.getState();
        if (!roomId || roomRole !== 'MEMBER') {
          if (!isPlaying) togglePlay();
        }
      },
      onPause: () => {
        // Sync room store state with media session pause
        const { togglePlay, roomId, roomRole, isPlaying } = useRoomStore.getState();
        if (!roomId || roomRole !== 'MEMBER') {
          if (isPlaying) togglePlay();
        }
      },
      onNext: playNext,
      onPrevious: playPrevious,
    });
  }, [playNext, playPrevious]);

  const play = useCallback((url?: string, metadata?: MediaMetadataInit) => audioManager.play(url, metadata), []);
  const pause = useCallback(() => audioManager.pause(), []);
  const togglePlay = useCallback(() => audioManager.togglePlay(), []);
  const seek = useCallback((time: number) => audioManager.seek(time), []);
  const setVolume = useCallback((vol: number) => audioManager.setVolume(vol), []);
  const setPlaybackRate = useCallback((rate: number) => audioManager.setPlaybackRate(rate), []);

  const value: AudioContextType = {
    ...audioState,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    setPlaybackRate,
    playNext,
    playPrevious,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};
