import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, Plus } from 'lucide-react';
import { useRoomStore } from '../store';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import AddToPlaylistModal from './AddToPlaylistModal';
import AuthModal from './AuthModal';
import { authenticatedFetch } from '../api';

// Helper to format seconds into M:SS
const formatTime = (timeInSeconds: number) => {
  if (isNaN(timeInSeconds)) return "0:00";
  const m = Math.floor(timeInSeconds / 60);
  const s = Math.floor(timeInSeconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export default function Player() {
  const { currentSong, roomId, listeners, togglePlay: storeTogglePlay } = useRoomStore();
  const { 
    isPlaying, 
    currentTime: localProgress, 
    duration, 
    play,
    pause, 
    seek, 
    togglePlay: audioTogglePlay,
    playNext,
    playPrevious
  } = useAudioPlayer();
  
  const progressRef = useRef<HTMLDivElement>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useRoomStore();

  // Fetch the actual audio stream URL when a new song is selected
  useEffect(() => {
    if (currentSong?.id || currentSong?._id) {
      const songId = currentSong.id || currentSong._id;
      const fetchStreamUrl = async () => {
        try {
          const params = new URLSearchParams({
            title: currentSong.title || '',
            artist: currentSong.artist || currentSong.subtitle || '',
            image: currentSong.image || ''
          });
          const data = await authenticatedFetch(`/song/${songId}?${params}`);
          if (data.streamUrl) {
            setStreamUrl(data.streamUrl);
          }
        } catch (error) {
          console.error("Failed to fetch stream URL", error);
        }
      };
      fetchStreamUrl();
    }
  }, [currentSong?.id, currentSong?._id]);

  // When streamUrl is ready, pass it to the global audio manager
  useEffect(() => {
    if (streamUrl && currentSong) {
      play(streamUrl, {
        title: currentSong.title,
        artist: currentSong.artist || currentSong.subtitle,
        artwork: [
          { src: currentSong.image || 'https://via.placeholder.com/150', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }, [streamUrl, currentSong, play]);

  const handleProgressClick = (e: MouseEvent<HTMLDivElement>) => {
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
    audioTogglePlay();
  };

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (localProgress / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 w-full md:pl-20 lg:pl-60 z-[100]">
      <div className="bg-[#111111]/90 backdrop-blur-xl border-t border-glassBorder px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
        
        {/* Track Info */}
        <div className="flex items-center gap-4 w-full md:w-1/3">
          <img 
            src={currentSong.image || 'https://via.placeholder.com/150'} 
            alt={currentSong.title} 
            className="w-12 h-12 md:w-14 md:h-14 rounded-md object-cover shadow-lg" 
          />
          <div className="overflow-hidden">
            <h4 className="text-white font-bold text-sm line-clamp-1">{currentSong.title}</h4>
            <p className="text-secondary text-xs font-medium line-clamp-1">{currentSong.artist}</p>
          </div>
          <button 
            onClick={handleAddClick}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/20 transition-colors text-secondary hover:text-white shrink-0 ml-auto md:ml-2"
            title="Add to Playlist"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Controls & Progress */}
        <div className="flex flex-col items-center w-full md:w-1/3 order-first md:order-none">
          <div className="flex items-center gap-6 mb-2">
            <button onClick={playPrevious} className="text-secondary hover:text-white transition-colors">
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button 
              onClick={handleTogglePlay}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={playNext} className="text-secondary hover:text-white transition-colors">
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>
          
          {/* Interactive Progress Bar */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] md:text-xs text-secondary font-medium w-8 text-right">
              {formatTime(localProgress)}
            </span>
            
            <div 
              ref={progressRef}
              className="flex-1 h-1.5 md:h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all group"
              onClick={handleProgressClick}
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
          <Volume2 size={18} className="text-secondary" />
          <div className="w-24 h-1 bg-white/10 rounded-full cursor-pointer">
             <div className="h-full bg-secondary rounded-full w-2/3"></div>
          </div>
        </div>

      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <AddToPlaylistModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} song={currentSong} />
    </div>
  );
}
