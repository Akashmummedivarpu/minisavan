import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistCreated: () => void;
}

export default function CreatePlaylistModal({ isOpen, onClose, onPlaylistCreated }: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authenticatedFetch('/playlists', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      
      onPlaylistCreated();
      onClose();
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111111] border border-glassBorder p-8 rounded-[24px] w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-300">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-secondary hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold mb-2 tracking-tight">Create Playlist</h2>
        <p className="text-secondary text-sm mb-6">Give your new playlist a name and description.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80">Playlist Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border border-glassBorder rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. Late Night Vibes"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80">Description</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border border-glassBorder rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="A collection of my favorite tracks"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !name}
            className="mt-4 bg-accent text-black font-bold py-3.5 rounded-xl hover:bg-green-400 transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create'}
          </button>
        </form>

      </div>
    </div>
  );
}
