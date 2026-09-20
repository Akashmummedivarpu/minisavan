import { useState, useEffect } from 'react';
import { Play, Radio, Users, Music } from 'lucide-react';
import { useRoomStore } from '../store';
import { Link } from 'react-router-dom';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { SongCardSkeleton } from '../components/SkeletonLoader';
import { coverForRoom } from '../utils/roomCovers';
import { authenticatedFetch } from '../api';
import { logger } from '../core/logger';

interface Song {
  id: string;
  title: string;
  image: string;
  artist: string;
  subtitle?: string;
  reason?: string;
}

export default function Home() {
  const { currentSong, isPlaying, user, togglePlay: storeTogglePlay, setQueue } = useRoomStore();
  // Unused hook removed to fix TS build error

  const handleTogglePlay = () => {
    storeTogglePlay();
  };
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  // Fetch real active rooms
  useEffect(() => {
    const fetchRooms = async () => {
      setLoadingRooms(true);
      try {
        const data = await authenticatedFetch('/rooms');
        if (Array.isArray(data)) setActiveRooms(data);
      } catch (error) {
        logger.error('Failed to fetch active rooms', error);
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchRooms();
  }, []);

  // Only rooms that are currently playing a song count as "Active"
  const playingRooms = activeRooms.filter(room => room.isPlaying && room.currentTrackName);

  // Fetch trending songs for discovery
  useEffect(() => {
    const fetchTrending = async () => {
      setLoadingTrending(true);
      try {
        // Trending rail skips YouTube so video spam (trolls, reels comps)
        // doesn't crowd out real tracks.
        const data = await authenticatedFetch('/search?query=trending&exclude=youtube');
        if (Array.isArray(data)) setTrendingSongs(data.slice(0, 10));
      } catch (error) {
        logger.error('Failed to fetch trending songs', error);
      } finally {
        setLoadingTrending(false);
      }
    };
    fetchTrending();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchHistory = async () => {
        setLoadingRecent(true);
        try {
          const data = await authenticatedFetch('/user/history');
          const mapped = data.map((s: any) => ({
            id: s.songId || s._id,
            songId: s.songId,
            title: s.title,
            artist: s.artist,
            image: s.image,
            source: s.source
          }));
          // Remove duplicates based on ID and keep last 10
          const unique = Array.from(new Map(mapped.map((item: any) => [item.id, item])).values()) as Song[];
          setRecentSongs(unique.slice(0, 10));
        } catch (error) {
          logger.error('Failed to fetch history', error);
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
          // Authenticated so the backend can personalize from likes + history
          // (works logged-out too — falls back to artist-based picks).
          const data = await authenticatedFetch(`/recommendations?artist=${encodeURIComponent(currentSong.artist)}&title=${encodeURIComponent(currentSong.title || '')}`);
          // Data might be an array of songs
          if (Array.isArray(data)) {
            setRecommendations(data.slice(0, 10)); // Top 10 recs
          }
        } catch (error) {
          logger.error("Failed to fetch recommendations", error);
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

  // Mock Active Rooms removed — now fetching real data

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
                  {song.reason && (
                    <p className="text-[11px] text-accent/80 font-medium line-clamp-1 mt-0.5">{song.reason}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-secondary text-sm px-2">No recommendations found.</p>
            )}
          </div>
        </section>
      )}

      {/* Trending Songs Section */}
      <section className="mb-10">
        <div className="px-6 md:px-10 flex justify-between items-end mb-5">
          <h2 className="text-[22px] font-bold tracking-tight">Trending Now</h2>
        </div>
        <div className="flex gap-4 px-6 md:px-10 overflow-x-auto snap-x snap-mandatory pb-4" style={{ scrollbarWidth: 'none' }}>
          {loadingTrending ? (
            <>
              {[1, 2, 3, 4, 5].map(i => <SongCardSkeleton key={i} />)}
            </>
          ) : trendingSongs.length > 0 ? (
            trendingSongs.map((song, index) => (
              <div 
                key={song.id} 
                onClick={() => setQueue(trendingSongs, index)}
                className="shrink-0 w-[140px] snap-start cursor-pointer group"
              >
                <div className="w-[140px] h-[140px] rounded-[20px] overflow-hidden relative mb-3 shadow-lg">
                  <img src={song.image || 'https://via.placeholder.com/150'} alt={song.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={24} fill="white" className="text-white" />
                  </div>
                </div>
                <h3 className="text-sm font-bold mb-0.5 line-clamp-1">{song.title}</h3>
                <p className="text-xs text-[var(--color-secondary)] font-medium line-clamp-1">{song.artist || song.subtitle}</p>
              </div>
            ))
          ) : null}
        </div>
      </section>

      {/* Active Rooms Section */}
      <section className="mb-10">
        <div className="px-6 md:px-10 flex justify-between items-end mb-5">
          <h2 className="text-[22px] font-bold tracking-tight">Active Rooms</h2>
          <Link to="/rooms" className="text-[13px] font-medium text-[var(--color-secondary)] hover:text-white transition-colors bg-transparent border-none cursor-pointer">View all</Link>
        </div>
        <div className="flex gap-4 px-6 md:px-10 overflow-x-auto snap-x snap-mandatory pb-4 lg:flex-wrap" style={{ scrollbarWidth: 'none' }}>
          {loadingRooms ? (
            <>
              {[1, 2, 3].map(i => <SongCardSkeleton key={i} />)}
            </>
          ) : playingRooms.length > 0 ? (
            playingRooms.map(room => (
              <Link to={`/rooms/${room._id}`} key={room._id} className="shrink-0 w-[150px] snap-start cursor-pointer group no-underline text-white">
                <div className="w-[150px] h-[150px] rounded-[20px] overflow-hidden relative mb-3">
                  <img src={coverForRoom(room)} alt={room.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent"></div>
                  {/* Live badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-red-500/90 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white">Live</span>
                  </div>
                  <div className="absolute bottom-2.5 left-3 right-3 text-white">
                    {room.currentTrackName && (
                      <p className="text-[11px] font-semibold line-clamp-1 flex items-center gap-1">
                        <Music size={11} className="shrink-0" /> {room.currentTrackName}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                       <Users size={12} />
                       <span className="text-[11px] font-bold">{room.memberCount || room.listenerCount || 1}</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-bold mb-0.5 line-clamp-1">{room.name}</h3>
                {room.hostId?.username && (
                  <p className="text-xs text-[var(--color-secondary)] font-medium line-clamp-1">{room.hostId.username}</p>
                )}
              </Link>
            ))
          ) : (
            <div className="w-full flex flex-col items-center justify-center text-center py-12 px-4 mx-2 rounded-[24px] border border-dashed border-white/15 bg-white/[0.02]">
              <Radio size={40} className="text-secondary/40 mb-3" />
              <p className="text-[15px] font-semibold text-white/80">No rooms are currently active</p>
              <p className="text-sm text-secondary mt-1 max-w-xs">
                No rooms are playing right now. Start a listening session or find one in the rooms page.
              </p>
              <Link to="/rooms" className="mt-5 bg-white text-black rounded-full px-5 py-2.5 text-[13px] font-bold tracking-wide hover:scale-105 transition-transform">
                Browse Rooms
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
