const TEACHER = 'dashboard-visual-e2e';
const GENERATED_AT = '2026-08-06T08:00:00.000Z';

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: TEACHER,
    teacherName: 'Cô Minh Anh',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const quizzes = [
  {
    id: 'quiz-math-4a',
    title: 'Ôn tập Toán cuối tuần',
    class_level: '4A',
    category: 'toan',
    time_limit: 30,
    created_at: '2026-08-06T06:30:00.000Z',
    created_by: TEACHER,
    show_on_home: 1,
  },
  {
    id: 'quiz-vietnamese-4a',
    title: 'Luyện từ và câu',
    class_level: '4A',
    category: 'tieng-viet',
    time_limit: 25,
    created_at: '2026-08-05T08:00:00.000Z',
    created_by: TEACHER,
    show_on_home: 1,
  },
  {
    id: 'quiz-science-4a',
    title: 'Khám phá khoa học',
    class_level: '4A',
    category: 'khoa-hoc',
    time_limit: 20,
    created_at: '2026-08-04T08:00:00.000Z',
    created_by: TEACHER,
    show_on_home: 1,
  },
];

const questions = [
  { id: 'q-1', quiz_id: 'quiz-math-4a', type: 'MCQ', question: 'Câu hỏi 1', options: '1|2|3|4', correct_answer: 'A' },
  { id: 'q-2', quiz_id: 'quiz-math-4a', type: 'MCQ', question: 'Câu hỏi 2', options: '1|2|3|4', correct_answer: 'B' },
  { id: 'q-3', quiz_id: 'quiz-vietnamese-4a', type: 'MCQ', question: 'Câu hỏi 3', options: 'A|B|C|D', correct_answer: 'C' },
  { id: 'q-4', quiz_id: 'quiz-science-4a', type: 'MCQ', question: 'Câu hỏi 4', options: 'A|B|C|D', correct_answer: 'D' },
];

const results = [
  { id: 'result-1', studentName: 'Nguyễn An', studentClass: '4A', quizId: 'quiz-math-4a', quizTitle: 'Ôn tập Toán cuối tuần', score: 9, correctCount: 9, totalQuestions: 10, timeTaken: 780, submittedAt: '2026-08-06T07:45:00.000Z', answers: {} },
  { id: 'result-2', studentName: 'Trần Bình', studentClass: '4A', quizId: 'quiz-math-4a', quizTitle: 'Ôn tập Toán cuối tuần', score: 7.5, correctCount: 8, totalQuestions: 10, timeTaken: 840, submittedAt: '2026-08-06T07:30:00.000Z', answers: {} },
  { id: 'result-3', studentName: 'Lê Chi', studentClass: '4A', quizId: 'quiz-vietnamese-4a', quizTitle: 'Luyện từ và câu', score: 8, correctCount: 8, totalQuestions: 10, timeTaken: 720, submittedAt: '2026-08-06T07:15:00.000Z', answers: {} },
  { id: 'result-4', studentName: 'Phạm Dũng', studentClass: '4A', quizId: 'quiz-science-4a', quizTitle: 'Khám phá khoa học', score: 6, correctCount: 6, totalQuestions: 10, timeTaken: 900, submittedAt: '2026-08-06T07:00:00.000Z', answers: {} },
  { id: 'result-5', studentName: 'Vũ Hà', studentClass: '4A', quizId: 'quiz-vietnamese-4a', quizTitle: 'Luyện từ và câu', score: 4, correctCount: 4, totalQuestions: 10, timeTaken: 960, submittedAt: '2026-08-06T06:45:00.000Z', answers: {} },
];

const summary = {
  totalSubmissions: 285,
  uniqueCompletedWorks: 188,
  todaySubmissions: 5,
  uniqueStudents: 32,
  attemptPolicy: 'latest',
  timezone: 'Asia/Ho_Chi_Minh',
  statistics: {
    totalResults: 188,
    mean: 7.6,
    median: 8,
    stdDev: 1.7,
    min: 2,
    max: 10,
    passRate: 82,
    passCount: 154,
    failCount: 34,
    scoreDistribution: [
      { range: '0-2', count: 8, percentage: 4.3 },
      { range: '3-4', count: 26, percentage: 13.8 },
      { range: '5-6', count: 38, percentage: 20.2 },
      { range: '7-8', count: 71, percentage: 37.8 },
      { range: '9-10', count: 45, percentage: 23.9 },
    ],
  },
};

const actionItems = [
  {
    id: 'assignment-at-risk',
    kind: 'assignment_at_risk',
    severity: 'critical',
    title: 'Bài giao sắp đến hạn',
    explanation: '2 bài còn 7 học sinh chưa nộp trong 48 giờ tới.',
    count: 2,
    generatedAt: GENERATED_AT,
    cta: { label: 'Xem bài cần xử lý', url: '/teacher/assignments?status=OPEN&due=48' },
  },
  {
    id: 'draft-unpublished',
    kind: 'draft_unpublished',
    severity: 'warning',
    title: 'Bản nháp chưa hoàn tất',
    explanation: '1 bản nháp đang chờ tiếp tục soạn hoặc dọn dẹp.',
    count: 1,
    generatedAt: GENERATED_AT,
    cta: { label: 'Tiếp tục bản nháp', url: '/teacher/quizzes/new?draftId=draft-latest' },
  },
  {
    id: 'live-exam-upcoming',
    kind: 'live_exam_upcoming',
    severity: 'info',
    title: 'Phiên thi sắp diễn ra',
    explanation: '1 phiên đã được lên lịch trong 24 giờ tới.',
    count: 1,
    generatedAt: GENERATED_AT,
    cta: { label: 'Xem phiên đã lên lịch', url: '/teacher/live-exams?status=scheduled&window=24' },
  },
];

