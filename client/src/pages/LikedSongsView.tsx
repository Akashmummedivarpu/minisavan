import { useState, useEffect } from 'react';

import { Play, Heart } from 'lucide-react';
import { authenticatedFetch } from '../api';
import { useRoomStore } from '../store';
import { logger } from '../core/logger';
import { GenericSkeleton, SongRowSkeleton } from '../components/SkeletonLoader';

interface Song {
  _id: string;
  songId: string;
  title: string;
  subtitle?: string;
  artist?: string;
  image?: string;
  source: string;
}

export default function LikedSongsView() {
  // navigate unused
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const setQueue = useRoomStore(state => state.setQueue);

  useEffect(() => {
    fetchLikedSongs();
  }, []);

  const fetchLikedSongs = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/user/liked`);
      setSongs(res);
    } catch (err) {
      logger.error("Failed to fetch liked songs", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySong = (_song: any, index: number = 0) => {
    const mappedQueue = songs.map((t: any) => ({
      id: t.songId,
      title: t.title,
      artist: t.artist || t.subtitle,
      image: t.image
    }));
    setQueue(mappedQueue, index);
  };

  const handleUnlike = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    try {
      const res = await authenticatedFetch('/user/liked/toggle', {
        method: 'POST',
        body: JSON.stringify({ songId })
      });
      if (!res.liked) {
        setSongs(prev => prev.filter(s => s.songId !== songId && s._id !== songId));
      }
    } catch (err) {
      logger.error("Failed to unlike song", err);
    }
  };

  if (loading) {
    return (
      <div className="pb-24">
        <div className="flex flex-col md:flex-row gap-8 px-6 md:px-10 mb-10 items-end">
          <GenericSkeleton className="w-48 h-48 md:w-60 md:h-60 rounded-2xl shrink-0" />
          <div className="flex-1 w-full flex flex-col gap-4">
            <GenericSkeleton className="h-12 md:h-16 w-3/4 rounded-xl" />
            <GenericSkeleton className="h-4 w-1/2 rounded-full" />
            <GenericSkeleton className="h-4 w-1/4 rounded-full" />
          </div>
        </div>
        <div className="px-6 md:px-10 flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map(i => <SongRowSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-8 px-6 md:px-10 mb-10 items-end">
        <div className="relative w-48 h-48 md:w-60 md:h-60 rounded-2xl overflow-hidden shadow-2xl shrink-0 group bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex flex-col items-center justify-center">
          <Heart size={64} fill="white" className="text-white" />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-2xl"></div>
        </div>
        
        <div className="flex-1">
          <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Playlist</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 line-clamp-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-100 via-white to-pink-100">
            Liked Songs
          </h1>
          <p className="text-[var(--color-secondary)] text-sm font-medium mb-4 line-clamp-2 max-w-2xl">
            All the tracks you've hearted.
          </p>
          <div className="flex items-center gap-4 text-sm font-medium text-secondary">
            <span className="text-white">You</span>
            <span className="w-1 h-1 rounded-full bg-secondary"></span>
            <span>{songs.length} {songs.length === 1 ? 'song' : 'songs'}</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 md:px-10 mb-8 flex items-center gap-6">
        <button 
          onClick={() => songs.length > 0 && handlePlaySong(songs[0], 0)}
          disabled={songs.length === 0}
          className="w-14 h-14 bg-accent text-black rounded-full flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
        >
          <Play size={24} fill="currentColor" className="ml-1" />
        </button>
      </div>

      {/* Tracklist */}
      <div className="px-6 md:px-10 flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-[20px_minmax(0,1fr)_40px] md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_100px] gap-2 md:gap-4 p-2 md:p-3 border-b border-white/10 text-xs font-medium text-secondary uppercase tracking-wider mb-3">
          <div className="text-center hidden md:block">#</div>
          <div>Title</div>
          <div className="hidden md:block">Album / Source</div>
          <div className="text-right pr-2 md:pr-4"></div>
        </div>

        {/* Tracks */}
        {songs.length === 0 ? (
          <div className="py-20 text-center text-secondary">
            <Heart size={48} className="mx-auto mb-4 opacity-30" />
            <p>You don't have any liked songs yet.</p>
            <p className="text-sm mt-2">Tap the heart icon on any song to add it here!</p>
          </div>
        ) : (
          songs.map((song, index) => (
            <div 
              key={song._id}
              onClick={() => handlePlaySong(song, index)}
              className="grid grid-cols-[20px_minmax(0,1fr)_40px] md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_100px] gap-2 md:gap-4 p-2 md:p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group items-center"
            >
              <div className="text-center text-secondary font-medium md:group-hover:hidden hidden md:block">
                {index + 1}
              </div>
              <div className="text-center text-white md:hidden md:group-hover:flex items-center justify-center">
                <Play size={14} fill="currentColor" />
              </div>
              
              <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                <img 
                  src={song.image || 'https://via.placeholder.com/150'} 
                  alt={song.title} 
                  className="w-10 h-10 md:w-10 md:h-10 rounded-md object-cover flex-shrink-0"
                />
                <div className="flex flex-col overflow-hidden min-w-0">
                  <span className="font-bold text-[13px] md:text-sm text-white truncate">{song.title}</span>
                  <span className="text-[11px] md:text-xs text-secondary truncate">{song.artist || song.subtitle}</span>
                </div>
              </div>

              <div className="hidden md:flex items-center text-sm text-secondary truncate">
                {song.source === 'saavn' ? 'JioSaavn' : song.source === 'gaana' ? 'Gaana' : song.source === 'soundcloud' ? 'SoundCloud' : 'YouTube'}
              </div>

              <div className="text-right pr-2 md:pr-4 flex justify-end">
                <button 
                  onClick={(e) => handleUnlike(e, song.songId)}
                  className="text-accent hover:text-white transition-colors p-2 md:p-0" 
                  title="Remove from Liked Songs"
                >
                  <Heart size={16} fill="currentColor" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
