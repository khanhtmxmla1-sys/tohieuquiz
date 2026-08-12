type AxeViolation = { impact: string | null; id: string; help: string };
type AxeWindow = Window & {
  axe: { run: (context: Element) => Promise<{ violations: AxeViolation[] }> };
};

const authStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'teacher.intervention',
    teacherName: 'Giáo viên Hỗ trợ',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const readiness = {
  studentsInScope: 2,
  resultsInWindow: 6,
  quizzesInScope: 1,
  questionsInScope: 10,
  questionsWithSkillMetadata: 10,
  skillMetadataCoveragePercent: 100,
  studentSkillSignals: 2,
  eligibleSignals: 2,
  excludedSignals: {
    stable: 0,
    insufficientSamples: 0,
    lowConfidence: 0,
    missingMetadata: 0,
  },
};

const makeStudent = (studentId: string, studentName: string, skillAccuracy: number) => ({
  studentId,
  studentName,
  classId: 'class-4a',
  className: '4A',
  latestResultId: `result-${studentId}`,
  latestSubmittedAt: '2026-08-10T08:00:00.000Z',
  firstAttemptScore: 4,
  latestAttemptScore: 5,
  scoreDelta: 1,
  attemptCount: 3,
  skillAccuracy,
  skillSampleSize: 3,
  confidence: 0.67,
  fourWeekTrend: [],
});

const lan = makeStudent('student-1', 'Lan', 33);
const minh = makeStudent('student-2', 'Minh', 40);

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
  sampleSize: 6,
  confidence: 0.67,
  studentCount: 2,
  averageFirstScore: 4,
  averageLatestScore: 5,
  averageScoreDelta: 1,
  evidence: {
    reason: 'LOW_ACCURACY',
    averageSkillAccuracy: 36.5,
    minimumSkillAccuracy: 33,
    recentAttemptCount: 6,
    improvingStudentCount: 0,
    unchangedStudentCount: 2,
    decliningStudentCount: 0,
  },
  students: [lan, minh],
  recommendedQuizzes: [recommendation],
};

const emptyProgress = {
  status: 'NO_ASSIGNMENT',
  assignedCount: 0,
  completedCount: 0,
  completionPercent: 0,
  improvingCount: 0,
  needsAttentionCount: 0,
  waitingCount: 0,
  averageSkillAccuracyDelta: null,
  averageScoreDelta: null,
  evaluatedAt: '2026-08-12T00:00:00.000Z',
  members: [{
    studentId: 'student-1',
    baselineSkillAccuracy: 33,
    currentSkillAccuracy: null,
    skillAccuracyDelta: null,
    baselineScore: 5,
    currentScore: null,
    scoreDelta: null,
    assignedCount: 0,
    completedCount: 0,
    postInterventionSampleSize: 0,
    lastResultAt: null,
    status: 'NO_ASSIGNMENT',
  }],
};

const improvingProgress = {
  status: 'IMPROVING',
  assignedCount: 1,
  completedCount: 1,
  completionPercent: 100,
  improvingCount: 1,
  needsAttentionCount: 0,
  waitingCount: 0,
  averageSkillAccuracyDelta: 34,
  averageScoreDelta: 2,
  evaluatedAt: '2026-08-12T00:10:00.000Z',
  members: [{
    studentId: 'student-1',
    baselineSkillAccuracy: 33,
    currentSkillAccuracy: 67,
    skillAccuracyDelta: 34,
    baselineScore: 5,
    currentScore: 7,
    scoreDelta: 2,
    assignedCount: 1,
    completedCount: 1,
    postInterventionSampleSize: 3,
    lastResultAt: '2026-08-12T00:09:00.000Z',
    status: 'IMPROVING',
  }],
};

const makeGroup = () => ({
  id: 'group-1',
  name: 'Hỗ trợ Phân số — 4A',
  status: 'ACTIVE',
  classId: 'class-4a',
  className: '4A',
  subject: 'math',
  subjectLabel: 'Toán',
  skillCode: 'phan_so',
  skillLabel: 'Phân số',
  sampleSize: 3,
  confidence: 0.67,
  recommendedQuizzes: [recommendation],
  members: [lan],
  notes: [],
  progress: emptyProgress,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
});

