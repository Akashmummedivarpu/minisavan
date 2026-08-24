import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Users, Plus } from 'lucide-react';
import { useRoomStore } from '../store';
import AuthModal from '../components/AuthModal';
import CreateRoomModal from '../components/CreateRoomModal';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { RoomCardSkeleton } from '../components/SkeletonLoader';

interface Room {
  _id: string;
  name: string;
  description: string;
  hostId: { username: string };
  memberCount: number;
}

export default function Rooms() {
  const { joinRoom, roomId, user } = useRoomStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRooms();
    // Poll for new rooms every 10 seconds
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoomClick = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowCreateModal(true);
    }
  };

  const handleRoomCreated = (newRoomId: string) => {
    joinRoom(newRoomId);
    navigate(`/rooms/${newRoomId}`);
  };

  // Helper to extract genre from description mapping
  const getGenre = (desc: string) => {
    if (desc && desc.startsWith('Genre: ')) {
      return desc.replace('Genre: ', '');
    }
    return 'Global';
  };

  return (
    <>
      <header className="px-6 md:px-10 mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div className="flex justify-between items-center w-full md:w-auto">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-2">Live Rooms</h1>
            <p className="text-[var(--color-secondary)] text-[15px] font-medium">Listen together in real-time</p>
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
            onClick={handleCreateRoomClick}
            className="bg-white text-black px-5 py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:scale-105 transition-transform"
          >
            <Plus size={18} /> Create Room
          </button>
        </div>
      </header>

      {loading ? (
        <div className="px-6 md:px-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => <RoomCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="px-6 md:px-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.length === 0 ? (
            <div className="col-span-full py-20 text-center text-secondary">
              No active rooms found. Be the first to create one!
            </div>
          ) : (
            rooms.map((room) => (
              <div 
                key={room._id}
                className={`glass-panel p-5 rounded-[24px] transition-all cursor-pointer hover:bg-white/5 border ${roomId === room._id ? 'border-accent shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'border-[var(--color-glassBorder)]'}`}
                onClick={() => {
                  if (!user) {
                    setShowAuthModal(true);
                  } else {
                    joinRoom(room._id);
                    navigate(`/rooms/${room._id}`);
                  }
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full w-fit">
                    <Radio size={14} className={roomId === room._id ? "text-accent animate-pulse" : "text-white"} />
                    <span className="text-xs font-bold tracking-wide uppercase">{getGenre(room.description)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full text-[var(--color-secondary)] text-xs font-medium border border-glassBorder">
                    <Users size={14} /> {room.memberCount || 1}
                  </div>
                </div>
                
                <h3 className="text-xl font-bold mb-1 line-clamp-1">{room.name}</h3>
                <p className="text-[var(--color-secondary)] text-sm font-medium mb-6">Hosted by {room.hostId?.username || 'Unknown'}</p>

                <button className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${roomId === room._id ? 'bg-accent/20 text-accent' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {roomId === room._id ? 'Joined' : 'Join Room'}
                </button>
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
      
      <CreateRoomModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        onRoomCreated={handleRoomCreated}
      />
    </>
  );
}
