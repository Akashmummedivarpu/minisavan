import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, ListMusic, MoreVertical, X } from 'lucide-react';
import { authenticatedFetch } from '../api';
import { useRoomStore } from '../store';
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

interface Playlist {
  _id: string;
  name: string;
  description: string;
  coverImage?: string;
  tracks: Song[];
}

export default function PlaylistView() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const setQueue = useRoomStore(state => state.setQueue);

  useEffect(() => {
    if (playlistId) {
      fetchPlaylist();
    }
  }, [playlistId]);

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/playlists/${playlistId}`);
      setPlaylist(res);
    } catch (err) {
      console.error("Failed to fetch playlist", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySong = (song: any, index: number = 0) => {
    if (!playlist) return;
    const mappedQueue = playlist.tracks.map((t: any) => ({
      id: t.songId,
      title: t.title,
      artist: t.artist || t.subtitle,
      image: t.image
    }));
    setQueue(mappedQueue, index);
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

  if (!playlist) {
    return (
      <div className="flex flex-col justify-center items-center h-[calc(100vh-140px)] text-center px-6">
        <ListMusic size={64} className="text-secondary/30 mb-6" />
        <h2 className="text-2xl font-bold mb-3">Playlist not found</h2>
        <p className="text-secondary mb-6">The playlist you're looking for doesn't exist or was deleted.</p>
        <button 
          onClick={() => navigate('/library')}
          className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-8 px-6 md:px-10 mb-10 items-end">
        <div className="relative w-48 h-48 md:w-60 md:h-60 rounded-2xl overflow-hidden shadow-2xl shrink-0 group">
          {playlist.coverImage ? (
            <img 
              src={playlist.coverImage} 
              alt={playlist.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <ListMusic size={64} className="text-secondary/30" />
            </div>
          )}
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl"></div>
        </div>
        
        <div className="flex-1">
          <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Playlist</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 line-clamp-2">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="text-[var(--color-secondary)] text-sm font-medium mb-4 line-clamp-2 max-w-2xl">
              {playlist.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm font-medium text-secondary">
            <span className="text-white">You</span>
            <span className="w-1 h-1 rounded-full bg-secondary"></span>
            <span>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 md:px-10 mb-8 flex items-center gap-6">
        <button 
          onClick={() => playlist.tracks.length > 0 && handlePlaySong(playlist.tracks[0], 0)}
          disabled={playlist.tracks.length === 0}
          className="w-14 h-14 bg-accent text-black rounded-full flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
        >
          <Play size={24} fill="currentColor" className="ml-1" />
        </button>
        <button className="text-secondary hover:text-white transition-colors">
          <MoreVertical size={24} />
        </button>
      </div>

      {/* Tracklist */}
      <div className="px-6 md:px-10 flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_minmax(0,1fr)_100px] md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_100px] gap-4 p-3 border-b border-white/10 text-xs font-medium text-secondary uppercase tracking-wider mb-3">
          <div className="text-center">#</div>
          <div>Title</div>
          <div className="hidden md:block">Album / Source</div>
          <div className="text-right pr-4">Options</div>
        </div>

        {/* Tracks */}
        {playlist.tracks.length === 0 ? (
          <div className="py-20 text-center text-secondary">
            <ListMusic size={48} className="mx-auto mb-4 opacity-30" />
            <p>This playlist is empty.</p>
            <p className="text-sm mt-2">Go to Search to find and add some tracks!</p>
          </div>
        ) : (
          playlist.tracks.map((song, index) => (
            <div 
              key={song._id}
              onClick={() => handlePlaySong(song, index)}
              className="grid grid-cols-[40px_minmax(0,1fr)_100px] md:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_100px] gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group items-center"
            >
              <div className="text-center text-secondary font-medium group-hover:hidden">
                {index + 1}
              </div>
              <div className="text-center text-white hidden group-hover:flex items-center justify-center">
                <Play size={14} fill="currentColor" />
              </div>
              
              <div className="flex items-center gap-3 overflow-hidden">
                <img 
                  src={song.image || 'https://via.placeholder.com/150'} 
                  alt={song.title} 
                  className="w-10 h-10 rounded-md object-cover"
                />
                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold text-sm text-white line-clamp-1">{song.title}</span>
                  <span className="text-xs text-secondary line-clamp-1">{song.artist || song.subtitle}</span>
                </div>
              </div>

              <div className="hidden md:flex items-center text-sm text-secondary line-clamp-1">
                {song.source === 'saavn' ? 'JioSaavn' : song.source === 'gaana' ? 'Gaana' : song.source === 'soundcloud' ? 'SoundCloud' : 'YouTube'}
              </div>

              <div className="text-right pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-secondary hover:text-white transition-colors" title="Remove from playlist (Coming Soon)">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
