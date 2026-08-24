import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ListMusic } from 'lucide-react';
import { authenticatedFetch } from '../api';
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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPlaylists();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchPlaylists = async () => {
    try {
      const res = await authenticatedFetch('/playlists');
      setPlaylists(res);
    } catch (err) {
      console.error("Failed to fetch playlists", err);
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
    fetchPlaylists(); // refresh list
  };

  return (
    <>
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

      {loading ? (
        <div className="px-6 md:px-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {[1, 2, 3, 4, 5].map(i => <PlaylistCardSkeleton key={i} />)}
        </div>
      ) : !user ? (
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
      ) : (
        <div className="px-6 md:px-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {playlists.length === 0 ? (
            <div className="col-span-full py-20 text-center text-secondary">
              You haven't created any playlists yet.
            </div>
          ) : (
            playlists.map((playlist) => (
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
            ))
          )}
        </div>
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
    </>
  );
}
