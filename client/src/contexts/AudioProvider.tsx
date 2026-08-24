import React, { createContext, useEffect, useState, useCallback } from 'react';
import { audioManager, type AudioState } from '../core/AudioManager';
import { useRoomStore } from '../store';

interface AudioContextType extends AudioState {
  play: (url?: string, metadata?: MediaMetadataInit) => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
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
    isLoading: false,
    hasError: false
  });

  // Connect to Zustand store for queue/playlist management
  const { queue, currentIndex, playNext, playPrevious, playSong } = useRoomStore();

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
        // If we want to sync room state, we should trigger room store actions here
        // but for now, AudioManager handles the local audio element directly.
      },
      onPause: () => {
        // same here
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

  const value: AudioContextType = {
    ...audioState,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    playNext,
    playPrevious,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};
