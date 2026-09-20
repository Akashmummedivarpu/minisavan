import { ListMusic, Play, X } from 'lucide-react';

interface RoomQueuePanelProps {
  items: any[];
  isHost: boolean;
  onPlayItem: (queueItemId: string) => void;
  onRemoveItem: (queueItemId: string) => void;
}

export default function RoomQueuePanel({ items, isHost, onPlayItem, onRemoveItem }: RoomQueuePanelProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-4 md:mt-6 w-full max-w-sm">
      <h4 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
        <ListMusic size={16} /> Up Next ({items.length})
      </h4>
      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto scrollbar-hide">
        {items.map((item: any, idx: number) => (
          <div key={item._id || idx} className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/5">
            <img
              src={item.track?.image || 'https://via.placeholder.com/150'}
              alt={item.track?.title || 'Song'}
              className="w-9 h-9 rounded-lg object-cover shrink-0"
            />
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-bold truncate">{item.track?.title || 'Unknown'}</p>
              <p className="text-xs text-secondary truncate">{item.track?.artist || ''}</p>
            </div>
            {isHost && item._id && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onPlayItem(item._id)}
                  title={`Play ${item.track?.title || 'song'} now`}
                  className="p-1.5 bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors"
                >
                  <Play size={13} fill="currentColor" />
                </button>
                <button
                  onClick={() => onRemoveItem(item._id)}
                  title="Remove from queue"
                  className="p-1.5 bg-white/10 text-secondary rounded-full hover:bg-white/20 hover:text-white transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
