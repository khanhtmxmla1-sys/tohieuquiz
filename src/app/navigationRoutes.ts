import type { StudentDashboardSection } from '../features/student-dashboard/components/content.types';
import type { TeacherDashboardTab } from '../stores/useTeacherDashboardUIStore';

const TEACHER_ROUTE_BY_TAB: Record<TeacherDashboardTab, string> = {
  overview: '/teacher/overview',
  results: '/teacher/results',
  manage: '/teacher/quizzes',
  create: '/teacher/quizzes?mode=create',
  announcements: '/teacher/announcements',
  'feature-rollout': '/teacher/feature-rollout',
  'login-media': '/teacher/login-media',
  classes: '/teacher/classes',
  assignments: '/teacher/assignments',
  teachers: '/teacher/teachers',
  'gift-shop': '/teacher/gift-shop',
  homework: '/teacher/homework',
  'live-exam': '/teacher/live-exams',
  certificates: '/teacher/certificates',
  'admin-templates': '/teacher/certificate-templates',
  'math-audit': '/teacher/math-audit',
  operations: '/teacher/operations',
  'system-question-bank': '/teacher/system-question-bank',
  'personal-settings': '/teacher/settings',
};

const TEACHER_TAB_BY_PATH = new Map<string, TeacherDashboardTab>([
  ['/teacher/overview', 'overview'],
  ['/teacher/results', 'results'],
  ['/teacher/quizzes', 'manage'],
  ['/teacher/announcements', 'announcements'],
  ['/teacher/feature-rollout', 'feature-rollout'],
  ['/teacher/login-media', 'login-media'],
  ['/teacher/classes', 'classes'],
  ['/teacher/assignments', 'assignments'],
  ['/teacher/teachers', 'teachers'],
  ['/teacher/gift-shop', 'gift-shop'],
  ['/teacher/homework', 'homework'],
  ['/teacher/live-exams', 'live-exam'],
  ['/teacher/certificates', 'certificates'],
  ['/teacher/certificate-templates', 'admin-templates'],
  ['/teacher/math-audit', 'math-audit'],
  ['/teacher/operations', 'operations'],
  ['/teacher/system-question-bank', 'system-question-bank'],
  ['/teacher/settings', 'personal-settings'],
]);

export type StudentRouteName =
  | 'dashboard'
  | 'assignments'
  | 'practice'
  | 'shop'
  | 'achievements'
  | 'results'
  | 'liveExam';

const STUDENT_STATIC_ROUTES: Record<Exclude<StudentRouteName, 'liveExam'>, string> = {
  dashboard: '/student/dashboard',
  assignments: '/student/assignments',
  practice: '/student/practice',
  shop: '/student/shop',
  achievements: '/student/achievements',
  results: '/student/results',
};

export const getTeacherRoute = (tab: TeacherDashboardTab): string => TEACHER_ROUTE_BY_TAB[tab];

export const getQuizEditorRoute = (quizId?: string | null): string => (
  quizId
    ? `/teacher/quizzes/${encodeURIComponent(quizId)}/edit`
    : '/teacher/quizzes/new'
);

export const resolveTeacherTabFromLocation = (
  pathname: string,
  search: string,
): TeacherDashboardTab => {
  if (pathname === '/teacher/quizzes') {
    const params = new URLSearchParams(search);
    return params.get('mode') === 'create' ? 'create' : 'manage';
  }
  if (pathname.startsWith('/teacher/results/')) return 'results';
  return TEACHER_TAB_BY_PATH.get(pathname) || 'overview';
};

export const getStudentSectionRoute = (section: StudentDashboardSection): string => {
  if (section === 'achievements') return STUDENT_STATIC_ROUTES.achievements;
  if (section === 'resultReports') return STUDENT_STATIC_ROUTES.results;
  return STUDENT_STATIC_ROUTES.dashboard;
};

export const resolveStudentSectionFromLocation = (pathname: string): StudentDashboardSection => {
  if (pathname === STUDENT_STATIC_ROUTES.achievements) return 'achievements';
  if (pathname === STUDENT_STATIC_ROUTES.results) return 'resultReports';
  return 'dashboard';
};

export const getStudentRoute = (
  route: StudentRouteName,
  params: { sessionId?: string } = {},
): string => {
  if (route === 'liveExam') {
    if (!params.sessionId) return '/student/dashboard';
    return `/student/live-exam/${encodeURIComponent(params.sessionId)}`;
  }
  return STUDENT_STATIC_ROUTES[route];
};

export const resolveSafeReturnTo = (
  rawValue: string | null | undefined,
  role: 'teacher' | 'student',
): string | null => {
  if (!rawValue || !rawValue.startsWith('/') || rawValue.startsWith('//')) return null;
  if (rawValue.includes('\\') || rawValue.includes('#')) return null;

  try {
    const parsed = new URL(rawValue, 'https://tohieuquiz.local');
    if (parsed.origin !== 'https://tohieuquiz.local') return null;
    const expectedPrefix = role === 'teacher' ? '/teacher/' : '/student/';
    if (!parsed.pathname.startsWith(expectedPrefix)) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

export const buildLoginRedirect = (
  role: 'teacher' | 'student',
  pathname: string,
  search: string,
): string => {
  const returnTo = resolveSafeReturnTo(`${pathname}${search}`, role);
  const params = new URLSearchParams({ login: role });
  if (returnTo) params.set('returnTo', returnTo);
  return `/?${params.toString()}`;
};
