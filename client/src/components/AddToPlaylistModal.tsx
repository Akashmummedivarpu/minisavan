import { useState, useEffect } from 'react';
import { X, Loader2, ListMusic, Plus } from 'lucide-react';
import { authenticatedFetch } from '../api';
import { GenericSkeleton } from './SkeletonLoader';
import { logger } from '../core/logger';
import toast from 'react-hot-toast';

interface Playlist {
  _id: string;
  name: string;
  tracks: string[];
}

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: any | null; // the song object
}

export default function AddToPlaylistModal({ isOpen, onClose, song }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const controller = new AbortController();
      fetchPlaylists(controller.signal);
      return () => controller.abort();
    }
  }, [isOpen]);

  const fetchPlaylists = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/playlists', { signal });
      setPlaylists(res);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      logger.error("Failed to fetch playlists", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!song) return;
    setAddingTo(playlistId);
    try {
      await authenticatedFetch(`/playlists/${playlistId}/add`, {
        method: 'POST',
        body: JSON.stringify({ songId: song.id || song._id })
      });
      toast.success('Added to playlist!');
      onClose();
    } catch (err) {
      logger.error("Failed to add to playlist", err);
      toast.error('Failed to add to playlist');
    } finally {
      setAddingTo(null);
    }
  };

  if (!isOpen || !song) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111111] border border-glassBorder p-6 rounded-[24px] w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold tracking-tight">Add to Playlist</h2>
          <button 
            onClick={onClose}
            className="text-secondary hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-4 p-3 bg-white/5 rounded-xl mb-6 border border-white/5">
          <img 
            src={song.image || 'https://via.placeholder.com/150'} 
            alt={song.title} 
            className="w-12 h-12 rounded-lg object-cover shadow-md"
          />
          <div className="overflow-hidden flex-1">
            <h3 className="font-bold text-sm line-clamp-1">{song.title}</h3>
            <p className="text-xs text-secondary line-clamp-1">{song.artist || song.subtitle}</p>
          </div>
        </div>

        <h4 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-wider">Your Playlists</h4>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col gap-2 py-2">
              {[1, 2, 3, 4].map(i => <GenericSkeleton key={i} className="w-full h-14 rounded-xl" />)}
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-10 text-secondary text-sm">
              <ListMusic size={32} className="mx-auto mb-3 opacity-30" />
              You don't have any playlists yet.
            </div>
          ) : (
            playlists.map((playlist) => (
              <div 
                key={playlist._id}
                onClick={() => !addingTo && handleAddToPlaylist(playlist._id)}
                className={`flex justify-between items-center p-3 rounded-xl cursor-pointer transition-colors border ${addingTo === playlist._id ? 'bg-accent/20 border-accent/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm text-white">{playlist.name}</span>
                  <span className="text-xs text-secondary">{playlist.tracks.length} tracks</span>
                </div>
                {addingTo === playlist._id ? (
                  <Loader2 size={18} className="animate-spin text-accent" />
                ) : (
                  <Plus size={18} className="text-secondary group-hover:text-white" />
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
