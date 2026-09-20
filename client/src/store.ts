import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { socket } from './socket';
import { logger } from './core/logger';

interface User {
  id: string;
  username: string;
  phoneNumber: string;
  avatar?: string;
}

interface ChatMessage {
  userId: string;
  username: string;
  avatar?: string | null;
  message: string;
  createdAt: number;
}

interface RoomReaction {
  id: string;
  emoji: string;
  username: string;
  timestamp: number;
}

export type PlaybackMode = 'PERSONAL' | 'ROOM';

interface RoomState {
  // Auth State
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;

  // Mode
  mode: PlaybackMode;

  // Room & Playback State
  roomId: string | null;
  roomRole: string | null; // 'ADMIN' | 'CONTROLLER' | 'MEMBER'
  isPlaying: boolean;
  currentTime: number;
  currentSong: any | null;
  listeners: number;
  messages: ChatMessage[];
  stateTimestamp: number; // server timestamp when state was set
  serverTime: number; // server's Date.now() at join time
  lastSequenceNumber: number;
  roomMembers: any[];
  roomQueue: any[];
  roomMeta: any | null; // room document from room:state metadata (name, inviteCode, ...)

  // Room session notices / errors (M1/M2: surfaced by RoomDashboard)
  roomNotice: string | null; // transient message, e.g. room ended while inside
  joinError: string | null; // last room:join failure reason
  clearRoomNotice: () => void;
  // Approval-required join flow (M6)
  pendingRequests: any[];
  joinRequested: boolean; // current user has a pending join request for the viewed room
  // Incoming live reactions (ephemeral overlay feed, pruned after a few seconds)
  reactions: RoomReaction[];
  pruneReactions: () => void;

  // Personal queue saved when entering room
  savedQueue: any[];
  savedIndex: number;

  // Queue & Playlist State
  queue: any[];
  currentIndex: number;
  shuffle: boolean;
  toggleShuffle: () => void;

  joinRoom: (roomId: string, inviteCode?: string) => void;
  leaveRoom: () => void;
  approveJoinRequest: (userId: string) => void;
  denyJoinRequest: (userId: string) => void;
  queueAddSong: (song: any) => void;
  queueRemoveItem: (queueItemId: string) => void;
  queuePlayItem: (queueItemId: string) => void;
  playSong: (song: any) => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  sendChatMessage: (message: string) => void;

  setQueue: (queue: any[], startIndex?: number) => void;
  addToQueue: (song: any) => void;
  playNext: () => void;
  playPrevious: () => void;
  clearQueue: () => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
}

// Socket listener registration lives outside the store creator so it
// can be cleanly set up once and torn down on leave.
let listenersRegistered = false;

function registerSocketListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  socket.on('room:state', (data) => {
    if (data.playbackState) {
      const nextSeq = data.playbackState.sequenceNumber ?? 0;
      const currentSeq = useRoomStore.getState().lastSequenceNumber;
      // Reject stale updates
      if (nextSeq < currentSeq) return;
      useRoomStore.setState({
        isPlaying: data.playbackState.status === 'PLAYING',
        currentTime: data.playbackState.positionMs / 1000,
        currentSong: data.playbackState.currentSong,
        stateTimestamp: data.playbackState.stateTimestamp || Date.now(),
        serverTime: data.serverTime || Date.now(),
        listeners: data.listenerCount ?? useRoomStore.getState().listeners,
        roomRole: data.role ?? useRoomStore.getState().roomRole,
        lastSequenceNumber: nextSeq,
        roomMembers: data.members || [],
        roomQueue: data.queue || [],
        roomMeta: data.metadata || null,
        pendingRequests: data.pendingRequests || [],
        // Chat history backfill (live messages append on top of this)
        messages: Array.isArray(data.chatHistory) ? data.chatHistory : [],
      });
    }
  });

  socket.on('room:playback-updated', (data) => {
    const nextSeq = data.sequenceNumber ?? 0;
    const currentSeq = useRoomStore.getState().lastSequenceNumber;
    if (nextSeq < currentSeq) return;
    useRoomStore.setState({
      isPlaying: data.status === 'PLAYING',
      currentTime: data.positionMs / 1000,
      currentSong: data.currentSong,
      stateTimestamp: data.stateTimestamp || Date.now(),
      lastSequenceNumber: nextSeq,
    });
  });

  socket.on('room:track-changed', (data) => {
    const nextSeq = data.sequenceNumber ?? 0;
    const currentSeq = useRoomStore.getState().lastSequenceNumber;
    if (nextSeq < currentSeq) return;
    useRoomStore.setState({
      isPlaying: data.status === 'PLAYING',
      currentTime: data.positionMs / 1000,
      currentSong: data.currentSong,
      stateTimestamp: data.stateTimestamp || Date.now(),
      lastSequenceNumber: nextSeq,
    });
  });

  socket.on('room:member-joined', (data) => {
    if (data.listenerCount !== undefined) {
      useRoomStore.setState({ listeners: data.listenerCount });
    } else {
      useRoomStore.setState((state) => ({ listeners: state.listeners + 1 }));
    }
  });

  socket.on('room:member-left', (data) => {
    if (data.listenerCount !== undefined) {
      useRoomStore.setState({ listeners: data.listenerCount });
    } else {
      useRoomStore.setState((state) => ({ listeners: Math.max(0, state.listeners - 1) }));
    }
  });

  socket.on('room:chat-message', (message: ChatMessage) => {
    useRoomStore.setState((state) => ({
      messages: [...state.messages, message]
    }));
  });

  socket.on('room:admin-transferred', (data) => {
    const current = useRoomStore.getState();
    if (current.roomRole === 'ADMIN' && data.newAdminId && data.newAdminId !== current.user?.id) {
      useRoomStore.setState({ roomRole: 'MEMBER' });
    }
    logger.info('Room admin transferred', data.message);
  });

  socket.on('room:join-requested', (data) => {
    useRoomStore.setState((state) => {
      if (state.pendingRequests.some((r: any) => r.userId?.toString() === data.userId?.toString())) {
        return state;
      }
      return { pendingRequests: [...state.pendingRequests, data] };
    });
  });

  socket.on('room:request-decided', (data) => {
    const current = useRoomStore.getState();
    useRoomStore.setState((state) => ({
      pendingRequests: state.pendingRequests.filter(
        (r: any) => r.userId?.toString() !== data.userId?.toString()
      ),
    }));
    // If this decision concerns me, (re)join on approval or show denial
    if (current.user && data.userId?.toString() === current.user.id?.toString()) {
      if (data.approved) {
        useRoomStore.getState().joinRoom(data.roomId);
      } else {
        useRoomStore.setState({ joinRequested: false, joinError: 'The host declined your request to join.' });
      }
    }
    if (data.listenerCount !== undefined) {
      useRoomStore.setState({ listeners: data.listenerCount });
    }
  });

  socket.on('room:ended', (data) => {
    logger.info('Room ended', data.message);
    useRoomStore.setState({ roomId: null, roomRole: null, isPlaying: false, currentSong: null, messages: [], mode: 'PERSONAL', roomMeta: null, roomNotice: data.message || 'Room ended' });
  });

  socket.on('room:reaction', (data) => {
    useRoomStore.setState((state) => ({
      reactions: [
        ...state.reactions.slice(-29),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          emoji: data.emoji,
          username: data.username || 'Someone',
          timestamp: data.timestamp || Date.now(),
        },
      ],
    }));
  });

  socket.on('room:queue-updated', (data) => {
    useRoomStore.setState({ roomQueue: data.queue || [] });
  });

  socket.on('room:queue-cleared', (data) => {
    logger.info('Room queue cleared', data.message);
    useRoomStore.setState({
      isPlaying: false,
      currentTime: 0,
      currentSong: null,
      roomQueue: [],
      stateTimestamp: data.state?.stateTimestamp || Date.now(),
    });
  });
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => {
      registerSocketListeners();

      return {
        // Auth
        user: null,
        token: null,
        setAuth: (user, token) => set({ user, token }),
        logout: () => set({
          user: null,
          token: null,
          // Clear room session so a different account never inherits it
          roomId: null,
          roomRole: null,
          mode: 'PERSONAL',
          isPlaying: false,
          currentSong: null,
          messages: [],
          roomMembers: [],
          roomQueue: [],
          roomMeta: null,
          lastSequenceNumber: -1,
          roomNotice: null,
          joinError: null,
          pendingRequests: [],
          joinRequested: false,
          reactions: [],
        }),

        // Mode
        mode: 'PERSONAL',

        // Room
        roomId: null,
        roomRole: null,
        isPlaying: false,
        currentTime: 0,
        currentSong: null,
        listeners: 1,
        messages: [],
        stateTimestamp: 0,
        serverTime: 0,
        lastSequenceNumber: -1,
        roomMembers: [],
        roomQueue: [],
        roomMeta: null,
        roomNotice: null,
        joinError: null,
        clearRoomNotice: () => set({ roomNotice: null }),
        pendingRequests: [],
        joinRequested: false,
        reactions: [],
        pruneReactions: () => {
          const cutoff = Date.now() - 4000;
          useRoomStore.setState((state) => ({
            reactions: state.reactions.filter((r) => r.timestamp > cutoff),
          }));
        },

        // Saved personal state
        savedQueue: [],
        savedIndex: 0,

        queue: [],
        currentIndex: -1,
        shuffle: false,
        toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

        joinRoom: (roomId, inviteCode) => {
          const { user, mode, queue, currentIndex } = get();
          if (!user) return;

          // Save personal playback state before switching to ROOM mode
          if (mode === 'PERSONAL') {
            useRoomStore.setState({
              savedQueue: queue,
              savedIndex: currentIndex,
              mode: 'ROOM',
              messages: [],
              roomQueue: [],
              roomMembers: [],
              roomMeta: null,
              lastSequenceNumber: -1,
              isPlaying: false,
              currentTime: 0,
              currentSong: null,
              pendingRequests: [],
              joinRequested: false,
              reactions: [],
            });
          }

          if (!socket.connected) socket.connect();
          // Reset the sequence guard so the incoming room:state for THIS room
          // is never rejected as stale next to another room's higher sequence.
          set({ joinError: null, joinRequested: false, lastSequenceNumber: -1 });
          socket.emit('room:join', { roomId, userId: user.id, inviteCode }, (res: any) => {
            if (res.success) {
              set({ roomId, joinError: null, joinRequested: false });
            } else if (res.requested) {
              // Approval-required room: request filed, wait for host decision
              set({ joinRequested: true });
            } else {
              logger.error("Failed to join room", res.error);
              // Restore personal mode on failure; dashboard surfaces joinError
              useRoomStore.setState({ mode: 'PERSONAL', roomId: null, joinError: res.error || 'Failed to join room' });
            }
          });
        },

        leaveRoom: () => {
          const { roomId, savedQueue, savedIndex } = get();
          if (roomId) socket.emit('room:leave', { roomId });
          // Do NOT disconnect the socket — keep it alive for rejoining
          set({
            roomId: null,
            roomRole: null,
            isPlaying: false,
            currentSong: null,
            messages: [],
            roomMembers: [],
            roomQueue: [],
            roomMeta: null,
            mode: 'PERSONAL',
            lastSequenceNumber: -1,
            roomNotice: null,
            joinError: null,
            pendingRequests: [],
            joinRequested: false,
            reactions: [],
            // Restore personal queue
            queue: savedQueue,
            currentIndex: savedIndex,
          });
        },

        playSong: (song) => {
          const { roomId, roomRole } = get();
          // Only ADMIN/CONTROLLER can change tracks in a room
          if (roomId && roomRole === 'MEMBER') return;
          set({ currentSong: song, isPlaying: true });

          if (roomId) {
            socket.emit('room:change-track', { roomId, song });
          }
        },

        togglePlay: () => {
          const { isPlaying, roomId, currentTime, roomRole } = get();
          // Only ADMIN/CONTROLLER can toggle play in a room
          if (roomId && roomRole === 'MEMBER') return;
          const nextState = !isPlaying;
          set({ isPlaying: nextState });

          if (roomId) {
            if (nextState) {
              socket.emit('room:play', { roomId, positionMs: currentTime * 1000 });
            } else {
              socket.emit('room:pause', { roomId, positionMs: currentTime * 1000 });
            }
          }
        },

        seek: (time) => {
          const { roomId, roomRole } = get();
          // Only ADMIN/CONTROLLER can seek in a room
          if (roomId && roomRole === 'MEMBER') return;
          set({ currentTime: time });
          if (roomId) {
            socket.emit('room:seek', { roomId, positionMs: time * 1000 });
          }
        },

        sendChatMessage: (message) => {
          const { roomId, user } = get();
          if (roomId && user && message.trim()) {
            socket.emit('room:chat', { roomId, message });
          }
        },

        approveJoinRequest: (userId) => {
          const { roomId } = get();
          if (roomId) socket.emit('room:approve-request', { roomId, userId });
        },

        denyJoinRequest: (userId) => {
          const { roomId } = get();
          if (roomId) socket.emit('room:deny-request', { roomId, userId });
        },

        // Room queue management (ADMIN/CONTROLLER only — mirrors playSong guard)
        queueAddSong: (song) => {
          const { roomId, roomRole } = get();
          if (roomId && roomRole === 'MEMBER') return;
          if (roomId && song) socket.emit('room:queue-add', { roomId, song });
        },

        queueRemoveItem: (queueItemId) => {
          const { roomId, roomRole } = get();
          if (roomId && roomRole === 'MEMBER') return;
          if (roomId && queueItemId) socket.emit('room:queue-remove', { roomId, queueItemId });
        },

        queuePlayItem: (queueItemId) => {
          const { roomId, roomRole } = get();
          if (roomId && roomRole === 'MEMBER') return;
          if (roomId && queueItemId) socket.emit('room:queue-play', { roomId, queueItemId });
        },

        setQueue: (queue, startIndex = 0) => {
          set({ queue, currentIndex: startIndex });
          if (queue.length > 0) {
            get().playSong(queue[startIndex]);
          }
        },

        addToQueue: (song) => {
          set((state) => ({ queue: [...state.queue, song] }));
        },

        playNext: () => {
          const { queue, currentIndex, playSong, shuffle } = get();
          if (shuffle && queue.length > 1) {
            // Shuffled: jump to a random track other than the current one
            let nextIndex = currentIndex;
            while (nextIndex === currentIndex) {
              nextIndex = Math.floor(Math.random() * queue.length);
            }
            set({ currentIndex: nextIndex });
            playSong(queue[nextIndex]);
          } else if (currentIndex < queue.length - 1) {
            const nextIndex = currentIndex + 1;
            set({ currentIndex: nextIndex });
            playSong(queue[nextIndex]);
          } else {
            // Stop playing if queue is empty or at end
            const { roomId } = get();
            set({ currentSong: null, isPlaying: false, currentIndex: -1 });
            if (roomId) {
              socket.emit('room:change-track', { roomId, song: null });
            }
          }
        },

        playPrevious: () => {
          const { queue, currentIndex, playSong } = get();
          if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            set({ currentIndex: prevIndex });
            playSong(queue[prevIndex]);
          } else if (queue.length > 0) {
            // Replay first song
            set({ currentIndex: 0 });
            playSong(queue[0]);
          }
        },

        clearQueue: () => {
          set({ queue: [], currentIndex: -1 });
        },

        removeFromQueue: (index) => {
          const { queue, currentIndex } = get();
          if (index < 0 || index >= queue.length) return;
          const newQueue = queue.filter((_, i) => i !== index);
          let newIndex = currentIndex;
          if (index < currentIndex) {
            newIndex = currentIndex - 1;
          }
          set({ queue: newQueue, currentIndex: Math.min(newIndex, newQueue.length - 1) });
        },

        reorderQueue: (fromIndex, toIndex) => {
          const { queue } = get();
          if (fromIndex < 0 || fromIndex >= queue.length || toIndex < 0 || toIndex >= queue.length) return;
          const newQueue = [...queue];
          const [moved] = newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, moved);
          set({ queue: newQueue });
        },
      };
    },
    {
      name: 'sonicroom-storage',
      // Persist auth + room session so a page reload keeps the user in their room.
      // Volatile playback state (song, queue, chat, role) is re-synced on rejoin.
      // NOTE: rejoining happens in App's boot effect (not onRehydrateStorage),
      // because it needs the hydrated state AND must run exactly once per load.
      partialize: (state) => ({ user: state.user, token: state.token, roomId: state.roomId, mode: state.mode, shuffle: state.shuffle }),
    }
  )
);