type DashboardMode = 'flow' | 'no-results' | 'missing-metadata';

const noResultsReadiness = {
  ...readiness,
  resultsInWindow: 0,
  questionsInScope: 0,
  questionsWithSkillMetadata: 0,
  skillMetadataCoveragePercent: 0,
  studentSkillSignals: 0,
  eligibleSignals: 0,
};

const missingMetadataReadiness = {
  ...readiness,
  questionsWithSkillMetadata: 4,
  skillMetadataCoveragePercent: 40,
  eligibleSignals: 0,
  excludedSignals: {
    ...readiness.excludedSignals,
    missingMetadata: 3,
  },
};

const installResultsStubs = (mode: DashboardMode = 'flow') => {
  let currentGroup: ReturnType<typeof makeGroup> | null = null;
  let archivedGroup: ReturnType<typeof makeGroup> | null = null;
  let groupCreated = false;
  let assignmentOpen = false;

  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: 'teacher.intervention',
        fullName: 'Giáo viên Hỗ trợ',
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
        time_limit: 10, created_at: '2026-08-01T08:00:00.000Z', created_by: 'teacher.intervention',
      },
      {
        id: 'quiz-practice', title: 'Luyện tập phân số', class_level: '4', category: 'toan',
        time_limit: 15, created_at: '2026-08-02T08:00:00.000Z', created_by: 'teacher.intervention',
      },
    ],
  }).as('quizzes');
  cy.intercept('GET', '**/api/questions', { statusCode: 200, body: [] });
  cy.intercept('GET', '**/api/results', {
    statusCode: 200,
    body: {
      data: [{
        id: 'result-student-1', studentName: 'Lan', studentClass: '4A', quizId: 'quiz-practice',
        quizTitle: 'Luyện tập phân số', score: 5, correctCount: 5, totalQuestions: 10,
        timeTaken: 500, submittedAt: '2026-08-10T08:00:00.000Z', answers: '{}',
      }],
    },
  }).as('results');
  cy.intercept('GET', '**/api/results/summary', {
    statusCode: 200,
    body: {
      data: {
        statistics: {
          totalSubmissions: 1, averageScore: 5, excellentCount: 0, excellentRate: 0,
          passRate: 100, activeClassCount: 1, uniqueStudents: 1, todaySubmissions: 0,
        },
        recentSubmissions: [],
        performanceData: [],
      },
    },
  });
  cy.intercept({ method: 'GET', pathname: '/api/results/interventions' }, (request) => {
    const modeReadiness = mode === 'no-results'
      ? noResultsReadiness
      : mode === 'missing-metadata'
        ? missingMetadataReadiness
        : readiness;
    request.reply({
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          generatedAt: '2026-08-12T00:00:00.000Z',
          criteria: { windowDays: 28, minimumSampleSize: 3, minimumConfidence: 0.55 },
          readiness: modeReadiness,
          suggestions: mode === 'flow' && !groupCreated ? [suggestion] : [],
          groups: currentGroup ? [currentGroup] : [],
          archivedGroups: archivedGroup ? [archivedGroup] : [],
        },
      },
    });
  }).as('interventions');
  cy.intercept({ method: 'POST', pathname: '/api/results/interventions/groups' }, (request) => {
    expect(request.body.suggestionKey).to.eq(suggestion.key);
    expect(request.body.studentIds).to.deep.eq(['student-1']);
    currentGroup = makeGroup();
    groupCreated = true;
    request.reply({ statusCode: 201, body: { status: 'success', data: currentGroup } });
  }).as('createGroup');
  cy.intercept({ method: 'POST', pathname: '/api/results/interventions/groups/group-1/notes' }, (request) => {
    expect(request.body).to.deep.eq({ note: 'Dùng thêm mô hình phân số trực quan.' });
    const saved = {
      id: 'note-1', groupId: 'group-1', studentId: null,
      note: request.body.note,
      createdAt: '2026-08-12T00:05:00.000Z',
      updatedAt: '2026-08-12T00:05:00.000Z',
    };
    if (currentGroup) currentGroup = { ...currentGroup, notes: [saved] };
    request.reply({ statusCode: 201, body: { status: 'success', data: saved } });
  }).as('saveNote');
  cy.intercept({ method: 'GET', pathname: '/api/results/interventions/groups/group-1/assignments/preview' }, (request) => {
    request.reply({
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          groupId: 'group-1', quizId: 'quiz-practice', memberCount: 1,
          openAssignmentCount: assignmentOpen ? 1 : 0,
          assignableCount: assignmentOpen ? 0 : 1,
        },
      },
    });
  }).as('assignmentPreview');
  cy.intercept({ method: 'POST', pathname: '/api/results/interventions/groups/group-1/assignments' }, (request) => {
    expect(request.body.quizId).to.eq('quiz-practice');
    expect(request.body.maxAttempts).to.eq(1);
    expect(request.body.idempotencyKey).to.match(/^intervention-group-1-/);
    assignmentOpen = true;
    if (currentGroup) currentGroup = { ...currentGroup, progress: improvingProgress };
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
  cy.intercept({ method: 'POST', pathname: '/api/results/interventions/groups/group-1/archive' }, (request) => {
    expect(request.body.reason).to.eq('GOAL_REACHED');
    expect(request.body.note).to.eq('Đã đạt mục tiêu hỗ trợ.');
    if (currentGroup) archivedGroup = { ...currentGroup, status: 'ARCHIVED' };
    currentGroup = null;
    request.reply({
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          groupId: 'group-1', status: 'ARCHIVED', reason: 'GOAL_REACHED',
          note: 'Đã đạt mục tiêu hỗ trợ.', archivedAt: '2026-08-12T00:15:00.000Z',
        },
      },
    });
  }).as('archiveGroup');
};

