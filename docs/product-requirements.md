# SONICROOM — Product Requirements Document

> **Version**: 1.0
> **Status**: Draft
> **Last Updated**: 2026-08-19

---

## 1. Product Vision

SONICROOM is a mobile-first social music application whose core differentiator is **synchronized social listening** — enabling users to listen to the same song together in real time, regardless of physical location.

**Emotional promise**: *"Even though we're not physically together, we are experiencing this song together."*

### 1.1 What SONICROOM Is NOT
- Not a Spotify/JioSaavn clone
- Not a generic music dashboard
- Not simply a music player with chat bolted on
- Not a "host streams currentTime → clients play" toy implementation

---

## 2. Product Modes

### Mode 1: Personal Listening
Individual music discovery, playback, and library management.

### Mode 2: Social Room Listening
Synchronized group playback with roles, chat, reactions, and shared queue management.

---

## 3. User Personas

| Persona | Description | Primary Use |
|---------|-------------|-------------|
| **Solo Listener** | Discovers and plays music alone | Personal mode |
| **Room Creator** | Creates rooms, invites friends, controls playback | Admin role |
| **Room Participant** | Joins rooms, listens, chats, reacts | Member role |
| **Room Controller** | Delegated playback control by admin | Controller role |

---

## 4. Feature Requirements

### 4.1 Personal Listening

| Feature | Priority | Description |
|---------|----------|-------------|
| Song discovery | P0 | Trending, popular, featured, new releases |
| Search | P0 | Songs, artists, albums, playlists |
| Playback controls | P0 | Play, pause, seek, skip, previous |
| Queue management | P0 | Create, reorder, clear |
| Shuffle / Repeat | P1 | Toggle shuffle and repeat modes |
| Like songs | P1 | Mark songs as liked |
| Playlists | P1 | Create, rename, delete, add/remove/reorder songs |
| Listening history | P1 | Track recently played songs |
| Recommendations | P2 | Based on history, likes, genres, current song |
| Personalized home | P2 | Contextual sections based on listening behavior |

### 4.2 Social Room

| Feature | Priority | Description |
|---------|----------|-------------|
| Create room | P0 | Name, description, cover, visibility, join mode |
| Join room | P0 | Open join or approval-required flow |
| Synchronized playback | P0 | Authoritative server state, drift correction, late join |
| Room roles (Admin/Controller/Member) | P0 | Permission-based access control |
| Shared queue | P0 | Room-specific queue, add/remove/reorder |
| Real-time chat | P1 | Text messages in room |
| Reactions | P1 | Emoji reactions (❤️🔥😂😍👏😮🎵🎉) — ephemeral, floating UI |
| Room discovery | P1 | Browse public live rooms |
| Invite users | P1 | Share room code or direct invite |
| Admin panel | P1 | Manage members, roles, permissions, queue, room info |
| Approval flow | P2 | Pending join requests for approval-required rooms |
| Admin transfer | P2 | Transfer admin on leave, or end room gracefully |
| Member removal | P2 | Remove user → invalidate membership → disconnect |

### 4.3 Cross-Cutting

| Feature | Priority | Description |
|---------|----------|-------------|
| JWT Authentication | P0 | Register, login, protected routes |
| Central player controller | P0 | Single audio engine for personal and room modes |
| Personal↔Room mode switching | P0 | Clean transition between playback contexts |
| Mobile-first responsive UI | P0 | 390x844 primary, 320px–430px+ support |
| Desktop support | P1 | Functional desktop layout |
| Reconnection handling | P0 | Resync after network loss, background, wake |
| Rate limiting | P1 | Chat, reactions, room creation, join requests |
| Error handling | P1 | Graceful handling of all failure modes |

---

## 5. Room Specifications

### 5.1 Room Visibility
- **PUBLIC**: Discoverable in room listing
- **PRIVATE**: Requires invite code or explicit authorization

### 5.2 Join Modes
- **OPEN**: Instant join
- **APPROVAL_REQUIRED**: Admin must accept/reject

### 5.3 Room Roles & Permissions

| Action | Admin | Controller | Member |
|--------|-------|------------|--------|
| Play/Pause/Seek | ✅ | ✅ | ❌ |
| Change track | ✅ | ✅ | ❌ |
| Manage queue | ✅ | ✅ | ❌ |
| Suggest song | ✅ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ |
| React | ✅ | ✅ | ✅ |
| View queue | ✅ | ✅ | ✅ |
| Manage members | ✅ | ❌ | ❌ |
| Assign/revoke roles | ✅ | ❌ | ❌ |
| Update room info | ✅ | ❌ | ❌ |
| End room | ✅ | ❌ | ❌ |

### 5.4 Admin Leaving Policy
1. Transfer ADMIN to the longest-active Controller
2. If no Controller, transfer to the longest-active Member
3. If no eligible user, end the room gracefully

---

## 6. Synchronized Playback Requirements

### 6.1 Authoritative Server State
- Server maintains the single source of truth for room playback
- Clients never directly control playback in room mode
- All playback commands go through server validation

### 6.2 Sequence Numbers
- Monotonically increasing per room
- Clients reject stale state updates (lower sequence numbers)

### 6.3 Clock Synchronization
- Lightweight client↔server clock offset estimation
- Used to calculate expected playback position

### 6.4 Drift Correction Thresholds
- **< 100ms**: No action
- **100ms–500ms**: Gentle rate adjustment
- **> 500ms**: Hard seek to authoritative position
- Thresholds must be configurable

### 6.5 Late Join
- New joiners receive current authoritative state
- Client calculates correct position based on server timestamp
- Playback starts at the correct position, not 00:00

### 6.6 Reconnection
- Client requests fresh authoritative state on reconnect
- Never trusts stale local state
- Must handle: WiFi loss, network switch, browser background, device wake

---

## 7. Music Source

The application will use the **JioSaavn API** (via `jiosaavn-sdk` or equivalent) as the initial music provider. The player architecture must use a provider abstraction to allow swapping music sources later.

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Mobile responsiveness | 320px–430px+ viewports |
| Playback sync accuracy | < 500ms drift in normal conditions |
| Late join accuracy | < 1 second from current position |
| Reconnect time | < 3 seconds to resync |
| Chat delivery | < 500ms end-to-end |
| Reaction delivery | < 300ms end-to-end |
| API response time | < 200ms for core endpoints |
| Max room size | 50 concurrent listeners (initial target) |

---

## 9. Product Name

**SONICROOM** is a working name. The codebase must be structured so the product name can be changed in a single configuration update.
