/// <reference types="cypress" />

const student = {
  id: 'student-an',
  fullName: 'Nguyễn Văn An',
  className: '4A9',
  avatar: '',
};

const dashboard = {
  student,
  period: {
    weekStart: '2026-07-20',
    weekEnd: '2026-07-26',
    previousWeekStart: '2026-07-13',
  },
  metrics: {
    completedQuizzes: 3,
    averageScore: 8.5,
    learningSeconds: 2700,
    correctRate: 85,
    pendingAssignments: 1,
    unreadNotifications: 4,
  },
  comparison: { averageScoreDelta: 0.5, completedQuizzesDelta: 1 },
  subjects: [
    { subject: 'Toán', averageScore: 9, correctRate: 90, questionCount: 20, confidence: 'high' },
    { subject: 'Tiếng Việt', averageScore: 7, correctRate: 70, questionCount: 10, confidence: 'medium' },
  ],
  recentActivity: [
    { id: 'result-an', type: 'quiz', title: 'Ôn tập Toán', subject: 'Toán', score: 8.5, occurredAt: '2026-07-22T03:00:00.000Z' },
  ],
  recommendations: ['Ôn thêm phần đọc hiểu Tiếng Việt trong 15 phút.'],
  importantNotifications: [],
};

const notifications = [
  {
    id: 'notification-result', kind: 'quiz_result', title: 'Có kết quả mới', body: 'Ôn tập Toán: 8.5 điểm',
    payload: { resultId: 'result-an' }, isImportant: false, isRead: false,
    publishedAt: '2026-07-22T03:00:00.000Z', expiresAt: null,
  },
  {
    id: 'notification-homework', kind: 'homework_assigned', title: 'Bài tập mới', body: 'Luyện tập Tiếng Việt',
    payload: { assignmentId: 'homework-an' }, isImportant: false, isRead: false,
    publishedAt: '2026-07-22T02:00:00.000Z', expiresAt: null,
  },
  {
    id: 'notification-class', kind: 'class_announcement', title: 'Thông báo lớp', body: 'Họp phụ huynh thứ Sáu',
    payload: {}, isImportant: true, isRead: false,
    publishedAt: '2026-07-22T01:00:00.000Z', expiresAt: null,
  },
  {
    id: 'notification-certificate', kind: 'certificate_issued', title: 'Chứng nhận mới', body: 'Hoàn thành xuất sắc tuần học',
    payload: { certificateId: 'certificate-an' }, isImportant: false, isRead: false,
    publishedAt: '2026-07-22T00:00:00.000Z', expiresAt: null,
  },
];

const result = {
  id: 'result-an', quizId: 'quiz-an', title: 'Ôn tập Toán', subject: 'Toán', score: 8.5,
  correctCount: 17, totalQuestions: 20, correctRate: 85, classification: 'Hoàn thành tốt',
  hasTeacherReport: true, comment: 'Con làm bài cẩn thận.', needsImprovement: 'Ôn thêm bài toán có lời văn.',
  encouragement: 'Tiếp tục phát huy nhé!', submittedAt: '2026-07-22T03:00:00.000Z',
};

function installParentApi(options: { initiallyAuthenticated?: boolean; revoked?: () => boolean } = {}) {
  let authenticated = Boolean(options.initiallyAuthenticated);
  let unreadCount = notifications.length;

  cy.intercept('GET', '**/api/parent/session', req => {
    if (!authenticated || options.revoked?.()) {
      req.reply({ statusCode: 401, body: { error: { code: 'PARENT_SESSION_INVALID', message: 'Phiên đăng nhập không hợp lệ.' } } });
      return;
    }
    req.reply({ statusCode: 200, body: { data: { student, accessCodeMasked: '••••••G234' } } });
  }).as('parentSession');
  cy.intercept('GET', '**/api/parent/activation?token=fixture-token', {
    data: {
      student: { fullName: student.fullName, className: student.className, avatar: '' },
      expiresAt: '2026-07-29T00:00:00.000Z',
    },
  }).as('activationPreview');
  cy.intercept('GET', '**/api/parent/activation?token=old-token', {
    statusCode: 410,
    body: { error: { code: 'PARENT_ACTIVATION_UNAVAILABLE', message: 'Mã kích hoạt đã hết hạn.' } },
  });
  cy.intercept('POST', '**/api/parent/activate', req => {
    expect(req.body).to.deep.equal({ token: 'fixture-token', pin: '123456' });
    authenticated = true;
    req.reply({ statusCode: 200, body: { data: { student, accessCodeMasked: '••••••G234' } } });
  }).as('activateParent');
  cy.intercept('POST', '**/api/parent/login', req => {
    authenticated = true;
    req.reply({ statusCode: 200, body: { data: { student, accessCodeMasked: '••••••G234' } } });
  });
  cy.intercept('GET', '**/api/parent/dashboard*', { data: dashboard }).as('dashboard');
  cy.intercept('GET', '**/api/parent/notifications*', req => {
    req.reply({ data: { items: notifications.map(item => ({ ...item, isRead: unreadCount === 0 })), nextCursor: null, unreadCount } });
  }).as('notifications');
  cy.intercept('PATCH', '**/api/parent/notifications/*/read', req => {
    unreadCount = Math.max(0, unreadCount - 1);
    req.reply({ statusCode: 200, body: { data: { id: 'notification-result', isRead: true, readAt: '2026-07-22T04:00:00.000Z' } } });
  });
  cy.intercept('POST', '**/api/parent/notifications/read-all', req => {
    unreadCount = 0;
    req.reply({ statusCode: 200, body: { data: { updatedCount: 4 } } });
  });
  cy.intercept('GET', /\/api\/parent\/results(?:\?.*)?$/, {
    data: { items: [result], page: 1, limit: 50, total: 1, totalPages: 1 },
  }).as('resultList');
  cy.intercept('GET', /\/api\/parent\/results\/result-an(?:\?.*)?$/, { data: result }).as('resultAn');
  cy.intercept('GET', /\/api\/parent\/results\/result-b(?:\?.*)?$/, {
    statusCode: 404,
    body: { error: { code: 'PARENT_RESULT_NOT_FOUND', message: 'Không tìm thấy kết quả.' } },
  }).as('resultB');
  cy.intercept('GET', '**/api/parent/assignments*', {
    data: {
      items: [{
        id: 'homework-an', assignmentId: 'assignment-an', title: 'Luyện tập Tiếng Việt', subject: 'Tiếng Việt',
        deadline: '2026-07-25T00:00:00.000Z', status: 'pending', score: null, teacherFeedback: null,
        submittedAt: null, publishedAt: '2026-07-22T00:00:00.000Z',
      }],
      page: 1, limit: 20, total: 1, totalPages: 1,
    },
  });
  cy.intercept('GET', '**/api/parent/certificates*', {
    data: {
      items: [{
        id: 'certificate-an', batchId: 'batch-1', title: 'Hoàn thành xuất sắc', teacherName: 'Cô Lan',
        message: 'Chúc mừng con!', quizTitle: 'Ôn tập Toán', studentScore: 8.5, imageUrl: null,
        issuedAt: '2026-07-22T00:00:00.000Z', sentAt: '2026-07-22T00:00:00.000Z', status: 'sent',
      }],
      page: 1, limit: 20, total: 1, totalPages: 1,
    },
  });
  cy.intercept('POST', '**/api/parent/logout', req => {
    authenticated = false;
    req.reply({ statusCode: 204 });
  }).as('logout');
}

