# ADR-0001: Use Polling for Live Exam Real-time Synchronization

**Status:** Accepted  
**Date:** 2026-05-05  
**Deciders:** Product Team  
**Context:** Live Exam Session MVP

## Context

Live Exam Sessions require real-time synchronization between teacher and students for:
- Waiting room (students joining)
- Timer countdown during exam
- Results room (waiting for scores)
- Session state transitions

We need to choose a real-time communication approach that works with our current stack (Cloudflare Workers + D1).

## Decision

We will use **HTTP polling with 3-second intervals** for MVP.

Frontend will poll these endpoints:
```typescript
// Student polls session status
GET /api/live-exam/session/:sessionId/status
Response: { state, timer, participantCount, ... }

// Teacher polls participant list
GET /api/live-exam/session/:sessionId/participants
Response: { participants: [...], completedCount, ... }
```

## Alternatives Considered

### Server-Sent Events (SSE)
- **Pros:** True real-time, lower latency
- **Cons:** Cloudflare Workers 30s CPU timeout, connection management complexity
- **Why rejected:** Overkill for MVP, adds infrastructure complexity

### WebSocket + Durable Objects
- **Pros:** Bi-directional real-time, perfect for session state
- **Cons:** Most complex, higher cost, requires Durable Objects setup
- **Why rejected:** Too complex for MVP, can migrate later if needed

### Polling (Chosen)
- **Pros:** Simple, works with current stack, no new infrastructure, good enough for 20-30 students
- **Cons:** Not true real-time (3s delay), more database queries
- **Why chosen:** Fastest to implement, validates concept, can upgrade later

## Consequences

### Positive
- ✅ Can ship MVP quickly (no new infrastructure)
- ✅ Easy to debug and monitor
- ✅ Works reliably with Cloudflare Workers
- ✅ 3s delay is acceptable for exam use case (not a chat app)

### Negative
- ⚠️ Database load increases with more students (N students × 1 request/3s)
- ⚠️ Not suitable for 100+ concurrent students
- ⚠️ Timer may drift slightly between clients

### Mitigation
- Use D1 indexes on `session_id` for fast queries
- Cache session state in Workers KV (reduce D1 hits)
- Monitor query performance, upgrade to SSE/WebSocket if needed
- Server-side timer is source of truth (client timer is just display)

## Migration Path

If polling becomes a bottleneck:
1. **Phase 2:** Migrate to Server-Sent Events for one-way updates (timer, state)
2. **Phase 3:** Add WebSocket + Durable Objects for bi-directional if needed

## Notes

- 3-second interval chosen for balance between responsiveness and load
- Faster interval (1s) would feel more real-time but 3x the requests
- Slower interval (5s) would reduce load but feel laggy
- For 30 students: 30 × (1 req/3s) = 10 req/s = manageable