const visitResults = (mode: DashboardMode = 'flow') => {
  installResultsStubs(mode);
  cy.visit('/teacher/results?class=4A', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', authStorageValue);
    },
  });
  cy.wait('@teacherSession');
  cy.wait('@results');
  cy.wait('@interventions', { requestTimeout: 20_000 });
  cy.contains('h3', 'Gợi ý hỗ trợ học sinh', { timeout: 20_000 }).should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.window().then((win) => {
    const doc = win.document.documentElement;
    expect(doc.scrollWidth, 'document scrollWidth').to.be.lte(doc.clientWidth + 1);
  });
};

const assertInterventionTargetsAreAtLeast44px = () => {
  cy.get('section[aria-label="Gợi ý hỗ trợ học sinh"] button:visible').each(($button) => {
    const rect = $button[0].getBoundingClientRect();
    expect(rect.height, `${$button.text().trim()} target height`).to.be.gte(44);
  });
};

const assertNoSeriousInterventionA11yViolations = () => {
  cy.readFile('node_modules/axe-core/axe.min.js', 'utf8').then((source) => {
    cy.window().then((win) => {
      const existing = win.document.querySelector('script[data-intervention-axe]');
      existing?.remove();
      const script = win.document.createElement('script');
      script.dataset.interventionAxe = 'true';
      script.textContent = source;
      win.document.head.appendChild(script);
    });
  });
  cy.get('section[aria-label="Gợi ý hỗ trợ học sinh"]').then(($section) => {
    cy.window().then((win) => {
      const autAxe = (win as unknown as AxeWindow).axe;
      return autAxe.run($section[0]).then(({ violations }) => {
        const serious = violations
          .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
          .map((violation) => `${violation.id}: ${violation.help}`);
        expect(serious, 'serious/critical axe violations').to.deep.equal([]);
      });
    });
  });
};

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
];

