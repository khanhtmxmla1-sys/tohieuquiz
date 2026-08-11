// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const resultConsumers = [
  'workers/src/classroom/assignmentStudentQuery.ts',
  'workers/src/gameLoop/achievementRepository.ts',
  'workers/src/gamification/weeklyLeaderboardReward.ts',
  'workers/src/routes/gamification.ts',
  'workers/src/routes/classroom/assignmentStartRoute.ts',
  'workers/src/routes/classroom/classListRoute.ts',
  'workers/src/routes/phieu/scopeRepository.ts',
  'workers/src/routes/resultReports/cohortRepository.ts',
  'workers/src/routes/certificates/previewQuiz.ts',
  'workers/src/routes/certificates/batchQuizScope.ts',
  'workers/src/services/aiTutorAuthorization.ts',
  'workers/src/services/interventionService.ts',
  'workers/src/services/weaknessProfile.ts',
];

describe('canonical result consumer queries', () => {
  it('does not join or filter result ownership by display names', () => {
    const forbidden = [
      /r\.student_name\s*=\s*\?/i,
      /r\.class_name\s*=\s*\?/i,
      /s\.username\s*=\s*r\.student_name/i,
      /c\.name\s*=\s*r\.class_name/i,
      /student_id\s+IS\s+NULL\s+AND\s+LOWER\(TRIM\(student_name\)\)/i,
      /class_name\s+IN\s*\(SELECT\s+name\s+FROM\s+classes/i,
    ];

    for (const path of resultConsumers) {
      const source = read(path);
      for (const pattern of forbidden) {
        expect(source, `${path} still contains name-based result authority: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('uses canonical ids in the uncovered leaderboard and assignment-counter consumers', () => {
    expect(read('workers/src/classroom/assignmentStudentQuery.ts')).toContain('AND student_id = ?');
    expect(read('workers/src/gameLoop/achievementRepository.ts')).toContain('JOIN students s ON s.id = r.student_id');
    expect(read('workers/src/gamification/weeklyLeaderboardReward.ts')).toContain('JOIN students s ON s.id = r.student_id');
    expect(read('workers/src/routes/gamification.ts')).toContain('JOIN students s ON s.id = r.student_id');
  });
});
