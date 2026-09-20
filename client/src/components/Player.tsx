import { useEffect, useRef, useState, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Plus, Heart, Loader2, RotateCcw, Shuffle } from 'lucide-react';
import { useRoomStore } from '../store';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import AddToPlaylistModal from './AddToPlaylistModal';
import AuthModal from './AuthModal';
import { authenticatedFetch } from '../api';
import toast from 'react-hot-toast';
import { logger } from '../core/logger';

// Helper to format seconds into M:SS
const formatTime = (timeInSeconds: number) => {
  if (isNaN(timeInSeconds)) return "0:00";
  const m = Math.floor(timeInSeconds / 60);
  const s = Math.floor(timeInSeconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Drift correction thresholds (per realtime-architecture.md §4.3)
const IGNORE_THRESHOLD_MS = 100;
const GENTLE_THRESHOLD_MS = 500;
const GENTLE_RATE = 1.05;

export default function Player() {
  const { currentSong, roomId, listeners, togglePlay: storeTogglePlay, isPlaying: storeIsPlaying, roomRole, stateTimestamp, currentTime: storeCurrentTime, shuffle, toggleShuffle } = useRoomStore();
  const { 
    isPlaying: audioIsPlaying, 
    currentTime: localProgress, 
    duration, 
    volume,
    play,
    pause, 
    seek,
    setVolume,
    setPlaybackRate,
    playNext,
    playPrevious
  } = useAudioPlayer();
  
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  // Ref to track latest local progress without triggering effect re-runs
  const localProgressRef = useRef(localProgress);
  const [prevVolume, setPrevVolume] = useState(1);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [retryStreamCount, setRetryStreamCount] = useState(0);
  const [streamError, setStreamError] = useState(false);
  const { user } = useRoomStore();
  // Track which song the current streamUrl belongs to, to prevent stale playback
  const streamSongIdRef = useRef<string | null>(null);

  // Keep the ref in sync with the latest progress
  localProgressRef.current = localProgress;

  // Fetch the actual audio stream URL when a new song is selected
  // and log it to history
  useEffect(() => {
    // Priority: songId (Saavn/platform ID from DB) > id > _id (MongoDB ObjectId - won't work with music API)
    const resolvedId = currentSong?.songId || currentSong?.id;
    if (resolvedId) {
      // CRITICAL: Clear old stream URL immediately so we don't play stale audio
      setStreamUrl(null);
      setStreamError(false);
      setIsLoadingStream(true);
      streamSongIdRef.current = resolvedId;

      // Abort controller to cancel stale requests on rapid song switching
      const controller = new AbortController();
      const { signal } = controller;

      const fetchStreamUrl = async () => {
        try {
          const params = new URLSearchParams({
            title: currentSong.title || '',
            artist: currentSong.artist || currentSong.subtitle || '',
            image: currentSong.image || ''
          });
          // Race the fetch against a timeout so a slow external stream
          // provider can never leave the player stuck in a loading state.
          const data = await Promise.race([
            authenticatedFetch(`/song/${resolvedId}?${params}`, { signal }),
            new Promise<never>((_, reject) => {
              const t = setTimeout(() => reject(new Error('STREAM_TIMEOUT')), 15000);
              signal?.addEventListener('abort', () => {
                clearTimeout(t);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            })
          ]);
          // Only set if this is still the current song (prevent race condition)
          if (streamSongIdRef.current === resolvedId && data.streamUrl) {
            setStreamUrl(data.streamUrl);
          }
        } catch (error: any) {
          if (error?.name === 'AbortError') return; // Ignore cancelled requests
          logger.error("Failed to fetch stream URL", error);
          // Only show error if this is still the current song
          if (streamSongIdRef.current === resolvedId) {
            setStreamError(true);
            const isTimeout = error?.message === 'STREAM_TIMEOUT';
            toast.error(
              isTimeout
                ? 'Song is taking too long to load. Try another one.'
                : 'Failed to load song. Try another one.',
              {
                id: `stream-error-${resolvedId}`,
                duration: 4000
              }
            );
          }
        } finally {
          if (streamSongIdRef.current === resolvedId) {
            setIsLoadingStream(false);
          }
        }
      };
      
      const recordHistory = async () => {
        if (!user) return;
        try {
          await authenticatedFetch('/user/history', {
            method: 'POST',
            body: JSON.stringify({ songId: resolvedId })
          });
        } catch (err) {
          logger.error("Failed to record history", err);
        }
      };

      const checkLikedStatus = async () => {
        if (!user) return;
        try {
          const likedSongs = await authenticatedFetch('/user/liked');
          const liked = likedSongs.some((s: any) => s.songId === resolvedId);
          setIsLiked(liked);
        } catch (err) {
          logger.error("Failed to fetch liked status", err);
        }
      };

      fetchStreamUrl();
      recordHistory();
      checkLikedStatus();

      // Cleanup: cancel in-flight request on unmount or song change
      return () => controller.abort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.songId, currentSong?.id, currentSong?.title, currentSong?.artist, currentSong?.subtitle, currentSong?.image, user, retryStreamCount]);


  // When streamUrl is ready, pass it to the global audio manager
  useEffect(() => {
    if (streamUrl && currentSong && storeIsPlaying) {
      play(streamUrl, {
        title: currentSong.title,
        artist: currentSong.artist || currentSong.subtitle,
        artwork: [
          { src: currentSong.image || 'https://via.placeholder.com/150', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }, [streamUrl, currentSong, play, storeIsPlaying]);

  // Keep local audio in sync with the room's global play state
  useEffect(() => {
    if (!streamUrl) return;

    if (storeIsPlaying && !audioIsPlaying) {
      play(); // resume
    } else if (!storeIsPlaying && audioIsPlaying) {
      pause(); // pause
    }
  }, [storeIsPlaying, audioIsPlaying, streamUrl, play, pause]);

  // Calculate the server's authoritative target time
  const getServerTargetTime = useCallback(() => {
    if (!stateTimestamp || !duration) return null;
    let targetTime = storeCurrentTime;
    if (storeIsPlaying && stateTimestamp > 0) {
      const elapsedSinceUpdate = (Date.now() - stateTimestamp) / 1000;
      targetTime = storeCurrentTime + elapsedSinceUpdate;
    }
    return Math.min(targetTime, duration);
  }, [stateTimestamp, storeCurrentTime, storeIsPlaying, duration]);

  // Reset playback rate when leaving room mode
  useEffect(() => {
    if (!roomId) setPlaybackRate(1);
    else setPlaybackRate(1);
  }, [roomId, setPlaybackRate]);

  // Sync local audio position with server's authoritative time on state changes
  useEffect(() => {
    if (!roomId || !streamUrl || !stateTimestamp || !duration) return;

    const targetTime = getServerTargetTime();
    if (targetTime === null) return;

    // Three-tier drift correction
    const drift = Math.abs(localProgress - targetTime);
    if (drift > (GENTLE_THRESHOLD_MS / 1000)) {
      // Hard seek for large drift (> 500ms)
      setPlaybackRate(1);
      seek(targetTime);
    } else if (drift > (IGNORE_THRESHOLD_MS / 1000)) {
      // Gentle rate adjustment for 100-500ms drift
      setPlaybackRate(targetTime > localProgress ? GENTLE_RATE : (2 - GENTLE_RATE));
    } else {
      // < 100ms: ensure normal rate
      setPlaybackRate(1);
    }
  }, [roomId, stateTimestamp, storeCurrentTime, storeIsPlaying, duration, streamUrl, seek, getServerTargetTime, setPlaybackRate]);

  // Periodic sync check every 5 seconds to catch gradual drift
  useEffect(() => {
    if (!roomId || !streamUrl || !storeIsPlaying) return;

    const interval = setInterval(() => {
      const targetTime = getServerTargetTime();
      if (targetTime === null) return;
      const drift = Math.abs(localProgressRef.current - targetTime);
      if (drift > (GENTLE_THRESHOLD_MS / 1000)) {
        setPlaybackRate(1);
        seek(targetTime);
      } else if (drift > (IGNORE_THRESHOLD_MS / 1000)) {
        setPlaybackRate(targetTime > localProgressRef.current ? GENTLE_RATE : (2 - GENTLE_RATE));
      } else {
        setPlaybackRate(1);
      }
    }, 5000);

    return () => clearInterval(interval);
    // getServerTargetTime is stable; localProgressRef avoids effect churn
  }, [roomId, streamUrl, storeIsPlaying, getServerTargetTime, seek, setPlaybackRate]);

  const handleProgressClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    seek(newTime);
  };

  const handleMobileProgressClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  const handleAddClick = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowAddModal(true);
    }
  };

  const handleTogglePlay = () => {
    storeTogglePlay();
  };

  const handleRetryStream = () => {
    if (retryStreamCount === 0) setRetryStreamCount(1);
    else setRetryStreamCount((c) => c + 1);
  };

  const handleLikeClick = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const resolvedId = currentSong?.songId || currentSong?.id;
    if (!resolvedId) return;

    try {
      // Optimistic update
      setIsLiked(!isLiked);
      const res = await authenticatedFetch('/user/liked/toggle', {
        method: 'POST',
        body: JSON.stringify({ songId: resolvedId })
      });
      setIsLiked(res.liked);
    } catch (err) {
      logger.error("Failed to toggle like", err);
      setIsLiked(!isLiked); // Revert
    }
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume || 0.66);
    }
  };

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (localProgress / duration) * 100 : 0;
  const isListener = roomId && roomRole === 'MEMBER';
  const controlDisabledClass = isListener ? 'opacity-40 cursor-not-allowed pointer-events-none' : '';

  return (
    <div className="fixed bottom-[60px] md:bottom-0 left-0 w-full md:pl-20 lg:pl-60 z-50">
      <div className="bg-[#111111]/90 backdrop-blur-xl border-t border-glassBorder px-3 py-2 md:px-6 md:py-4 flex items-center justify-between gap-2 md:gap-0 relative">
        
        {/* Mobile Progress Bar (Absolute Top) — now interactive */}
        <div 
          ref={progressRef}
          className="md:hidden absolute top-0 left-0 w-full h-4 bg-transparent cursor-pointer group"
          onClick={isListener ? undefined : handleMobileProgressClick}
        >
          <div className="h-[2px] w-full bg-white/10 mt-0">
            <div 
              className="h-full bg-accent transition-all" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Track Info */}
        <div className="flex items-center gap-3 w-[55%] md:w-1/3 overflow-hidden">
          <img 
            src={currentSong.image || 'https://via.placeholder.com/150'} 
            alt={currentSong.title} 
            className="w-10 h-10 md:w-14 md:h-14 rounded-md object-cover shadow-lg shrink-0" 
          />
          <div className="overflow-hidden flex-1">
            <h4 className="text-white font-bold text-[13px] md:text-sm truncate">{currentSong.title}</h4>
            <p className="text-secondary text-[11px] md:text-xs font-medium truncate">{currentSong.artist || currentSong.subtitle}</p>
          </div>
          
          {/* Like button — visible on mobile too */}
          <div className="flex items-center gap-1 ml-auto md:ml-2 shrink-0">
            <button 
              onClick={handleLikeClick}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${isLiked ? 'text-accent hover:text-green-400' : 'text-secondary hover:text-white bg-white/5 hover:bg-white/20'}`}
              title={isLiked ? "Unlike" : "Like"}
            >
              <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={handleAddClick}
              className="hidden md:flex w-8 h-8 rounded-full items-center justify-center bg-white/5 hover:bg-white/20 transition-colors text-secondary hover:text-white shrink-0"
              title="Add to Playlist"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Controls & Progress */}
        <div className="flex items-center justify-end md:justify-center w-[45%] md:w-1/3">
          <div className="flex items-center gap-2 md:gap-6 md:mb-2">
            <button onClick={toggleShuffle} className={`transition-colors ${shuffle ? 'text-accent' : 'text-secondary hover:text-white'} ${controlDisabledClass}`} disabled={!!isListener} title={isListener ? 'Only the host can control playback' : shuffle ? 'Shuffle on' : 'Shuffle off'}>
              <Shuffle size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
            <button onClick={playPrevious} className={`text-secondary hover:text-white transition-colors ${controlDisabledClass}`} disabled={!!isListener} title={isListener ? 'Only the host can control playback' : 'Previous'}>
              <SkipBack size={18} fill="currentColor" className="md:w-[20px] md:h-[20px]" />
            </button>
            <button 
              onClick={streamError ? handleRetryStream : handleTogglePlay}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)] ${controlDisabledClass}`}
              disabled={!!isListener || isLoadingStream}
              title={isListener ? 'Only the host can control playback' : streamError ? 'Retry loading' : storeIsPlaying ? 'Pause' : 'Play'}
            >
              {isLoadingStream ? <Loader2 size={18} className="animate-spin" /> : streamError ? <RotateCcw size={18} /> : storeIsPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={playNext} className={`text-secondary hover:text-white transition-colors ${controlDisabledClass}`} disabled={!!isListener} title={isListener ? 'Only the host can control playback' : 'Next'}>
              <SkipForward size={18} fill="currentColor" className="md:w-[20px] md:h-[20px]" />
            </button>
          </div>
          
          {/* Interactive Progress Bar (Desktop) */}
          <div className="hidden md:flex w-full items-center gap-3 absolute md:relative bottom-0 left-0 md:bottom-auto md:left-auto">
            <span className="text-[10px] md:text-xs text-secondary font-medium w-8 text-right">
              {formatTime(localProgress)}
            </span>
            
            <div 
              className={`flex-1 h-1.5 md:h-1 bg-white/10 rounded-full overflow-hidden transition-all group ${isListener ? 'cursor-not-allowed' : 'cursor-pointer hover:h-2'}`}
              onClick={isListener ? undefined : handleProgressClick}
            >
              <div 
                className="h-full bg-white rounded-full group-hover:bg-accent transition-colors" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <span className="text-[10px] md:text-xs text-secondary font-medium w-8">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Extras */}
        <div className="hidden md:flex items-center justify-end gap-4 w-1/3">
          {roomId && (
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_#22c55e] animate-pulse"></span>
              Sync: {listeners} listening
            </div>
          )}
          <button 
            onClick={handleMuteToggle}
            className="text-secondary hover:text-white transition-colors cursor-pointer"
            title={volume > 0 ? 'Mute' : 'Unmute'}
          >
            <Volume2 size={18} />
          </button>
          <div 
            ref={volumeRef}
            className="w-24 h-1 bg-white/10 rounded-full cursor-pointer group hover:h-2 transition-all"
            onClick={(e) => {
              if (!volumeRef.current) return;
              const rect = volumeRef.current.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const newVol = Math.max(0, Math.min(1, clickX / rect.width));
              setVolume(newVol);
            }}
          >
             <div className="h-full bg-white rounded-full group-hover:bg-accent transition-colors" style={{ width: `${volume * 100}%` }}></div>
          </div>
        </div>

        {/* Mobile volume control */}
        <div className="md:hidden flex items-center mr-1">
          <button 
            onClick={handleMuteToggle}
            className="text-secondary hover:text-white transition-colors"
            title={volume > 0 ? 'Mute' : 'Unmute'}
          >
            <Volume2 size={18} className={volume === 0 ? 'opacity-40' : ''} />
          </button>
        </div>

      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <AddToPlaylistModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} song={currentSong} />
    </div>
  );
}
