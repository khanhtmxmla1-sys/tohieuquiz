# Live Exam Feature

Live Exam hook implementations live here so the feature can grow without adding more files to the global `src/hooks` folder.

Compatibility wrappers remain in `src/hooks` for existing imports:

- `src/hooks/useLiveExamStatus.ts`
- `src/hooks/useLiveExamParticipants.ts`
- `src/hooks/useLiveExamAnalytics.ts`
- `src/hooks/useLiveExamTimer.ts`
- `src/hooks/useLiveExamActivity.ts`
- `src/hooks/usePollingQuery.ts`

New Live Exam code should import from `src/features/live-exam` or this feature folder directly.
