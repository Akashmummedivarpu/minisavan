import { useState, useEffect } from 'react';
import { Play, Radio, Users } from 'lucide-react';
import { useRoomStore } from '../store';
import { Link } from 'react-router-dom';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { SongCardSkeleton } from '../components/SkeletonLoader';
import { authenticatedFetch } from '../api';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

interface Song {
  id: string;
  title: string;
  image: string;
  artist: string;
}

export default function Home() {
  const { currentSong, isPlaying, user, togglePlay: storeTogglePlay, setQueue } = useRoomStore();
  const { togglePlay: audioTogglePlay } = useAudioPlayer();

  const handleTogglePlay = () => {
    storeTogglePlay();
    audioTogglePlay();
  };
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        setLoadingRecent(true);
        try {
          const data = await authenticatedFetch('/user/history');
          const mapped = data.map((s: any) => ({
            id: s.songId,
            title: s.title,
            artist: s.artist,
            image: s.image,
            source: s.source
          }));
          // Remove duplicates based on ID and keep last 10
          const unique = Array.from(new Map(mapped.map((item: any) => [item.id, item])).values()) as Song[];
          setRecentSongs(unique.slice(0, 10));
        } catch (error) {
          console.error('Failed to fetch history', error);
        } finally {
          setLoadingRecent(false);
        }
      };
      fetchHistory();
    } else {
      setRecentSongs([]);
    }
  }, [user]);

  // Fetch recommendations based on the currently playing song
  useEffect(() => {
    if (currentSong?.artist) {
      const fetchRecs = async () => {
        setLoadingRecs(true);
        try {
          // The backend expects artist and optionally title
          const response = await fetch(`http://localhost:3001/api/recommendations?artist=${encodeURIComponent(currentSong.artist)}&title=${encodeURIComponent(currentSong.title || '')}`);
          if (response.ok) {
            const data = await response.json();
            // Data might be an array of songs
            if (Array.isArray(data)) {
              setRecommendations(data.slice(0, 10)); // Top 10 recs
            }
          }
        } catch (error) {
          console.error("Failed to fetch recommendations", error);
        } finally {
          setLoadingRecs(false);
        }
      };
      
      // Debounce slightly if songs change rapidly
      const timeout = setTimeout(fetchRecs, 1000);
      return () => clearTimeout(timeout);
    } else {
      setRecommendations([]);
    }
  }, [currentSong?.artist, currentSong?.title]);

  // Mock Active Rooms
  const activeRooms = [
    { id: '1', name: 'Global Top 50 Sync', listeners: 45, img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=80' },
    { id: '2', name: 'Lofi Focus', listeners: 12, img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80' },
    { id: '3', name: 'Late Night Drives', listeners: 8, img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=80' }
  ];

  return (
    <>
      {/* Header */}
      <header className="flex justify-between items-center px-6 md:px-10 mb-8">
        <h1 className="text-[28px] font-bold tracking-tight leading-tight">Home</h1>
        <div className="flex items-center gap-4">
          <UserProfileDropdown />
        </div>
      </header>

      {/* Premium Glassmorphic Hero Card (Now Dynamic) */}
      <div className="mx-5 md:mx-10 mb-10 rounded-[28px] glass-panel p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between transition-all duration-500">
        {currentSong ? (
          <>
            <div className="flex items-center gap-4 mb-6 md:mb-0 md:mr-6">
              <img 
                className="w-[72px] h-[72px] md:w-[120px] md:h-[120px] rounded-2xl md:rounded-[20px] object-cover shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-transform duration-500" 
                src={currentSong.image || 'https://via.placeholder.com/300'} 
                alt="Album Art" 
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-accent shadow-[0_0_12px_#22c55e] animate-breathe' : 'bg-secondary'}`}></div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--color-secondary)]">
                    {isPlaying ? 'Now Playing' : 'Paused'}
                  </span>
                </div>
                <h2 className="text-xl md:text-[28px] font-bold tracking-tight mb-1 line-clamp-1">{currentSong.title}</h2>
                <p className="text-sm md:text-base text-[var(--color-secondary)] font-medium line-clamp-1">{currentSong.artist || currentSong.subtitle}</p>
              </div>
            </div>

            <div className="flex justify-between items-center md:flex-col md:items-end md:gap-4">
              <div className="hidden md:flex items-center gap-3">
                <div className="flex">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center border-2 border-black/80 z-30"><Radio size={12} /></div>
                </div>
                <span className="text-[13px] font-medium text-secondary">Ready to sync</span>
              </div>
              <button 
                onClick={handleTogglePlay}
                className="bg-white text-black border-none rounded-full px-6 py-3 text-[13px] font-bold tracking-wide cursor-pointer hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
              >
                {isPlaying ? "Pause" : "Resume"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center w-full py-6 text-center">
            <h2 className="text-xl md:text-[28px] font-bold tracking-tight mb-2">Welcome to SonicRoom</h2>
            <p className="text-[var(--color-secondary)] font-medium mb-6">Search for a song to start your synchronized listening experience.</p>
            <Link to="/search" className="bg-white text-black border-none rounded-full px-6 py-3 text-[13px] font-bold tracking-wide cursor-pointer hover:scale-105 active:scale-95 transition-transform">
              Find Music
            </Link>
          </div>
        )}
      </div>

      {/* Recently Played Section */}
      {user && (recentSongs.length > 0 || loadingRecent) && (
        <section className="mb-10">
          <div className="px-6 md:px-10 flex justify-between items-end mb-5">
            <h2 className="text-[22px] font-bold tracking-tight">Recently Played</h2>
          </div>
          
          <div className="flex gap-4 px-6 md:px-10 overflow-x-auto snap-x snap-mandatory pb-4" style={{ scrollbarWidth: 'none' }}>
            {loadingRecent ? (
              <>
                {[1, 2, 3, 4, 5].map(i => <SongCardSkeleton key={i} />)}
              </>
            ) : (
              recentSongs.map((song, index) => (
                <div 
                  key={`recent-${song.id}`} 
                  onClick={() => setQueue(recentSongs, index)}
                  className="shrink-0 w-[140px] snap-start cursor-pointer group"
                >
                  <div className="w-[140px] h-[140px] rounded-[20px] overflow-hidden relative mb-3 shadow-lg">
                    <img src={song.image || 'https://via.placeholder.com/150'} alt={song.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play size={24} fill="white" className="text-white" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold mb-0.5 line-clamp-1">{song.title}</h3>
                  <p className="text-xs text-[var(--color-secondary)] font-medium line-clamp-1">{song.artist}</p>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Dynamic Recommendations Section */}
      {currentSong && (
        <section className="mb-10">
          <div className="px-6 md:px-10 flex justify-between items-end mb-5">
            <h2 className="text-[22px] font-bold tracking-tight line-clamp-2 md:line-clamp-1">Because you're listening to {currentSong.artist}</h2>
          </div>
          
          <div className="flex gap-4 px-6 md:px-10 overflow-x-auto snap-x snap-mandatory pb-4" style={{ scrollbarWidth: 'none' }}>
            {loadingRecs ? (
              <>
                {[1, 2, 3, 4, 5].map(i => <SongCardSkeleton key={i} />)}
              </>
            ) : recommendations.length > 0 ? (
              recommendations.map((song, index) => (
                <div 
                  key={song.id} 
                  onClick={() => setQueue(recommendations, index)}
                  className="shrink-0 w-[140px] snap-start cursor-pointer group"
                >
                  <div className="w-[140px] h-[140px] rounded-[20px] overflow-hidden relative mb-3 shadow-lg">
                    <img src={song.image || 'https://via.placeholder.com/150'} alt={song.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play size={24} fill="white" className="text-white" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold mb-0.5 line-clamp-1">{song.title}</h3>
                  <p className="text-xs text-[var(--color-secondary)] font-medium line-clamp-1">{song.artist}</p>
                </div>
              ))
            ) : (
              <p className="text-secondary text-sm px-2">No recommendations found.</p>
            )}
          </div>
        </section>
      )}

      {/* Active Rooms Section */}
      <section className="mb-10">
        <div className="px-6 md:px-10 flex justify-between items-end mb-5">
          <h2 className="text-[22px] font-bold tracking-tight">Active Rooms</h2>
          <Link to="/rooms" className="text-[13px] font-medium text-[var(--color-secondary)] hover:text-white transition-colors bg-transparent border-none cursor-pointer">View all</Link>
        </div>
        <div className="flex gap-4 px-6 md:px-10 overflow-x-auto snap-x snap-mandatory pb-4 lg:flex-wrap" style={{ scrollbarWidth: 'none' }}>
          {activeRooms.map(room => (
            <Link to="/rooms" key={room.id} className="shrink-0 w-[150px] snap-start cursor-pointer group no-underline text-white">
              <div className="w-[150px] h-[150px] rounded-[20px] overflow-hidden relative mb-3">
                <img src={room.img} alt={room.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="absolute bottom-3 left-3 text-white flex items-center gap-1.5">
                   <Users size={14} />
                   <span className="text-xs font-bold">{room.listeners}</span>
                </div>
              </div>
              <h3 className="text-sm font-bold mb-0.5">{room.name}</h3>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