describe('Results Intervention Center', () => {
  it('completes suggestion → group → note → assignment → progress → archive with keyboard-safe focus', () => {
    visitResults();

    cy.contains('button', 'Tạo nhóm hỗ trợ').focus().should('be.focused').click();
    cy.contains('Xem lại học sinh trước khi tạo nhóm').should('be.visible');
    cy.get('input[aria-label^="Minh ·"]').focus().should('be.focused').uncheck().should('not.be.checked');
    cy.contains('button', 'Xác nhận tạo nhóm').focus().should('be.focused').click();
    cy.wait('@createGroup');
    cy.wait('@interventions');
    cy.get('#intervention-group-group-1').should('be.focused');

    cy.contains('button', 'Chi tiết').click();
    cy.contains('Chỉ giáo viên phụ trách và quản trị viên được phép mới xem được').should('be.visible');
    cy.get('textarea[placeholder^="Ghi lại hoàn cảnh"]').type('Dùng thêm mô hình phân số trực quan.');
    cy.contains('button', 'Lưu ghi chú').click();
    cy.wait('@saveNote');
    cy.wait('@interventions');

    cy.contains('button', 'Tạo bài luyện').focus().should('be.focused').click();
    cy.wait('@assignmentPreview');
    cy.get('select[id^="intervention-quiz-"]').should('have.value', 'quiz-practice');
    cy.contains('8/10 câu khớp kỹ năng · 80% mức khớp').should('be.visible');
    cy.contains('Có thể tạo mới cho 1/1 học sinh · 0 học sinh đã có bài đang mở').should('be.visible');
    cy.contains('button', 'Giao bài cho nhóm').click();
    cy.wait('@assignGroup');
    cy.wait('@interventions');
    cy.contains('Đang tiến bộ').should('be.visible');
    cy.contains('Độ chính xác kỹ năng: +34 điểm %').should('be.visible');

    cy.contains('button', 'Lưu trữ nhóm').focus().should('be.focused').click();
    cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
    cy.get('select[id^="archive-reason-"]').should('be.focused');
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('button', 'Lưu trữ nhóm').should('be.focused');

    cy.contains('button', 'Lưu trữ nhóm').focus().should('be.focused').click();
    cy.get('select[id^="archive-reason-"]').select('GOAL_REACHED');
    cy.get('textarea[id^="archive-note-"]').type('Đã đạt mục tiêu hỗ trợ.');
    cy.contains('button', 'Xác nhận lưu trữ').click();
    cy.wait('@archiveGroup');
    cy.wait('@interventions');
    cy.contains('Đã kết thúc (1)').click();
    cy.get('#intervention-group-group-1').within(() => {
      cy.contains('Nhóm đã được lưu trữ và chỉ còn chế độ xem.').should('be.visible');
      cy.contains('button', 'Tạo bài luyện').should('not.exist');
      cy.contains('button', 'Lưu trữ nhóm').should('not.exist');
    });

    assertNoSeriousInterventionA11yViolations();
  });

  it('has no horizontal overflow and keeps action targets usable at required viewports', () => {
    visitResults();

    VIEWPORTS.forEach(({ width, height }) => {
      cy.viewport(width, height);
      assertNoHorizontalOverflow();
      assertInterventionTargetsAreAtLeast44px();
      cy.contains('Lớp 4A').should('be.visible');
      cy.contains('Tất cả bài kiểm tra').should('be.visible');
      cy.contains('28 ngày').should('be.visible');
    });
  });

  it('shows deterministic no-data guidance', () => {
    visitResults('no-results');
    cy.contains('Chưa có bài làm trong 28 ngày gần nhất.').should('be.visible');
    cy.contains('Chưa đủ dữ liệu').should('be.visible');
    assertNoSeriousInterventionA11yViolations();
  });

  it('shows deterministic missing-metadata guidance', () => {
    visitResults('missing-metadata');
    cy.contains('Nhiều câu hỏi chưa có thông tin kỹ năng.').should('be.visible');
    cy.contains('40% câu có gắn kỹ năng').should('be.visible');
    assertNoSeriousInterventionA11yViolations();
  });
});
