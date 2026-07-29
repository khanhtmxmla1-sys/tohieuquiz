# Browser Data Classification

TôHiệuQuiz treats the Worker and D1 as the source of truth. Browser persistence is limited to non-sensitive display preferences and a non-identifying session-restore hint.

| Data | Classification | Browser persistence | Rule |
|---|---|---|---|
| JWT, refresh token, password, API key | Credential | Forbidden | HttpOnly cookie or server secret only |
| Student profile, class, results, assignments | Personal | Memory/session only | Clear on logout and account switch |
| Parent email and communication preferences | Personal | Memory only | D1 is authoritative; clear on logout |
| Parent verification/recovery token | Credential | Forbidden | Raw token only in one-time URL/POST; D1 stores SHA-256 hash |
| Parent digest payload | Sensitive aggregate | Never persisted in browser | Minimized aggregate only; no identity, IDs, questions or answers |
| Coins, pet, inventory, orders | Personal | Memory only | Reload from authenticated API |
| Teacher/admin authorization | Sensitive | Memory only | Server profile decides role |
| Public quiz catalogue | Public/display | Optional session cache | Bounded TTL and account namespace |
| AI provider UI preference | Display | Local-safe | Never includes provider credentials |
| Restore hint | Display | Local-safe | Boolean only; no username or ID |
| Telemetry | Sensitive | Memory/transport only | Sampled and redacted; no answers or full URLs |

`src/security/storagePolicy.ts` is the executable policy. Adding a key to `StorageKeys` without classifying it makes the policy test fail.
