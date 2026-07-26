# ADR-0002: Same Question Order for All Students in Live Exam

**Status:** Accepted  
**Date:** 2026-05-05  
**Deciders:** Product Team  
**Context:** Live Exam Session MVP - Anti-cheating design

## Context

Live Exam Sessions need anti-cheating measures. One option is to randomize question order so each student sees questions in a different sequence, making it harder to share answers.

## Decision

We will use **the same question order for all students** in a Live Exam Session.

Anti-cheating will rely on:
1. **Randomized answer options** (A, B, C, D shuffled per student)
2. **Delayed scoring** (scores hidden until session closes)
3. **Time pressure** (limited duration)

## Alternatives Considered

### Different Question Order Per Student
- **Pros:** Stronger anti-cheat, harder to share "answer to question 5"
- **Cons:** 
  - More complex implementation (store order per student)
  - Harder to debug issues
  - Teacher can't say "everyone look at question 10"
  - Complicates analytics (which questions are hardest?)
- **Why rejected:** Complexity doesn't justify marginal security gain

### Same Order + Randomized Answers (Chosen)
- **Pros:**
  - Simple implementation
  - Teacher can reference questions by number
  - Easy analytics
  - Randomized answers still prevent cheating
- **Cons:** Students could theoretically share "question 5 is A" if they crack the answer randomization
- **Why chosen:** Good balance of simplicity and security for MVP

## Consequences

### Positive
- ✅ Simpler database schema (no per-student question order)
- ✅ Teacher can say "everyone on question 10 now"
- ✅ Easier to analyze which questions are difficult
- ✅ Faster to implement

### Negative
- ⚠️ Slightly weaker anti-cheat than per-student randomization
- ⚠️ Relies heavily on answer randomization working correctly

### Mitigation
- Ensure answer randomization is cryptographically random (not predictable)
- Use student ID as seed for answer shuffle (consistent per student, different across students)
- Monitor for suspicious patterns (same wrong answers)
- Can upgrade to per-student question order in Phase 2 if cheating is detected

## Database Impact

```sql
-- Simple schema (no question_order column needed)
CREATE TABLE live_exam_participants (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  answers TEXT, -- JSON: {"1": "A", "2": "B", "3": "C"}
  -- Keys are original question IDs, same for all students
  ...
);
```

## Notes

- This decision can be revisited if cheating becomes a problem
- Answer randomization must be implemented correctly for this to work
- Consider adding "question order randomization" as a Phase 2 feature if needed