describe('Parent Portal end-to-end contracts', () => {
  it('activates a QR, reads all communication categories, opens safe history and logs out', () => {
    installParentApi();
    const activationUrl = '/activate?token=fixture-token&portal=parent';
    cy.visit(activationUrl);
    cy.wait('@activationPreview');
    cy.contains('Nguyễn Văn An').should('be.visible');
    cy.get('input[aria-label="Tạo PIN 6 số"]').type('123456');
    cy.get('input[aria-label="Nhập lại PIN"]').type('123456');
    cy.contains('button', 'Kích hoạt và đăng nhập').click();
    cy.wait('@activateParent');
    cy.wait('@dashboard');
    cy.contains('Tổng quan tuần').should('be.visible');
    cy.contains('Nguyễn Văn An').should('be.visible');
    cy.contains('Nguyễn Văn Bình').should('not.exist');

    cy.get('a[aria-label="Thông báo"]').click();
    cy.wait('@notifications');
    cy.contains('Có kết quả mới').should('be.visible');
    cy.contains('Bài tập mới').should('be.visible');
    cy.contains('Thông báo lớp').should('be.visible');
    cy.contains('Chứng nhận mới').should('be.visible');
    cy.contains('button', 'Đánh dấu tất cả đã đọc').click();
    cy.wait('@notifications');

    cy.contains('a', 'Kết quả').filter(':visible').first().click();
    cy.get('select[aria-label="Khoảng thời gian"]').should('have.value', 'all');
    cy.contains('Ôn tập Toán').click();
    cy.contains('Con làm bài cẩn thận.').should('be.visible');
    cy.get('[data-testid="question-list"], [data-testid="answer-list"]').should('not.exist');

    cy.contains('a', 'Cá nhân').filter(':visible').first().click();
    cy.contains('••••••G234').should('be.visible');
    cy.contains('button', 'Đăng xuất').click();
    cy.wait('@logout');
    cy.contains('Đăng nhập phụ huynh').should('be.visible');
  });

  it('blocks another student result and invalidates revoked or reissued access', () => {
    let revoked = false;
    installParentApi({ revoked: () => revoked });
    cy.visit('/login?portal=parent');
    cy.get('input[autocomplete="username"]').type('ABCDEFG234');
    cy.get('input[autocomplete="current-password"]').type('123456');
    cy.contains('button', 'Đăng nhập').click();
    cy.wait('@dashboard');
    cy.contains('Tổng quan tuần').should('be.visible');
    cy.window().then(win => {
      win.history.pushState({}, '', '/results/result-b?portal=parent');
      win.dispatchEvent(new PopStateEvent('popstate'));
    });
    cy.wait('@resultB');
    cy.contains('Nguyễn Văn Bình').should('not.exist');
    cy.get('[role="alert"]').should('be.visible');

    revoked = true;
    cy.window().then(win => {
      win.history.pushState({}, '', '/dashboard?portal=parent');
      win.dispatchEvent(new PopStateEvent('popstate'));
    });
    cy.reload();
    cy.wait('@parentSession');
    cy.contains('Đăng nhập phụ huynh').should('be.visible');

    cy.visit('/activate?token=old-token&portal=parent');
    cy.contains('Liên kết kích hoạt đã hết hạn hoặc không còn sử dụng được.').should('be.visible');
  });
});
