import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, Plus, X } from 'lucide-react';
import { useRoomStore } from '../store';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import AuthModal from '../components/AuthModal';
import { SongRowSkeleton } from '../components/SkeletonLoader';
import UserProfileDropdown from '../components/UserProfileDropdown';

interface Song {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  artist: string;
  source: string;
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, setQueue } = useRoomStore();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/api/search?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) setResults(data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleAddClick = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
    } else {
      setSelectedSong(song);
    }
  };

  return (
    <>
      <header className="px-6 md:px-10 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-[28px] font-bold tracking-tight leading-tight">Search</h1>
          <UserProfileDropdown />
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon size={20} className="text-[var(--color-secondary)]" />
          </div>
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, Artists, Playlists..." 
            className="w-full bg-white/5 border border-[var(--color-glassBorder)] rounded-2xl py-4 pl-12 pr-12 text-white placeholder-[var(--color-secondary)] outline-none focus:border-white/30 transition-colors font-medium text-[15px]"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-4 flex items-center text-[var(--color-secondary)] hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </header>

      <div className="px-6 md:px-10 pb-32">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <SongRowSkeleton key={i} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {results.map((song, index) => (
              <div 
                key={song.id} 
                onClick={() => setQueue(results, index)}
                className="flex items-center p-3 rounded-[16px] hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <img src={song.image || 'https://via.placeholder.com/150'} alt={song.title} className="w-14 h-14 rounded-xl object-cover shadow-md" />
                <div className="ml-4 flex-1 pr-4">
                  <h3 className="font-bold text-[15px] mb-0.5 line-clamp-1">{song.title}</h3>
                  <p className="text-[13px] text-[var(--color-secondary)] font-medium line-clamp-1">{song.artist || song.subtitle}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => handleAddClick(e, song)}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/20 transition-colors text-secondary hover:text-white border border-transparent hover:border-white/10"
                    title="Add to Playlist"
                  >
                    <Plus size={18} />
                  </button>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={16} fill="currentColor" className="ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <AddToPlaylistModal isOpen={!!selectedSong} onClose={() => setSelectedSong(null)} song={selectedSong} />
    </>
  );
}
