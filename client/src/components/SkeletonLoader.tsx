

export function SongRowSkeleton() {
  return (
    <div className="flex items-center p-3 rounded-[16px] gap-4 w-full">
      <div className="w-14 h-14 rounded-xl skeleton-shimmer shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 rounded-full skeleton-shimmer w-3/4" />
        <div className="h-3 rounded-full skeleton-shimmer w-1/2" />
      </div>
      <div className="w-10 h-10 rounded-full skeleton-shimmer shrink-0" />
    </div>
  );
}

export function PlaylistCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="w-full aspect-square rounded-2xl skeleton-shimmer" />
      <div className="flex flex-col gap-2 px-1">
        <div className="h-4 rounded-full skeleton-shimmer w-4/5" />
        <div className="h-3 rounded-full skeleton-shimmer w-2/5" />
      </div>
    </div>
  );
}

export function GenericSkeleton({ className }: { className: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}

export function SongCardSkeleton() {
  return (
    <div className="shrink-0 w-[140px] flex flex-col">
      <div className="w-[140px] h-[140px] rounded-[20px] skeleton-shimmer mb-3" />
      <div className="h-3.5 rounded-full skeleton-shimmer w-3/4 mb-1.5" />
      <div className="h-3 rounded-full skeleton-shimmer w-1/2" />
    </div>
  );
}

export function RoomCardSkeleton() {
  return (
    <div className="glass-panel p-5 rounded-[24px] border border-[var(--color-glassBorder)]">
      <div className="flex justify-between items-start mb-4">
        <div className="w-20 h-6 rounded-full skeleton-shimmer" />
        <div className="w-12 h-6 rounded-full skeleton-shimmer" />
      </div>
      <div className="h-6 rounded-full skeleton-shimmer w-3/4 mb-2" />
      <div className="h-4 rounded-full skeleton-shimmer w-1/2 mb-6" />
      <div className="w-full h-11 rounded-xl skeleton-shimmer" />
    </div>
  );
}

export function RoomDashboardSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] md:h-[calc(100vh-180px)] w-full">
      <div className="flex-1 glass-panel rounded-[32px] border border-white/10 p-8 flex flex-col items-center justify-center">
        <div className="w-64 h-64 md:w-80 md:h-80 rounded-[40px] skeleton-shimmer mb-8" />
        <div className="h-10 w-3/4 max-w-sm rounded-full skeleton-shimmer mb-4" />
        <div className="h-6 w-1/2 max-w-xs rounded-full skeleton-shimmer" />
      </div>
      <div className="w-full lg:w-[380px] h-[400px] lg:h-full glass-panel rounded-[32px] border border-white/10 p-5 flex flex-col gap-4">
        <div className="h-8 w-1/3 rounded-full skeleton-shimmer mb-4" />
        <div className="flex flex-col gap-4 flex-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 w-3/4 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
        <div className="h-12 w-full rounded-full skeleton-shimmer mt-auto" />
      </div>
    </div>
  );
}

