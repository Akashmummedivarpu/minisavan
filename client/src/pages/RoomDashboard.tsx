import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store';
import { Users, Send, Disc, ArrowLeft } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import { RoomDashboardSkeleton } from '../components/SkeletonLoader';

export default function RoomDashboard() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { currentSong, isPlaying, listeners, messages, sendChatMessage, leaveRoom, roomId: activeRoomId, user, joinRoom } = useRoomStore();
  const [chatInput, setChatInput] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If not logged in, prompt them
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // If logged in but not in this room, join it automatically
    if (activeRoomId !== roomId && roomId) {
      setIsJoining(true);
      joinRoom(roomId);
    } else {
      setIsJoining(false);
    }
  }, [user, activeRoomId, roomId, joinRoom]);

  useEffect(() => {
    // Scroll to bottom of chat
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendChatMessage(chatInput);
      setChatInput('');
    }
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/rooms');
  };

  if (!user || isJoining) {
    return (
      <div className="w-full">
        <RoomDashboardSkeleton />
        <AuthModal isOpen={showAuthModal} onClose={() => navigate('/rooms')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] md:h-[calc(100vh-180px)] w-full">
      
      {/* Main Stage */}
      <div className="flex-1 glass-panel rounded-[32px] overflow-hidden relative flex flex-col p-8 items-center justify-center border border-white/10 shadow-2xl">
        <button 
          onClick={handleLeave}
          className="absolute top-6 left-6 flex items-center gap-2 text-white/70 hover:text-white transition-colors bg-black/40 px-4 py-2 rounded-full font-medium text-sm backdrop-blur-md"
        >
          <ArrowLeft size={16} /> Leave
        </button>

        <div className="absolute top-6 right-6 flex items-center gap-2 text-white/90 bg-accent/20 border border-accent/30 px-4 py-2 rounded-full font-medium text-sm backdrop-blur-md shadow-[0_0_15px_rgba(34,197,94,0.3)]">
          <Users size={16} /> {listeners} {listeners === 1 ? 'Listener' : 'Listeners'}
        </div>

        {currentSong ? (
          <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-sm text-center">
            <div className={`relative w-64 h-64 md:w-80 md:h-80 mb-8 rounded-[40px] overflow-hidden shadow-2xl transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-95 grayscale-[30%]'}`}>
              <img 
                src={currentSong.image_url} 
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-[40px]"></div>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 line-clamp-1">
              {currentSong.title}
            </h2>
            <p className="text-lg text-secondary font-medium line-clamp-1">
              {currentSong.artist}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-secondary/60 animate-pulse">
            <Disc size={80} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">Waiting for the host to pick a song...</p>
          </div>
        )}
      </div>

      {/* Chat Sidebar */}
      <div className="w-full lg:w-[380px] h-[400px] lg:h-full glass-panel rounded-[32px] flex flex-col border border-white/10 overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <h3 className="font-bold text-lg flex items-center gap-2">
            Live Chat
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-secondary/50 text-sm italic">
              It's quiet here. Say hello!
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className="flex flex-col animate-in slide-in-from-bottom-2 fade-in duration-300">
                <span className="text-xs font-bold text-white/50 mb-1 ml-1">{msg.username}</span>
                <div className="bg-white/10 backdrop-blur-md w-fit max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm border border-white/5">
                  {msg.message}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-black/20 border-t border-white/5">
          <div className="relative flex items-center">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-white/5 border border-white/10 rounded-full pl-5 pr-12 py-3.5 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
            />
            <button 
              type="submit"
              disabled={!chatInput.trim()}
              className="absolute right-2 p-2 bg-accent text-black rounded-full hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
