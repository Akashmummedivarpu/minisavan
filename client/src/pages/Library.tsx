import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ListMusic, Heart, Clock, Play } from 'lucide-react';
import { authenticatedFetch } from '../api';
import { logger } from '../core/logger';
import { useRoomStore } from '../store';
import AuthModal from '../components/AuthModal';
import CreatePlaylistModal from '../components/CreatePlaylistModal';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { PlaylistCardSkeleton } from '../components/SkeletonLoader';

interface Playlist {
  _id: string;
  name: string;
  description: string;
  coverImage?: string;
  tracks: any[];
}

export default function Library() {
  const { user } = useRoomStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [likedCount, setLikedCount] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setQueue = useRoomStore(state => state.setQueue);
  
  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLibraryData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchLibraryData = async () => {
    try {
      const [playlistsRes, likedRes, historyRes] = await Promise.all([
        authenticatedFetch('/playlists'),
        authenticatedFetch('/user/liked'),
        authenticatedFetch('/user/history')
      ]);
      setPlaylists(playlistsRes);
      setLikedCount(likedRes.length);
      // Deduplicate history entries by song ID
      const uniqueHistory = Array.from(
        new Map(historyRes.map((song: any) => [song.songId || song._id, song])).values()
      );
      setHistory(uniqueHistory);
    } catch (err) {
      logger.error("Failed to fetch library data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylistClick = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const handlePlaylistCreated = () => {
    authenticatedFetch('/playlists').then(setPlaylists);
  };

  const playHistorySong = (song: any) => {
    setQueue([{
      id: song.songId,
      title: song.title,
      artist: song.artist || song.subtitle,
      image: song.image
    }], 0);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <header className="px-6 md:px-10 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div className="flex justify-between items-center w-full md:w-auto">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-2">Your Library</h1>
            <p className="text-[var(--color-secondary)] text-[15px] font-medium">
              {user ? `Logged in as ${user.username}` : 'Log in to manage your collection'}
            </p>
          </div>
          <div className="md:hidden">
            <UserProfileDropdown />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:block">
            <UserProfileDropdown />
          </div>
          <button 
            onClick={handleCreatePlaylistClick}
            className="bg-white text-black px-5 py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:scale-105 transition-transform"
          >
            <Plus size={18} /> Create Playlist
          </button>
        </div>
      </header>

      {!user ? (
        <div className="px-6 md:px-10 py-20 text-center flex flex-col items-center">
          <ListMusic size={64} className="text-secondary/30 mb-6" />
          <h2 className="text-2xl font-bold mb-3">Sign in to see your Library</h2>
          <p className="text-secondary max-w-sm mb-6">Save your favorite tracks and create custom playlists by signing in to your account.</p>
          <button 
            onClick={() => setShowAuthModal(true)}
            className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform"
          >
            Sign In
          </button>
        </div>
      ) : loading ? (
        <div className="px-6 md:px-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {[1, 2, 3, 4, 5].map(i => <PlaylistCardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {/* History Row */}
          {history.length > 0 && (
            <div className="mb-10">
              <div className="px-6 md:px-10 mb-4 flex items-center gap-2 text-white font-bold text-xl tracking-tight">
                <Clock size={20} className="text-secondary" /> Recently Played
              </div>
              <div className="flex overflow-x-auto gap-4 px-6 md:px-10 pb-4 snap-x scrollbar-hide">
                {history.map((song) => (
                  <div 
                    key={song._id} 
                    onClick={() => playHistorySong(song)}
                    className="snap-start shrink-0 w-32 flex flex-col items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-32 h-32 rounded-full overflow-hidden relative shadow-lg bg-white/5">
                      <img 
                        src={song.image || 'https://via.placeholder.com/150'} 
                        alt={song.title} 
                        className="w-full h-full object-cover group-hover:scale-110 group-hover:opacity-80 transition-all duration-300"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                         <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center text-black">
                           <Play size={18} fill="currentColor" className="ml-1" />
                         </div>
                      </div>
                    </div>
                    <div className="text-center w-full px-1">
                      <p className="text-sm font-bold text-white truncate">{song.title}</p>
                      <p className="text-xs text-secondary truncate">{song.artist || song.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playlists Grid */}
          <div className="px-6 md:px-10">
            <h2 className="mb-4 font-bold text-xl tracking-tight">Playlists</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              
              {/* Liked Songs Permanent Card */}
              <div 
                onClick={() => navigate(`/library/liked`)}
                className="glass-panel p-4 rounded-[20px] transition-all cursor-pointer hover:bg-white/5 border border-[var(--color-glassBorder)] hover:border-white/20 group"
              >
                <div className="relative w-full aspect-square mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 shadow-lg flex items-center justify-center">
                  <Heart size={48} fill="white" className="text-white group-hover:scale-110 transition-transform duration-500 drop-shadow-md" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-xl"></div>
                </div>
                <h3 className="text-base font-bold mb-1">Liked Songs</h3>
                <p className="text-[var(--color-secondary)] text-sm font-medium">
                  {likedCount} {likedCount === 1 ? 'song' : 'songs'}
                </p>
              </div>

              {/* User Playlists */}
              {playlists.map((playlist) => (
                <div 
                  key={playlist._id}
                  onClick={() => navigate(`/library/${playlist._id}`)}
                  className="glass-panel p-4 rounded-[20px] transition-all cursor-pointer hover:bg-white/5 border border-[var(--color-glassBorder)] hover:border-white/20 group"
                >
                  <div className="relative w-full aspect-square mb-4 rounded-xl overflow-hidden bg-black/40 shadow-lg">
                    {playlist.coverImage ? (
                      <img 
                        src={playlist.coverImage} 
                        alt={playlist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary/30 group-hover:scale-105 transition-transform duration-500">
                        <ListMusic size={48} />
                      </div>
                    )}
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl"></div>
                  </div>
                  
                  <h3 className="text-base font-bold mb-1 line-clamp-1">{playlist.name}</h3>
                  <p className="text-[var(--color-secondary)] text-sm font-medium line-clamp-1">
                    {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      <CreatePlaylistModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        onPlaylistCreated={handlePlaylistCreated}
      />
    </div>
  );
}
