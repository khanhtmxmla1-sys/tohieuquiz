# TôHiệuQuiz system time contract

## Canonical time zone

The single business time zone is `Asia/Ho_Chi_Minh` (GMT+7). Code imports this
value from `shared/time-zone.contract.ts`; feature code must not create its own
UTC offset or use the runtime machine's local calendar. The shared contract also
provides the canonical `+07:00`, `420`-minute and SQLite `+7 hours` forms.

## Storage and API boundaries

- D1 timestamps, Worker audit logs and API timestamps remain **UTC ISO-8601**.
- The database is never migrated by adding seven hours to historical values.
- Frontend display uses the helpers in `src/utils/dateTime.ts`.
- Worker business dates and date ranges use `workers/src/utils/systemTime.ts`.
- A `datetime-local` form value is interpreted as Hanoi local time and converted
  to UTC ISO-8601 before it crosses the API boundary.
- A date-only value such as `2026-08-05` is a Hanoi calendar label. It is not a
  browser-local midnight timestamp.

## Business-day and week boundaries

A Hanoi day starts at `17:00:00Z` on the preceding UTC date and ends at
`17:00:00Z` on the labelled date. ISO weeks run Monday through Sunday in Hanoi.
Queries bind UTC start/end ranges computed from those Hanoi labels instead of
using SQLite UTC `strftime` week calculations.

## Display contract

All user-visible dates use locale `vi-VN`, time zone `Asia/Ho_Chi_Minh` and a
24-hour clock. Invalid timestamps render an explicit fallback rather than
`Invalid Date`. Direct `toLocaleDateString`, ad-hoc `Intl.DateTimeFormat`,
`Asia/Bangkok`, and runtime-local calendar getters are blocked by
`tests/systemTimeUsageGuard.test.ts`.

## Cloudflare cron contract

Cloudflare evaluates cron expressions in UTC. The configured schedule is:

| UTC cron | UTC execution | Hanoi execution | Purpose |
|---|---|---|---|
| `0 0 * * 1` | Monday 00:00 UTC | Thứ Hai 07:00 giờ Hà Nội | Close expired exams and award the previous Hanoi ISO week. |
| `* * * * *` | Every minute UTC | Mỗi phút theo giờ Hà Nội | Close expired live exams. |
| `0 23 * * *` | Daily 23:00 UTC | Hằng ngày 06:00 giờ Hà Nội | Purge expired security data and create homework due reminders. |
| `0 * * * *` | Hourly at minute 00 UTC | Mỗi giờ đúng phút 00 giờ Hà Nội | Evaluate parent digest preferences. |

The expressions are named in `workers/src/scheduling/systemCron.ts`, mirrored in
`workers/wrangler.toml`, and enforced by `tests/systemTimeCronContract.test.ts`.

## Release and rollback

Frontend and API Worker should ship in the same release because the frontend
input/display contract and Worker business-day contract are coupled. No D1
migration is required. Deploy the Worker as a zero-percent version, smoke it by
version override, then promote it while retaining the prior version for rollback.
