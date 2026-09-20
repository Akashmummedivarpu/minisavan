// Shared room cover art: curated picks + deterministic fallback so rooms
// without a chosen cover still get varied art instead of one repeated image.
export const ROOM_COVERS = [
  { id: 'concert', label: 'Concert', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80' },
  { id: 'neon', label: 'Neon Lights', url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80' },
  { id: 'studio', label: 'Studio', url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=600&q=80' },
  { id: 'vinyl', label: 'Vinyl', url: 'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=600&q=80' },
  { id: 'party', label: 'Party', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80' },
  { id: 'headphones', label: 'Headphones', url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=600&q=80' },
  { id: 'dj', label: 'DJ Deck', url: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?auto=format&fit=crop&w=600&q=80' },
  { id: 'night', label: 'Night Sky', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80' },
  { id: 'guitar', label: 'Guitar', url: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=600&q=80' },
  { id: 'crowd', label: 'Crowd', url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=600&q=80' },
  { id: 'mic', label: 'Microphone', url: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=600&q=80' },
  { id: 'piano', label: 'Piano', url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80' },
];

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

// Resolve a room's display cover: chosen cover first, otherwise a stable
// pseudo-random pick from the curated set (keyed by room id so it never
// changes between renders, but differs across rooms).
export const coverForRoom = (room: { _id?: string; coverImage?: string } | null | undefined): string => {
  if (room?.coverImage) return room.coverImage;
  const seed = room?._id || 'default';
  return ROOM_COVERS[hashString(seed) % ROOM_COVERS.length].url;
};
