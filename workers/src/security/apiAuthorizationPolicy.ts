export type ApiAuthorizationClass =
  | 'public'
  | 'authenticated'
  | 'student-owned'
  | 'teacher-owned'
  | 'admin-only'
  | 'internal-only';

export type ApiOwnershipKey =
  | 'none'
  | 'session'
  | 'studentId'
  | 'quizId'
  | 'resultId'
  | 'classId'
  | 'batchId'
  | 'route-handler';

export interface ApiAuthorizationPolicy {
  id: string;
  path: string;
  match: 'exact' | 'prefix';
  methods?: readonly string[];
  authorization: ApiAuthorizationClass;
  ownership: readonly ApiOwnershipKey[];
  enforcedBy: string;
}

const policy = (
  id: string,
  path: string,
  authorization: ApiAuthorizationClass,
  ownership: readonly ApiOwnershipKey[],
  enforcedBy: string,
  options: { match?: 'exact' | 'prefix'; methods?: readonly string[] } = {},
): ApiAuthorizationPolicy => ({
  id,
  path,
  match: options.match ?? 'prefix',
  methods: options.methods,
  authorization,
  ownership,
  enforcedBy,
});

export const apiAuthorizationPolicies: readonly ApiAuthorizationPolicy[] = [
  policy('health', '/api/health', 'public', ['none'], 'router health response', { match: 'exact', methods: ['GET'] }),
  policy('teacher-login', '/api/login', 'public', ['none'], 'teacher login handler', { match: 'exact', methods: ['POST'] }),
  policy('student-login', '/api/student-login', 'public', ['none'], 'classroom login handler', { match: 'exact', methods: ['POST'] }),
  policy('parent-activate', '/api/parent/activate', 'public', ['none'], 'parent activation handler', { match: 'exact', methods: ['POST'] }),
  policy('parent-login', '/api/parent/login', 'public', ['none'], 'parent login handler', { match: 'exact', methods: ['POST'] }),
  policy('public-phieu', '/api/phieu/public', 'public', ['none'], 'public phieu token handler'),
  policy('math-telemetry', '/api/math/telemetry', 'public', ['none'], 'rate limit and telemetry sanitizer', { match: 'exact', methods: ['POST'] }),
  policy('current-announcement', '/api/announcements/current', 'public', ['none'], 'announcement read handler', { match: 'exact', methods: ['GET'] }),
  policy('announcement-list', '/api/announcements', 'public', ['none'], 'announcement read handler', { match: 'exact', methods: ['GET'] }),
  policy('settings-read', '/api/system-settings', 'public', ['none'], 'settings read handler', { match: 'exact', methods: ['GET'] }),
  policy('practice', '/api/practice', 'public', ['none'], 'practice route validation'),
  policy('question-catalog', '/api/questions', 'public', ['quizId'], 'quiz handler strips answers', { methods: ['GET'] }),
  policy('quiz-catalog', '/api/quizzes', 'public', ['quizId'], 'quiz catalogue handler', { match: 'exact', methods: ['GET'] }),
  policy('client-error-ingest', '/api/client-errors', 'internal-only', ['none'], 'origin guard, rate limit and sanitizer', { match: 'exact', methods: ['POST'] }),

  policy('admin-all', '/api/admin/', 'admin-only', ['route-handler'], 'route-specific requireAdmin checks'),
  policy('admin-teachers', '/api/admin/teachers', 'admin-only', ['route-handler'], 'teacher requireAdmin checks'),
  policy('admin-announcements', '/api/admin/announcements', 'admin-only', ['route-handler'], 'announcement requireAdmin checks'),
  policy('admin-certificates', '/api/admin/certificate-templates', 'admin-only', ['route-handler'], 'certificate requireAdmin checks'),
  policy('admin-math-audit', '/api/admin/math-audit', 'admin-only', ['route-handler'], 'math requireAdmin checks'),
  policy('admin-math-telemetry', '/api/admin/math-telemetry', 'admin-only', ['route-handler'], 'math requireAdmin checks'),

  policy('parent-session', '/api/parent/', 'student-owned', ['session', 'studentId'], 'parent session derives studentId'),
  policy('parent-links', '/api/parent-links', 'teacher-owned', ['studentId', 'classId'], 'teacher student-scope guard'),
  policy('parent-announcements', '/api/parent-announcements', 'teacher-owned', ['classId'], 'teacher class-scope guard'),
  policy('parent-delivery', '/api/parent-delivery', 'teacher-owned', ['classId', 'studentId'], 'teacher class-scope guard'),

  policy('logout', '/api/logout', 'authenticated', ['session'], 'logout session handler', { match: 'exact', methods: ['POST'] }),
  policy('teachers', '/api/teachers', 'authenticated', ['session', 'route-handler'], 'teacher JWT and role checks'),
  policy('account', '/api/account', 'authenticated', ['session'], 'account JWT checks'),
  policy('classes', '/api/classes', 'teacher-owned', ['classId'], 'classroom teacher/admin ownership checks'),
  policy('students', '/api/students', 'teacher-owned', ['studentId', 'classId'], 'classroom teacher/admin ownership checks'),
  policy('student-profile', '/api/student-profile', 'student-owned', ['session', 'studentId'], 'authenticated student identity', { match: 'exact' }),
  policy('assignment-write', '/api/assignments', 'teacher-owned', ['quizId', 'classId', 'studentId'], 'assignment teacher/class ownership', { methods: ['POST', 'PUT', 'PATCH', 'DELETE'] }),
  policy('assignment-read', '/api/assignments', 'student-owned', ['session', 'studentId', 'classId'], 'assignment read scope', { methods: ['GET'] }),
  policy('result-submit', '/api/results', 'student-owned', ['session', 'studentId', 'quizId'], 'canonical student identity', { match: 'exact', methods: ['POST'] }),
  policy('results', '/api/results', 'teacher-owned', ['resultId', 'studentId', 'quizId', 'classId'], 'result ownership checks'),
  policy('validate', '/api/validate', 'student-owned', ['session', 'quizId'], 'result validation handler', { match: 'exact', methods: ['POST'] }),
  policy('student-result-reports', '/api/result-reports/mine', 'student-owned', ['session', 'studentId', 'resultId'], 'student report derives studentId'),
  policy('result-reports', '/api/result-reports', 'teacher-owned', ['batchId', 'resultId', 'studentId', 'quizId', 'classId'], 'report ownership services'),
  policy('quiz-drafts', '/api/quiz-drafts', 'teacher-owned', ['session', 'quizId'], 'draft owner scope'),
  policy('quiz-write', '/api/quizzes', 'teacher-owned', ['quizId'], 'quiz creator/admin ownership'),
  policy('question-write', '/api/questions', 'teacher-owned', ['quizId'], 'quiz creator/admin ownership'),

  policy('game-state', '/api/game-state', 'student-owned', ['session', 'studentId', 'resultId'], 'JWT student identity'),
  policy('pets', '/api/pets', 'student-owned', ['session', 'studentId'], 'JWT student identity'),
  policy('shop', '/api/shop', 'student-owned', ['session', 'studentId'], 'JWT student identity'),
  policy('leaderboard', '/api/leaderboard', 'authenticated', ['session'], 'authenticated gamification route'),
  policy('gift-shop', '/api/gift-shop', 'authenticated', ['studentId', 'classId', 'route-handler'], 'student self/teacher class scope'),
  policy('game-loop', '/api/game-loop', 'student-owned', ['session', 'studentId', 'quizId'], 'JWT student identity'),
  policy('live-exam', '/api/live-exam', 'authenticated', ['studentId', 'quizId', 'classId', 'route-handler'], 'role and session ownership checks'),
  policy('certificates', '/api/certificates', 'authenticated', ['studentId', 'classId', 'batchId', 'route-handler'], 'certificate ownership checks'),
  policy('certificate-batches', '/api/certificate-batches', 'teacher-owned', ['studentId', 'classId', 'batchId'], 'certificate batch ownership'),
  policy('notifications', '/api/notifications', 'authenticated', ['session', 'studentId'], 'notification recipient scope'),
  policy('homework', '/api/homework', 'authenticated', ['studentId', 'classId', 'route-handler'], 'homework ownership checks'),
  policy('analytics', '/api/analytics', 'teacher-owned', ['classId', 'quizId'], 'teacher/admin scope'),
  policy('phieu', '/api/phieu', 'teacher-owned', ['resultId', 'classId', 'batchId'], 'phieu ownership checks'),
  policy('announcement-write', '/api/announcements', 'admin-only', ['route-handler'], 'announcement requireAdmin checks'),
  policy('settings-write', '/api/system-settings', 'admin-only', ['route-handler'], 'settings requireAdmin checks'),
  policy('ai-tutor', '/api/ai-tutor', 'student-owned', ['session', 'resultId'], 'AI Tutor result ownership'),
  policy('ai-proxy', '/api/ai/', 'teacher-owned', ['session', 'route-handler'], 'AI proxy role checks'),
  policy('help', '/api/help', 'authenticated', ['session'], 'help JWT checks'),
  policy('teacher-ai-quota', '/api/teacher-ai-quota', 'teacher-owned', ['session'], 'teacher quota role checks'),
  policy('test-bank', '/api/test-bank', 'teacher-owned', ['quizId'], 'test-bank teacher/admin checks'),
] as const;

function matchesPath(entry: ApiAuthorizationPolicy, path: string): boolean {
  if (entry.match === 'exact') return path === entry.path;
  if (entry.path.endsWith('/')) return path.startsWith(entry.path);
  return path === entry.path || path.startsWith(`${entry.path}/`);
}

export function findApiAuthorizationPolicy(
  path: string,
  method: string,
  options: { ignoreMethod?: boolean } = {},
): ApiAuthorizationPolicy | undefined {
  const normalizedMethod = method.toUpperCase();
  return apiAuthorizationPolicies.find((entry) => {
    if (!matchesPath(entry, path)) return false;
    return options.ignoreMethod || !entry.methods || entry.methods.includes(normalizedMethod);
  });
}
