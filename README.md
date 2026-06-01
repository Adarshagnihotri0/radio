# Radius Platform

A cross-platform geo-fenced tactical push-to-talk (PTT) communication platform with realtime WebRTC voice streaming, proximity-based channel discovery, and low-latency event-driven architecture.

## Features

- **Geo-Fenced Channels** — Join voice channels based on your physical location
- **Push-to-Talk** — Radio-inspired PTT interface with speaker locking
- **WebRTC Voice** — Low-latency peer-to-peer and SFU voice streaming
- **Realtime Presence** — See nearby users and active speakers in real time
- **Cross-Platform** — Web (React) + Mobile (React Native / Expo)
- **Tactical UX** — Virtual radio frequencies, signal strength, emergency override

## Monorepo Structure

```
radius-platform/
├── apps/
│   ├── backend/      # NestJS API + WebSocket gateway
│   ├── web/          # React + TypeScript + Tailwind
│   ├── mobile/       # React Native (Expo)
│   └── admin/        # Admin dashboard (React)
├── packages/
│   ├── shared-types/ # Shared TypeScript types/interfaces
│   ├── geo-utils/    # Geospatial utility functions
│   ├── websocket-sdk/# Typed WebSocket event SDK
│   ├── ui/           # Shared UI components
│   └── config/       # Shared configuration constants
├── infrastructure/
│   ├── docker/       # Dockerfiles
│   ├── nginx/        # Nginx reverse proxy config
│   ├── monitoring/   # Prometheus + Grafana
│   └── deployment/   # Cloud deployment configs
├── docs/
├── scripts/
└── .github/          # CI/CD workflows
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS, TypeScript, Socket.IO, JWT |
| Database | MongoDB (Mongoose), Redis |
| Voice | WebRTC, STUN/TURN |
| Web | React, TypeScript, Tailwind CSS, Zustand |
| Mobile | React Native, Expo, react-native-webrtc |
| Infra | Docker, Nginx, GitHub Actions |

## Quick Start

### Prerequisites

- Node.js >= 20
- Docker + Docker Compose
- MongoDB (or use Docker)
- Redis (or use Docker)

### 1. Clone & install

```bash
git clone https://github.com/your-org/radius-platform.git
cd radius-platform
npm install
```

### 2. Environment setup

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env
```

Edit each `.env` with your values.

### 3. Start infrastructure

```bash
npm run docker:up
```

This starts MongoDB, Redis, and Nginx.

### 4. Start development

```bash
# All apps in parallel
npm run dev

# Or individually
npm run backend:dev
npm run web:dev
npm run mobile:dev
```

### URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api |
| Web App | http://localhost:5173 |
| Mobile (Expo) | http://localhost:8081 |
| Redis Commander | http://localhost:8081 |

## Architecture

### Voice Flow

```
User presses PTT
  → Acquire Redis speaker lock
  → Broadcast "speaking" presence event
  → Stream audio via WebRTC (peer-to-peer or SFU)
  → Release lock on PTT release
  → Broadcast "silent" presence event
```

### Geo-Fence Flow

```
User location update
  → Store coordinates in MongoDB (2dsphere index)
  → Query nearby channels within radius
  → Auto-add user to qualifying channels
  → Auto-remove user from out-of-range channels
  → Emit proximity updates via Socket.IO
```

### Speaker Lock (Redis)

```
SETNX radius:channel:{channelId}:speaker {userId}  (TTL: 30s)
→ If acquired → publish voice
→ On PTT release → DEL key
→ On disconnect → DEL key (cleanup)
```

## Environment Variables

### Backend

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection | `mongodb://localhost:27017/radius` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | `your-secret-here` |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `STUN_URLS` | STUN server URLs | `stun:stun.l.google.com:19302` |
| `TURN_URL` | TURN server URL | `turn:your-turn-server:3478` |
| `TURN_USERNAME` | TURN credential | `username` |
| `TURN_CREDENTIAL` | TURN credential | `password` |

## API Endpoints

### Auth
- `POST /auth/register` — Register user
- `POST /auth/login` — Login
- `POST /auth/refresh` — Refresh token
- `POST /auth/logout` — Logout

### Channels
- `GET /channels` — List channels (with geo filter)
- `POST /channels` — Create channel
- `GET /channels/:id` — Get channel
- `PUT /channels/:id` — Update channel
- `DELETE /channels/:id` — Delete channel
- `GET /channels/nearby` — Get nearby channels (geo query)

### Users
- `GET /users/me` — Current user profile
- `PUT /users/me` — Update profile
- `PUT /users/me/location` — Update location

### Voice
- `GET /voice/sessions` — Active voice sessions
- `GET /voice/sessions/:channelId` — Channel session

## WebSocket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `ptt:start` | `{ channelId }` | Begin PTT transmission |
| `ptt:stop` | `{ channelId }` | End PTT transmission |
| `location:update` | `{ lat, lng }` | Update user location |
| `channel:join` | `{ channelId }` | Join a channel |
| `channel:leave` | `{ channelId }` | Leave a channel |
| `rtc:offer` | `{ to, sdp }` | WebRTC offer |
| `rtc:answer` | `{ to, sdp }` | WebRTC answer |
| `rtc:ice` | `{ to, candidate }` | ICE candidate |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `user:speaking` | `{ userId, channelId }` | User started speaking |
| `user:silent` | `{ userId, channelId }` | User stopped speaking |
| `channel:users` | `{ channelId, users[] }` | User list update |
| `proximity:update` | `{ channels[] }` | Nearby channel update |
| `rtc:offer` | `{ from, sdp }` | Incoming WebRTC offer |
| `rtc:answer` | `{ from, sdp }` | Incoming WebRTC answer |
| `rtc:ice` | `{ from, candidate }` | Incoming ICE candidate |

## License

MIT
