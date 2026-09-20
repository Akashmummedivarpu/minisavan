import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRoomStore } from '../store';
import { socket } from '../socket';
import { Users, Send, Disc, ArrowLeft, Radio, Copy, Check, UserPlus, UserCheck, UserX, Loader2, Plus, Crown, Headphones, ListMusic, MessageCircle, Trash2 } from 'lucide-react';
import { authenticatedFetch } from '../api';
import toast from 'react-hot-toast';
import AuthModal from '../components/AuthModal';
import RoomQueuePanel from '../components/RoomQueuePanel';
import { RoomDashboardSkeleton } from '../components/SkeletonLoader';

// Allowed reactions per PRD
const REACTIONS = ['❤️', '🔥', '😂', '😍', '👏', '😮', '🎵', '🎉'];

export default function RoomDashboard() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentSong, isPlaying, listeners, messages, sendChatMessage, leaveRoom, roomId: activeRoomId, user, joinRoom, roomQueue, joinError, roomNotice, clearRoomNotice, roomMeta, roomRole, pendingRequests, joinRequested, approveJoinRequest, denyJoinRequest, queueRemoveItem, queuePlayItem, reactions, pruneReactions } = useRoomStore();
  const [chatInput, setChatInput] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isJoining, setIsJoining] = useState(true);
  const [reactionBarVisible, setReactionBarVisible] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [mobileTab, setMobileTab] = useState<'now' | 'queue' | 'chat'>('now');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isHost = roomRole === 'ADMIN' || roomRole === 'CONTROLLER';

  useEffect(() => {
    // If not logged in, prompt them
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // If logged in but not in this room, join it automatically.
    // A ?code= param carries an invite code (join-by-code links).
    if (activeRoomId !== roomId && roomId) {
      setIsJoining(true);
      joinRoom(roomId, searchParams.get('code') || undefined);
    } else {
      setIsJoining(false);
    }
  }, [user, activeRoomId, roomId, joinRoom, searchParams]);

  // A failed join must not leave the user staring at a skeleton forever
  useEffect(() => {
    if (joinError) setIsJoining(false);
  }, [joinError]);

  // Room ended while inside (or notice set): inform + take user back to rooms
  useEffect(() => {
    if (roomNotice) {
      toast.error(roomNotice);
      clearRoomNotice();
      navigate('/rooms');
    }
  }, [roomNotice, clearRoomNotice, navigate]);

  // Drop expired reaction bursts so the overlay never goes stale
  useEffect(() => {
    if (reactions.length === 0) return;
    const timer = setInterval(pruneReactions, 2000);
    return () => clearInterval(timer);
  }, [reactions.length, pruneReactions]);

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

  const rawHostId: any = roomMeta?.hostId;
  const hostId = typeof rawHostId === 'string'
    ? rawHostId
    : (rawHostId?._id?.toString?.() || rawHostId?.toString?.() || '');
  const isRoomHost = !!user && !!hostId && hostId === user.id;

  const handleDeleteRoom = async () => {
    if (!roomId || !isRoomHost) return;
    if (!window.confirm(`Delete "${roomMeta?.name || 'this room'}" permanently? This cannot be undone.`)) return;
    try {
      await authenticatedFetch(`/rooms/${roomId}`, { method: 'DELETE' });
      leaveRoom();
      toast.success('Room deleted');
      navigate('/rooms');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete room');
    }
  };

  const handleSendReaction = (emoji: string) => {
    if (roomId) {
      socket.emit('room:reaction', { roomId, emoji });
      setReactionBarVisible(false);
    }
  };

  const handleCopyCode = async () => {
    const code = roomMeta?.inviteCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — fall back
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="w-full">
        <RoomDashboardSkeleton />
        <AuthModal isOpen={showAuthModal} onClose={() => navigate('/rooms')} />
      </div>
    );
  }

  // A failed join shows an explanatory error instead of an endless skeleton
  // (checked independently: isJoining is already false once joinError arrives)
  if (joinError && activeRoomId !== roomId) {
    return (
      <div className="w-full flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5">
          <Radio size={28} className="text-secondary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Couldn't join this room</h2>
        <p className="text-secondary text-sm mb-6 max-w-xs">{joinError}</p>
        <button
          onClick={() => navigate('/rooms')}
          className="bg-white text-black font-bold py-3 px-6 rounded-xl text-sm hover:scale-105 transition-transform"
        >
          Browse Rooms
        </button>
      </div>
    );
  }

  // Approval-required room: request filed, waiting on the host
  if (joinRequested && activeRoomId !== roomId) {
    return (
      <div className="w-full flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5">
          <UserPlus size={28} className="text-accent animate-pulse" />
        </div>
        <h2 className="text-xl font-bold mb-2">Request sent</h2>
        <p className="text-secondary text-sm mb-6 max-w-xs">
          The host has been notified. You'll join automatically once approved — no need to stay on this page.
        </p>
        <div className="flex items-center gap-2 text-secondary text-sm mb-6">
          <Loader2 size={16} className="animate-spin" /> Waiting for approval…
        </div>
        <button
          onClick={() => navigate('/rooms')}
          className="bg-white/10 text-white font-bold py-3 px-6 rounded-xl text-sm hover:bg-white/20 transition-colors"
        >
          Browse Rooms
        </button>
      </div>
    );
  }

  if (isJoining) {
    return (
      <div className="w-full">
        <RoomDashboardSkeleton />
        <AuthModal isOpen={showAuthModal} onClose={() => navigate('/rooms')} />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full lg:h-[calc(100vh-180px)] pb-32 lg:pb-0">

      {/* Mobile room header: room name + leave (stage header is tab-scoped) */}
      <div className="lg:hidden flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={handleLeave}
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors bg-black/40 px-3 py-2 rounded-full font-medium text-sm backdrop-blur-md"
          >
            <ArrowLeft size={15} /> Leave
          </button>
          {isRoomHost && (
            <button
              onClick={handleDeleteRoom}
              title="Delete room permanently"
              className="flex items-center gap-1.5 text-red-400/80 hover:text-red-400 transition-colors bg-black/40 px-3 py-2 rounded-full font-medium text-sm backdrop-blur-md"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
        <h2 className="text-[15px] font-bold truncate flex-1 text-center">{roomMeta?.name || 'Live Room'}</h2>
        <span className="flex items-center gap-1.5 text-white/80 text-xs font-medium bg-white/5 border border-white/10 px-3 py-2 rounded-full">
          <Users size={13} /> {listeners}
        </span>
      </div>

      {/* Mobile tabs: Now Playing / Queue / Chat (desktop keeps side-by-side) */}
      <div className="lg:hidden grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/5 border border-white/10" role="tablist">
        {([
          { id: 'now', label: 'Now Playing', icon: <Disc size={15} /> },
          { id: 'queue', label: `Queue${roomQueue.length > 0 ? ` (${roomQueue.length})` : ''}`, icon: <ListMusic size={15} /> },
          { id: 'chat', label: 'Chat', icon: <MessageCircle size={15} /> },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            onClick={() => setMobileTab(tab.id)}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${mobileTab === tab.id ? 'bg-white/15 text-white' : 'text-secondary hover:text-white'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      
      {/* Main Stage */}
      <div className={`${mobileTab === 'now' ? 'flex' : 'hidden'} lg:flex flex-1 glass-panel rounded-[32px] overflow-hidden relative flex-col p-4 md:p-8 items-center justify-center border border-white/10 shadow-2xl min-h-[240px] md:min-h-[480px]`}>
        <div className="absolute top-4 left-4 md:top-6 md:left-6 hidden lg:flex items-center gap-2 z-10">
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors bg-black/40 px-3 md:px-4 py-2 rounded-full font-medium text-sm backdrop-blur-md"
          >
            <ArrowLeft size={16} /> Leave
          </button>
          {isRoomHost && (
            <button
              onClick={handleDeleteRoom}
              title="Delete room permanently"
              className="flex items-center gap-2 text-red-400/80 hover:text-red-400 transition-colors bg-black/40 px-3 md:px-4 py-2 rounded-full font-medium text-sm backdrop-blur-md"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div className="absolute top-4 right-4 md:top-6 md:right-6 hidden lg:flex items-center gap-2 text-white/90 bg-accent/20 border border-accent/30 px-3 md:px-4 py-2 rounded-full font-medium text-sm backdrop-blur-md shadow-[0_0_15px_rgba(34,197,94,0.3)] z-10">
          <Users size={16} /> {listeners} {listeners === 1 ? 'Listener' : 'Listeners'}
        </div>

        {roomMeta?.inviteCode && (
          <button
            onClick={handleCopyCode}
            title="Copy invite code — share it so friends can join"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-6 flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-black/40 px-3.5 py-2 rounded-full font-mono text-xs tracking-[0.2em] backdrop-blur-md border border-white/10 z-10"
          >
            {codeCopied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            {codeCopied ? 'COPIED' : roomMeta.inviteCode}
          </button>
        )}

        {/* Incoming live reactions float up over the stage */}
        {reactions.length > 0 && (
          <div className="absolute inset-x-0 bottom-16 md:bottom-20 top-16 pointer-events-none overflow-hidden z-10" aria-hidden="true">
            {reactions.slice(-8).map((r) => {
              const spread = [...r.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 70;
              return (
                <span
                  key={r.id}
                  title={r.username}
                  className="absolute bottom-0 text-3xl md:text-4xl animate-reaction-float"
                  style={{ left: `calc(50% - 100px + ${spread * 2.4}px)` }}
                >
                  {r.emoji}
                </span>
              );
            })}
          </div>
        )}

        {currentSong ? (
          <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-sm text-center pt-2 md:pt-8 pb-16 md:pb-20">
            <div className={`relative w-36 h-36 sm:w-56 sm:h-56 md:w-80 md:h-80 mb-4 md:mb-8 rounded-[28px] md:rounded-[40px] overflow-hidden shadow-2xl transition-transform duration-700 ${isPlaying ? 'scale-100' : 'scale-95 grayscale-[30%]'}`}>
              <img 
                src={currentSong.image || currentSong.image_url} 
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-[28px] md:rounded-[40px]"></div>
            </div>
            
            <h2 className="text-xl sm:text-2xl md:text-4xl font-extrabold tracking-tight mb-1.5 md:mb-3 line-clamp-1 w-full">
              {currentSong.title}
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-secondary font-medium line-clamp-1 w-full">
              {currentSong.artist}
            </p>

            {/* Role badge: who am I in this room? */}
            <div className="mt-2.5 md:mt-3">
              {(roomRole === 'ADMIN' || roomRole === 'CONTROLLER') ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-1.5 bg-accent/15 border border-accent/30 text-accent px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase">
                    <Crown size={12} /> You're hosting
                  </span>
                  <span className="text-[11px] text-secondary/70">Pick songs from Search — everyone hears them</span>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 text-white/80 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase">
                  <Headphones size={12} /> Listening live
                </span>
              )}
            </div>

            {/* Reactions */}
            <div className="mt-3 md:mt-6 flex items-center gap-2 flex-wrap justify-center">
              {reactionBarVisible ? (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-3 rounded-full border border-white/10 animate-in fade-in zoom-in duration-200 flex-wrap justify-center">
                  {REACTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleSendReaction(emoji)}
                      className="text-xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setReactionBarVisible(true)}
                  className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-colors"
                >
                  React 🎉
                </button>
              )}
              {(roomRole === 'ADMIN' || roomRole === 'CONTROLLER') && (
                <button
                  onClick={() => navigate('/search')}
                  className="bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 px-5 py-2.5 rounded-full text-sm font-bold transition-colors flex items-center gap-1.5"
                >
                  <Plus size={15} strokeWidth={2.5} /> Add songs
                </button>
              )}
            </div>

            {/* Room Queue (desktop: inside stage; mobile: dedicated tab below) */}
            <div className="hidden lg:block w-full max-w-sm">
              <RoomQueuePanel
                items={roomQueue}
                isHost={isHost}
                onPlayItem={queuePlayItem}
                onRemoveItem={queueRemoveItem}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center pt-2 md:pt-8 pb-16 md:pb-20 w-full max-w-sm">
            <div className="flex flex-col items-center text-secondary/60 animate-pulse">
              <Disc size={80} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">Waiting for the host to pick a song...</p>
            </div>
            <div className="mt-3">
              {(roomRole === 'ADMIN' || roomRole === 'CONTROLLER') ? (
                <span className="inline-flex items-center gap-1.5 bg-accent/15 border border-accent/30 text-accent px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase">
                  <Crown size={12} /> You're hosting
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 text-white/80 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase">
                  <Headphones size={12} /> Listening live
                </span>
              )}
            </div>
            {(roomRole === 'ADMIN' || roomRole === 'CONTROLLER') && (
              <button
                onClick={() => navigate('/search')}
                className="mt-5 bg-accent text-black px-6 py-3 rounded-full text-sm font-bold transition-colors hover:bg-green-400 flex items-center gap-1.5 animate-in fade-in duration-500"
              >
                <Plus size={15} strokeWidth={2.5} /> Add songs
              </button>
            )}
            {/* Queued songs are visible (and manageable by the host) even before playback starts.
                Desktop shows this inside the stage; mobile uses the dedicated Queue tab below. */}
            <div className="hidden lg:block w-full max-w-sm">
              <RoomQueuePanel
                items={roomQueue}
                isHost={isHost}
                onPlayItem={queuePlayItem}
                onRemoveItem={queueRemoveItem}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Queue tab (desktop renders the queue inside the stage above) */}
      {mobileTab === 'queue' && (
        <div className="lg:hidden glass-panel rounded-[32px] border border-white/10 p-5 min-h-[240px]">
          {roomQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 px-4">
              <ListMusic size={32} className="text-secondary/40 mb-3" />
              <p className="text-[15px] font-semibold text-white/80">Queue is empty</p>
              <p className="text-sm text-secondary mt-1">
                {(roomRole === 'ADMIN' || roomRole === 'CONTROLLER')
                  ? 'Add songs from Search — use the + Queue button on any track.'
                  : 'The host will queue up what plays next.'}
              </p>
              {(roomRole === 'ADMIN' || roomRole === 'CONTROLLER') && (
                <button
                  onClick={() => navigate('/search')}
                  className="mt-5 bg-accent text-black px-6 py-3 rounded-full text-sm font-bold hover:bg-green-400 transition-colors flex items-center gap-1.5"
                >
                  <Plus size={15} strokeWidth={2.5} /> Add songs
                </button>
              )}
            </div>
          ) : (
            <RoomQueuePanel
              items={roomQueue}
              isHost={isHost}
              onPlayItem={queuePlayItem}
              onRemoveItem={queueRemoveItem}
            />
          )}
        </div>
      )}

      {/* Chat Sidebar (mobile: Chat tab; taller since it owns the screen) */}
      <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[380px] h-[55vh] md:h-[420px] lg:h-full glass-panel rounded-[32px] flex-col border border-white/10 overflow-hidden shadow-2xl`}>
        {(roomRole === 'ADMIN' || roomRole === 'CONTROLLER') && pendingRequests.length > 0 && (
          <div className="p-4 md:p-5 border-b border-accent/20 bg-accent/5">
            <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
              <UserPlus size={16} className="text-accent" />
              Join Requests ({pendingRequests.length})
            </h4>
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto scrollbar-hide">
              {pendingRequests.map((req: any) => (
                <div key={req.userId} className="flex items-center justify-between gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                  <span className="text-sm font-bold truncate">{req.username || 'Someone'}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => approveJoinRequest(req.userId)}
                      title={`Approve ${req.username || 'user'}`}
                      className="p-2 bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors"
                    >
                      <UserCheck size={15} />
                    </button>
                    <button
                      onClick={() => denyJoinRequest(req.userId)}
                      title={`Deny ${req.username || 'user'}`}
                      className="p-2 bg-red-500/15 text-red-400 rounded-full hover:bg-red-500/25 transition-colors"
                    >
                      <UserX size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="p-4 md:p-5 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <h3 className="font-bold text-lg flex items-center gap-2">
            Live Chat
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 scrollbar-hide">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-secondary/50 text-sm italic">
              It's quiet here. Say hello!
            </div>
          ) : (
            messages.map((msg, idx) => {
              const time = msg.createdAt
                ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
              const initial = (msg.username || '?').charAt(0).toUpperCase();
              return (
                <div key={idx} className="flex gap-2.5 animate-in slide-in-from-bottom-2 fade-in duration-300">
                  {msg.avatar ? (
                    <img
                      src={msg.avatar}
                      alt={msg.username}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-bold text-white/70 shrink-0 mt-0.5">
                      {initial}
                    </span>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-white/50 mb-1 ml-1">
                      {msg.username}
                      {time && <span className="font-medium text-white/30 ml-1.5">{time}</span>}
                    </span>
                    <div className="bg-white/10 backdrop-blur-md w-fit max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm border border-white/5 break-words">
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-black/20 border-t border-white/5">
          <div className="relative flex items-center">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-white/5 border border-white/10 rounded-full pl-5 pr-12 py-3 md:py-3.5 text-sm text-white focus:outline-none focus:border-accent/50 transition-colors"
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