const installSession = (win: Window) => {
  win.localStorage.setItem('auth-storage', authStorageValue);
  win.localStorage.setItem('tohieuquiz_teacher_restore_hint', '1');
  win.localStorage.setItem(
    'tohieuquiz_teacher_dashboard_ui',
    JSON.stringify({ state: { activeTab: 'overview' }, version: 2 }),
  );
};

const stubBackend = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept({ method: 'GET', pathname: '/api/account/me' }, {
    statusCode: 200,
    body: {
      data: {
        username: TEACHER,
        fullName: 'Cô Minh Anh',
        role: 'teacher',
        classes: [{ id: 'class-4a', name: '4A' }],
        mustChangePassword: false,
      },
    },
  }).as('accountProfile');
  cy.intercept({ method: 'GET', pathname: '/api/quizzes' }, quizzes).as('quizzes');
  cy.intercept({ method: 'GET', pathname: '/api/questions' }, questions).as('questions');
  cy.intercept({ method: 'GET', pathname: '/api/results' }, { data: results, meta: {} }).as('results');
  cy.intercept({ method: 'GET', pathname: '/api/results/summary' }, {
    statusCode: 200,
    body: { data: summary },
  }).as('resultSummary');
  cy.intercept({ method: 'GET', pathname: '/api/teacher/action-center' }, {
    statusCode: 200,
    body: { status: 'success', data: { generatedAt: GENERATED_AT, items: actionItems } },
  }).as('actionCenter');
  cy.intercept({ method: 'GET', pathname: '/api/system-settings' }, {
    statusCode: 200,
    body: {
      status: 'success',
      data: { aiAssistantEnabled: true, unifiedNotificationsEnabled: false },
    },
  });
};

const waitForDashboard = () => {
  cy.wait(['@accountProfile', '@quizzes', '@questions', '@results', '@resultSummary', '@actionCenter']);
  cy.location('pathname').should('eq', '/teacher/overview');
  cy.contains('h1', 'Cô Minh Anh', { timeout: 20_000 }).should('be.visible');
  cy.contains('h2', 'Tạo đề kiểm tra').should('be.visible');
  cy.contains('h2', 'Việc cần chú ý hôm nay').should('be.visible');
  cy.contains('h2', 'Thao tác nhanh').should('be.visible');
  cy.get('[data-testid="teacher-dashboard-visual-fallback"]').should('not.exist');
  cy.get('img[src*="teacher-dashboard-v2"]').each(($image) => {
    cy.wrap($image)
      .should('have.prop', 'complete', true)
      .and(($loadedImage) => {
        expect(($loadedImage[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
      });
  });
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    const root = document.documentElement;
    expect(root.scrollWidth, 'document scroll width').to.be.at.most(root.clientWidth + 1);
  });
};

type ViewportCase = {
  name: string;
  width: number;
  height: number;
  desktopShell: boolean;
};

const viewports: ViewportCase[] = [
  { name: 'desktop-1440x1000', width: 1440, height: 1000, desktopShell: true },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768, desktopShell: true },
  { name: 'tablet-portrait-768x1024', width: 768, height: 1024, desktopShell: false },
  { name: 'mobile-390x844', width: 390, height: 844, desktopShell: false },
  { name: 'mobile-narrow-320x740', width: 320, height: 740, desktopShell: false },
];

describe('Teacher dashboard responsive redesign', () => {
  beforeEach(() => {
    stubBackend();
  });

  viewports.forEach(({ name, width, height, desktopShell }) => {
    it(`keeps the approved composition stable at ${name}`, () => {
      cy.viewport(width, height);
      cy.visit('/teacher/overview', { onBeforeLoad: installSession });
      waitForDashboard();
      assertNoHorizontalOverflow();

      if (desktopShell) {
        cy.get('aside[aria-label="Điều hướng quản trị"]').should('be.visible');
        cy.get('nav[aria-label="Điều hướng nhanh"]').should('not.be.visible');
      } else {
        cy.get('aside[aria-label="Điều hướng quản trị"]')
          .should('not.be.visible')
          .and('have.attr', 'aria-hidden', 'true');
        cy.get('nav[aria-label="Điều hướng nhanh"]').should('be.visible');
      }

      if (width === 390) {
        cy.contains('button', 'Thêm').click();
        cy.get('aside[aria-label="Điều hướng quản trị"]').should('be.visible');
        cy.get('body').type('{esc}');
        cy.get('aside[aria-label="Điều hướng quản trị"]').should('not.be.visible');
      }

      assertNoHorizontalOverflow();
      cy.screenshot(`teacher-dashboard/${name}`, { capture: 'fullPage' });
    });
  });
});
