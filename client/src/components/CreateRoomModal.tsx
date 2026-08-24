import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '../api';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomId: string) => void;
}

export default function CreateRoomModal({ isOpen, onClose, onRoomCreated }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // The backend expects name, description, visibility, joinMode
      const response = await authenticatedFetch('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: `Genre: ${genre}`, // We map genre to description for now
          visibility: 'PUBLIC',
          joinMode: 'OPEN_JOIN'
        })
      });

      // Join the newly created room immediately via Zustand store
      onRoomCreated(response._id);
      onClose();
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

        <h2 className="text-2xl font-bold mb-2 tracking-tight">Create Room</h2>
        <p className="text-secondary text-sm mb-6">Start a new synchronized listening session.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80">Room Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border border-glassBorder rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. Midnight Drives"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-white/80">Genre Vibe</label>
            <select 
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="bg-[#1a1a1a] border border-glassBorder rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="Pop">Pop</option>
              <option value="Hip-Hop">Hip-Hop</option>
              <option value="Electronic">Electronic</option>
              <option value="Lofi">Lofi / Chill</option>
              <option value="Rock">Rock</option>
              <option value="Global">Global / Mixed</option>
            </select>
          </div>

          <button 
            type="submit" 
            disabled={loading || !name}
            className="mt-4 bg-accent text-black font-bold py-3.5 rounded-xl hover:bg-green-400 transition-colors flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Start Broadcasting'}
          </button>
        </form>

      </div>
    </div>
  );
}
