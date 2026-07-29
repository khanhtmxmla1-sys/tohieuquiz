const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'teacher.intervention',
    teacherName: 'Giáo viên Can thiệp',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const student = {
  studentId: 'student-1',
  studentName: 'Lan',
  classId: 'class-4a',
  className: '4A',
  latestResultId: 'result-3',
  latestSubmittedAt: '2026-07-28T08:00:00.000Z',
  firstAttemptScore: 4,
  latestAttemptScore: 6,
  scoreDelta: 2,
  attemptCount: 3,
  skillAccuracy: 33,
  skillSampleSize: 3,
  confidence: 0.6,
  fourWeekTrend: [],
};

const recommendation = {
  quizId: 'quiz-practice',
  title: 'Luyện tập phân số',
  questionCount: 10,
  matchedQuestionCount: 8,
  confidence: 0.8,
};

const suggestion = {
  key: 'class-4a:math:phan_so',
  title: 'Cần hỗ trợ ở Phân số',
  classId: 'class-4a',
  className: '4A',
  subject: 'math',
  subjectLabel: 'Toán',
  skillCode: 'phan_so',
  skillLabel: 'Phân số',
  sampleSize: 3,
  confidence: 0.6,
  studentCount: 1,
  averageFirstScore: 4,
  averageLatestScore: 6,
  averageScoreDelta: 2,
  students: [student],
  recommendedQuizzes: [recommendation],
};

const group = {
  id: 'group-1',
  name: 'Cần hỗ trợ ở Phân số',
  status: 'ACTIVE',
  classId: 'class-4a',
  className: '4A',
  subject: 'math',
  subjectLabel: 'Toán',
  skillCode: 'phan_so',
  skillLabel: 'Phân số',
  sampleSize: 3,
  confidence: 0.6,
  recommendedQuizzes: [recommendation],
  members: [student],
  notes: [],
  createdAt: '2026-07-29T08:00:00.000Z',
  updatedAt: '2026-07-29T08:00:00.000Z',
};

const visitResults = () => {
  let groups: typeof group[] = [];

  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: 'teacher.intervention',
        fullName: 'Giáo viên Can thiệp',
        role: 'teacher',
        classes: [{ id: 'class-4a', name: '4A' }],
        mustChangePassword: false,
      },
    },
  }).as('teacherSession');
  cy.intercept('GET', '**/api/quizzes', {
    statusCode: 200,
    body: [
      {
        id: 'quiz-other', title: 'Bài khác', class_level: '4', category: 'toan',
        time_limit: 10, created_at: '2026-07-20T08:00:00.000Z', created_by: 'teacher.intervention',
      },
      {
        id: 'quiz-practice', title: 'Luyện tập phân số', class_level: '4', category: 'toan',
        time_limit: 15, created_at: '2026-07-21T08:00:00.000Z', created_by: 'teacher.intervention',
      },
    ],
  }).as('quizzes');
  cy.intercept('GET', '**/api/questions', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/results', {
    statusCode: 200,
    body: {
      data: [{
        id: 'result-3', studentName: 'Lan', studentClass: '4A', quizId: 'quiz-practice',
        quizTitle: 'Luyện tập phân số', score: 6, correctCount: 6, totalQuestions: 10,
        timeTaken: 500, submittedAt: '2026-07-28T08:00:00.000Z', answers: '{}',
      }],
    },
  }).as('results');
  cy.intercept('GET', '**/api/results/summary', {
    statusCode: 200,
    body: {
      data: {
        statistics: {
          totalSubmissions: 1, averageScore: 6, excellentCount: 0, excellentRate: 0,
          passRate: 100, activeClassCount: 1, uniqueStudents: 1, todaySubmissions: 0,
        },
        recentSubmissions: [],
        performanceData: [],
      },
    },
  });
  cy.intercept({ method: 'GET', pathname: '/api/results/interventions' }, (request) => {
    request.reply({
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          generatedAt: '2026-07-29T08:00:00.000Z',
          criteria: { windowDays: 28, minimumSampleSize: 3, minimumConfidence: 0.55 },
          suggestions: [suggestion],
          groups,
        },
      },
    });
  }).as('interventions');
  cy.intercept({ method: 'POST', pathname: '/api/results/interventions/groups' }, (request) => {
    expect(request.body).to.include({ suggestionKey: suggestion.key });
    groups = [group];
    request.reply({ statusCode: 201, body: { status: 'success', data: group } });
  }).as('createGroup');
  cy.intercept({ method: 'POST', pathname: '/api/results/interventions/groups/group-1/notes' }, (request) => {
    expect(request.body.note).to.eq('Dùng thêm mô hình phân số trực quan.');
    request.reply({
      statusCode: 201,
      body: {
        status: 'success',
        data: {
          id: 'note-1', groupId: 'group-1', studentId: null,
          note: request.body.note,
          createdAt: '2026-07-29T09:00:00.000Z',
          updatedAt: '2026-07-29T09:00:00.000Z',
        },
      },
    });
  }).as('saveNote');
  cy.intercept({ method: 'POST', pathname: '/api/results/interventions/groups/group-1/assignments' }, (request) => {
    expect(request.body.quizId).to.eq('quiz-practice');
    expect(request.body.maxAttempts).to.eq(1);
    expect(request.body.idempotencyKey).to.match(/^intervention-group-1-/);
    request.reply({
      statusCode: 201,
      body: {
        status: 'success',
        data: {
          groupId: 'group-1', assignmentIds: ['assignment-1'],
          skippedAssignmentIds: [], replayed: false,
        },
      },
    });
  }).as('assignGroup');

  cy.visit('/teacher/results?class=4A', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', authStorageValue);
    },
  });
  cy.wait('@teacherSession');
  cy.wait('@results');
  cy.wait('@interventions', { requestTimeout: 20_000 });
  cy.contains('h3', 'Trung tâm hỗ trợ học tập', { timeout: 20_000 }).should('be.visible');
};

describe('Results Intervention Center', () => {
  it('creates a support group, saves a private note and assigns recommended practice', () => {
    visitResults();

    cy.contains('button', 'Tạo nhóm hỗ trợ').click();
    cy.wait('@createGroup');
    cy.wait('@interventions');
    cy.contains('h3', 'Nhóm đang theo dõi').parent().should('contain.text', '1 nhóm');

    cy.contains('button', 'Chi tiết').click();
    cy.contains('Ghi chú riêng — chỉ giáo viên nhìn thấy').should('be.visible');
    cy.get('textarea[placeholder^="Ghi lại hoàn cảnh"]').type('Dùng thêm mô hình phân số trực quan.');
    cy.contains('button', 'Lưu ghi chú').click();
    cy.wait('@saveNote');

    cy.contains('button', 'Tạo bài luyện').click();
    cy.get('select').filter(':visible').contains('option', '★ Luyện tập phân số');
    cy.contains('button', 'Giao bài cho nhóm').click();
    cy.wait('@assignGroup');
    cy.contains('Đã tạo 1 bài luyện tập cá nhân.').should('be.visible');
  });
});
