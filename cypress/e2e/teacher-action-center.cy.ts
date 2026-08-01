const generatedAt = '2026-07-28T08:00:00.000Z';

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'teacher.action',
    teacherName: 'Giáo viên Action',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const actionItems = [
  {
    id: 'assignment-at-risk',
    kind: 'assignment_at_risk',
    severity: 'critical',
    title: 'Bài giao sắp đến hạn',
    explanation: '2 bài còn 7 học sinh chưa nộp trong 48 giờ tới.',
    count: 2,
    generatedAt,
    cta: { label: 'Xem bài cần xử lý', url: '/teacher/assignments?status=OPEN&due=48' },
  },
  {
    id: 'gift-orders-pending',
    kind: 'gift_order_pending',
    severity: 'warning',
    title: 'Đơn đổi quà chờ duyệt',
    explanation: '2 đơn đang chờ giáo viên duyệt trước khi trao quà.',
    count: 2,
    generatedAt,
    cta: { label: 'Mở đơn chờ duyệt', url: '/teacher/gift-shop?status=PENDING' },
  },
  {
    id: 'gift-low-stock',
    kind: 'gift_low_stock',
    severity: 'warning',
    title: 'Phần thưởng sắp hết hàng',
    explanation: '1 phần thưởng đã chạm ngưỡng tồn kho thấp.',
    count: 1,
    generatedAt,
    cta: { label: 'Kiểm tra tồn kho', url: '/teacher/gift-shop?tab=catalog&stock=low' },
  },
  {
    id: 'drafts-unpublished',
    kind: 'draft_unpublished',
    severity: 'info',
    title: 'Bản nháp chưa hoàn tất',
    explanation: '1 bản nháp đang lưu trên máy chủ cần tiếp tục hoặc dọn dẹp.',
    count: 1,
    generatedAt,
    cta: { label: 'Tiếp tục bản nháp', url: '/teacher/quizzes/new?draftId=draft-latest' },
  },
  {
    id: 'live-exams-upcoming',
    kind: 'live_exam_upcoming',
    severity: 'info',
    title: 'Phiên thi sắp diễn ra',
    explanation: '1 phiên được lên lịch trong 24 giờ tới.',
    count: 1,
    generatedAt,
    cta: { label: 'Xem phiên đã lên lịch', url: '/teacher/live-exams?status=scheduled&window=24' },
  },
];

const remoteDraft = {
  id: 'draft-latest',
  ownerUsername: 'teacher.action',
  revision: 3,
  createdAt: '2026-07-27T07:00:00.000Z',
  updatedAt: generatedAt,
  draft: {
    schemaVersion: 1,
    draftId: 'draft-latest',
    ownerUsername: 'teacher.action',
    revision: 3,
    selectedQuestionId: null,
    targetPoints: 10,
    updatedAt: generatedAt,
    quiz: {
      id: 'quiz-draft-latest',
      title: 'Đề đang soạn từ Action Center',
      classLevel: '4',
      category: 'toan',
      timeLimit: 20,
      questions: [],
      createdAt: '2026-07-27T07:00:00.000Z',
    },
  },
};

const stubBackend = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: 'teacher.action',
        fullName: 'Giáo viên Action',
        role: 'teacher',
        classes: [{ id: 'class-4a', name: '4A' }],
        mustChangePassword: false,
      },
    },
  }).as('teacherSession');
  cy.intercept('GET', '**/api/gift-shop/catalog', []);
  cy.intercept('GET', '**/api/gift-shop/orders*', []);
  cy.intercept('GET', '**/api/gift-shop/events', []);
  cy.intercept('GET', '**/api/gift-shop/settings', {
    effective: { isOpen: true, closedReason: '', closedScope: null, schoolId: 'teacher.action', classId: 'class-4a' },
    settings: [],
  });
  cy.intercept('GET', '**/api/teacher/action-center', {
    statusCode: 200,
    body: { status: 'success', data: { generatedAt, items: actionItems } },
  }).as('actionCenter');
  cy.intercept('GET', '**/api/results/summary', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        statistics: {
          totalSubmissions: 0,
          averageScore: 0,
          excellentCount: 0,
          excellentRate: 0,
          passRate: 0,
          activeClassCount: 0,
          uniqueStudents: 0,
          todaySubmissions: 0,
        },
        recentSubmissions: [],
        performanceData: [],
      },
    },
  });
  cy.intercept('GET', '**/api/quiz-drafts/draft-latest', {
    statusCode: 200,
    body: remoteDraft,
  }).as('remoteDraft');
};

const visitOverview = () => {
  cy.visit('/teacher/overview', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', authStorageValue);
    },
  });
  cy.wait('@teacherSession');
  cy.location('pathname').should('eq', '/teacher/overview');
  cy.wait('@actionCenter');
  cy.contains('h2', 'Việc cần chú ý hôm nay', { timeout: 20_000 }).should('be.visible');
};

const expectSearchParam = (name: string, value: string) => {
  cy.location('search').then((search) => {
    expect(new URLSearchParams(search).get(name)).to.eq(value);
  });
};

describe('Teacher Action Center', () => {
  beforeEach(() => {
    stubBackend();
  });

  it('opens assignments, Gift Shop and Live Exam with the requested filters', () => {
    visitOverview();
    cy.contains('a', 'Xem bài cần xử lý').click();
    cy.location('pathname').should('eq', '/teacher/assignments');
    expectSearchParam('status', 'OPEN');
    expectSearchParam('due', '48');
    cy.get('select[aria-label="Lọc trạng thái bài giao"]', { timeout: 20_000 }).should('have.value', 'OPEN');

    visitOverview();
    cy.contains('a', 'Mở đơn chờ duyệt').click();
    cy.location('pathname').should('eq', '/teacher/gift-shop');
    expectSearchParam('status', 'PENDING');
    cy.contains('button', 'Chờ duyệt', { timeout: 20_000 }).should('have.attr', 'aria-pressed', 'true');

    visitOverview();
    cy.contains('a', 'Kiểm tra tồn kho').click();
    cy.location('pathname').should('eq', '/teacher/gift-shop');
    expectSearchParam('tab', 'catalog');
    expectSearchParam('stock', 'low');
    cy.contains('button', 'Tồn kho', { timeout: 20_000 }).should('have.attr', 'aria-current', 'page');
    cy.contains('h2', 'Tồn kho phần thưởng').should('be.visible');

    visitOverview();
    cy.contains('a', 'Xem phiên đã lên lịch').click();
    cy.location('pathname').should('eq', '/teacher/live-exams');
    expectSearchParam('status', 'scheduled');
    expectSearchParam('window', '24');
    cy.contains('button', 'Đã lên lịch', { timeout: 20_000 }).should('have.class', 'bg-blue-600');
  });

  it('opens the exact remote draft selected by the server', () => {
    visitOverview();
    cy.contains('a', 'Tiếp tục bản nháp').click();

    cy.location('pathname').should('eq', '/teacher/quizzes/new');
    expectSearchParam('draftId', 'draft-latest');
    cy.wait('@remoteDraft');
    cy.get('#manual-quiz-title', { timeout: 20_000 }).should('have.value', 'Đề đang soạn từ Action Center');
  });
});
