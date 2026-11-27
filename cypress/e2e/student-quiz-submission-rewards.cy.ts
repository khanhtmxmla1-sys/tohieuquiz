/// <reference types="cypress" />

const QUIZ_ID = 'student-submission-rewards-fixture';
const ASSIGNMENT_ID = 'assignment-submission-rewards-fixture';
const STUDENT_ID = 'student-submission-rewards-fixture';
const USERNAME = 'student.submission.rewards.fixture';
const ACCESS_GRANT = 'grant-submission-rewards-fixture';
const PRACTICE_ID = 'secure-practice-submission-rewards-fixture';
const PRACTICE_TOKEN = 'secure-practice-fixture-token';

const formalQuestions = [
  {
    id: 'submission-q1',
    quizId: QUIZ_ID,
    type: 'MCQ',
    question: 'Một câu hỏi formal không chứa đáp án chấm điểm.',
    options: ['A', 'B'],
  },
  {
    id: 'submission-q2',
    quizId: QUIZ_ID,
    type: 'MCQ',
    question: 'Một câu hỏi formal thứ hai không chứa đáp án chấm điểm.',
    options: ['A', 'B'],
  },
];

const practiceQuestions = [{
  id: 'practice-q1',
  quizId: PRACTICE_ID,
  type: 'MCQ',
  question: 'Câu luyện tập secure không gửi đáp án xuống learner.',
  options: ['A', 'B'],
}];

const studentProfile = {
  studentId: STUDENT_ID,
  fullName: 'Học sinh thưởng bài làm',
  username: USERNAME,
  classId: 'class-submission-rewards-fixture',
  className: '4A1',
  avatar: 'default',
  coins: 25,
  pet: {
    petId: 'cat_01',
    petName: 'Mèo kiểm thử',
    level: 3,
    exp: 40,
    expToNext: 100,
    mood: 'happy',
    items: [],
    lastActive: '2026-01-01T00:00:00.000Z',
  },
  shopItems: [],
};

const assignment = {
  id: ASSIGNMENT_ID,
  quizId: QUIZ_ID,
  classId: studentProfile.classId,
  deadline: '2099-01-01T00:00:00.000Z',
  maxAttempts: 2,
  attemptCount: 0,
  status: 'OPEN',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const makeFormalQuiz = (options: { assigned?: boolean; requireCode?: boolean; timeLimit?: number } = {}) => ({
  id: QUIZ_ID,
  title: 'Bài kiểm thử nộp bài và phần thưởng',
  classLevel: '4',
  category: 'characterization',
  timeLimit: options.timeLimit ?? 10,
  duration: options.timeLimit ?? 10,
  requireCode: options.requireCode ?? false,
  isPractice: false,
  questions: formalQuestions,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...(options.assigned ? { _assignmentData: assignment } : {}),
});

const securePracticeQuiz = {
  id: PRACTICE_ID,
  title: 'Bài luyện tập secure authoritative',
  classLevel: '4',
  category: 'practice',
  timeLimit: 0,
  duration: 0,
  requireCode: false,
  isPractice: true,
  questions: practiceQuestions,
  createdAt: '2026-01-01T00:00:00.000Z',
  practiceSession: {
    version: 'server-v1',
    token: PRACTICE_TOKEN,
    expiresAt: '2099-01-01T00:00:00.000Z',
  },
};

const installQuizState = (win: Window, quiz: object, restoreStudent = false) => {
  win.localStorage.clear();
  win.sessionStorage.clear();
  if (restoreStudent) win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'student',
      quizzes: [quiz],
      selectedQuiz: quiz,
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};

const blockUnexpectedWrites = () => {
  // Register this before the allow-listed fixtures. Cypress resolves non-middleware
  // intercepts in reverse order, so every unlisted API write fails locally.
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    cy.intercept({ method, pathname: '/api/**' }, (request) => {
      request.reply({
        statusCode: 500,
        body: { status: 'error', message: `Unexpected write: ${request.method} ${request.url}` },
      });
    }).as('unexpectedWrite');
  }
};

const stubCommonReads = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/system-settings*', {
    statusCode: 200,
    body: { status: 'success', data: { aiAssistantEnabled: false } },
  });
  cy.intercept({ method: 'POST', pathname: '/api/client-telemetry' }, (request) => {
    expect(request.body, 'only expected performance telemetry').to.include({ kind: 'web_vital' });
    request.reply({ statusCode: 202, body: { status: 'success' } });
  });
};

const stubStudentProfile = () => {
  cy.intercept('GET', '**/api/student-profile', {
    statusCode: 200,
    body: { status: 'success', data: studentProfile },
  }).as('studentProfile');
};

const stubFormalStart = (quiz = makeFormalQuiz(), expectedAssignmentId?: string) => {
  cy.intercept({ method: 'POST', pathname: `/api/quizzes/${quiz.id}/play-questions` }, (request) => {
    if (expectedAssignmentId) {
      expect(request.body).to.deep.include({ assignmentId: expectedAssignmentId });
    }
    request.reply({
      statusCode: 200,
      body: {
        quizId: quiz.id,
        revision: 1,
        questions: formalQuestions,
      },
    });
  }).as('playQuestions');
};

const stubAssignmentStart = () => {
  cy.intercept({ method: 'POST', pathname: `/api/assignments/${ASSIGNMENT_ID}/start` }, (request) => {
    expect(request.body).to.deep.include({
      assignmentId: ASSIGNMENT_ID,
      studentId: STUDENT_ID,
    });
    request.reply({
      statusCode: 200,
      body: { status: 'success', data: { ...assignment, attemptCount: 1, remainingAttempts: 1 } },
    });
  }).as('startAssignment');
};

const authoritativeFormalResponse = (resultId: string, assignmentId: string | null = null) => ({
  status: 'success',
  resultId,
  assignmentId,
  classId: assignmentId ? assignment.classId : null,
  score: 5,
  correctCount: 1,
  questionCount: 2,
  totalQuestions: 2,
  voidedCount: 0,
  gradingVersion: 'worker-v1',
  answers: {
    'submission-q1': { selectedAnswer: 'option-0', isCorrect: true, status: 'correct' },
    'submission-q2': { selectedAnswer: null, isCorrect: false, status: 'skipped' },
  },
  validationDetails: [
    { questionId: 'submission-q1', isCorrect: true, status: 'correct' },
    { questionId: 'submission-q2', isCorrect: false, status: 'skipped' },
  ],
  reviewDetails: [],
});

const rewardResponse = {
  status: 'success',
  data: {
    awardedExp: 20,
    awardedCoins: 8,
    newLevel: 3,
    newExp: 60,
    newExpToNext: 100,
    newCoins: 33,
    leveledUp: false,
    alreadyClaimed: false,
    mood: 'happy',
  },
};

const trackActivityResponse = {
  status: 'success',
  data: {
    wallet: { coins: 33 },
    missions: [],
    achievements: [],
  },
};

const openSubmitConfirmation = () => {
  cy.contains('button:visible', 'Nộp bài').last().click();
  cy.get('[role="dialog"][aria-modal="true"]').should('be.visible');
};

const confirmSubmit = () => {
  cy.get('[role="dialog"][aria-modal="true"]')
    .contains('button', 'Đồng ý nộp')
    .click();
};

const startGuestFormalQuiz = (quiz = makeFormalQuiz()) => {
  stubFormalStart(quiz);
  cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz) });
  cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh khách');
  cy.get('select').select('4A1');
  cy.contains('button', 'Bắt đầu làm bài!').click();
  cy.wait('@playQuestions');
  cy.get('#question-submission-q1').should('be.visible');
};

const startLoggedInAssignmentQuiz = () => {
  const quiz = makeFormalQuiz({ assigned: true, requireCode: true });
  stubStudentProfile();
  stubFormalStart(quiz, ASSIGNMENT_ID);
  stubAssignmentStart();
  cy.intercept({ method: 'POST', pathname: `/api/quizzes/access-verification/${QUIZ_ID}` }, (request) => {
    expect(request.body).to.deep.include({ accessCode: 'GOOD', assignmentId: ASSIGNMENT_ID });
    request.reply({
      statusCode: 200,
      body: { valid: true, accessGrant: ACCESS_GRANT, expiresAt: '2099-01-01T00:10:00.000Z', revision: 1 },
    });
  }).as('verifyCode');

  cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz, true) });
  cy.wait('@studentProfile');
  cy.get('input[placeholder="ABC123"]').type('good{enter}');
  cy.wait('@verifyCode');
  cy.contains('button', 'Bắt đầu làm bài').click();
  cy.wait('@playQuestions');
  cy.wait('@startAssignment');
  cy.get('#question-submission-q1').should('be.visible');
};

const assertNoUnexpectedWrites = () => {
  cy.get('@unexpectedWrite.all').then((interceptions) => {
    if (interceptions.length > 0) {
      throw new Error(`unexpected writes: ${interceptions.map((item) => item.request.url).join(', ')}`);
    }
  });
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth + 1);
  });
};

describe('student quiz submission rewards characterization', () => {
  beforeEach(() => {
    blockUnexpectedWrites();
    stubCommonReads();
  });

  it('guest formal submission renders the authoritative result without claiming a reward', () => {
    const quiz = makeFormalQuiz();
    cy.intercept({ method: 'POST', pathname: '/api/results' }, (request) => {
      expect(request.body).to.include({
        quizId: QUIZ_ID,
        score: 0,
        correctCount: 0,
        questionCount: 2,
        totalQuestions: 2,
      });
      expect(request.body).not.to.have.property('accessGrant');
      expect(request.body.answers).to.have.property('_questionOrder');
      request.reply({ statusCode: 200, body: authoritativeFormalResponse('server-guest-result') });
    }).as('saveResult');

    startGuestFormalQuiz(quiz);
    openSubmitConfirmation();
    confirmSubmit();
    cy.wait('@saveResult');
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Kết quả đã được lưu');
    cy.get('[role="dialog"][aria-modal="true"]').contains('button', 'Xem kết quả').click();
    cy.get('#result-summary-title').should('contain.text', '5/10');
    cy.get('@unexpectedWrite.all').should('have.length', 0);
    assertNoUnexpectedWrites();
  });

  it('logged-in assignment submission waits for save and reward before completion', () => {
    let releaseSave!: () => void;
    let releaseClaim!: () => void;
    const saveReady = new Promise<void>((resolve) => { releaseSave = resolve; });
    const claimReady = new Promise<void>((resolve) => { releaseClaim = resolve; });
    const saveResultId = 'server-assignment-result';

    cy.intercept({ method: 'POST', pathname: '/api/results' }, (request) => {
      expect(request.body).to.deep.include({
        accessGrant: ACCESS_GRANT,
        assignmentId: ASSIGNMENT_ID,
        score: 0,
        correctCount: 0,
      });
      return saveReady.then(() => request.reply({
        statusCode: 200,
        body: authoritativeFormalResponse(saveResultId, ASSIGNMENT_ID),
      }));
    }).as('saveResult');
    cy.intercept({ method: 'POST', pathname: '/api/game-state/result-reward' }, (request) => {
      expect(request.body).to.deep.include({ username: USERNAME, resultId: saveResultId });
      return claimReady.then(() => request.reply({ statusCode: 200, body: rewardResponse }));
    }).as('claimReward');
    cy.intercept({ method: 'POST', pathname: '/api/game-loop/track-quiz' }, (request) => {
      expect(request.body).to.deep.equal({ resultId: saveResultId });
      request.reply({ statusCode: 200, body: trackActivityResponse });
    }).as('trackActivity');

    startLoggedInAssignmentQuiz();
    openSubmitConfirmation();
    confirmSubmit();
    cy.get('@saveResult.all').should('have.length', 1);
    cy.get('[role="dialog"][aria-modal="true"]').should('not.exist');
    cy.get('#result-summary-title').should('not.exist');
    cy.get('@unexpectedWrite.all').should('have.length', 0);

    cy.then(() => releaseSave());
    cy.get('@claimReward.all').should('have.length', 1);
    cy.get('[role="dialog"][aria-modal="true"]').should('not.exist');
    cy.get('#result-summary-title').should('not.exist');

    cy.then(() => releaseClaim());
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Đã cộng vào tài khoản của em.');
    cy.get('[role="dialog"][aria-modal="true"]').contains('button', 'Xem kết quả').click();
    cy.get('#result-summary-title').should('contain.text', '5/10');
    cy.wait('@trackActivity');
    assertNoUnexpectedWrites();
  });

  it('keeps the draft after a save failure and allows a later successful submission', () => {
    let saveCount = 0;
    cy.intercept({ method: 'POST', pathname: '/api/results' }, (request) => {
      saveCount += 1;
      if (saveCount === 1) {
        request.reply({ statusCode: 503, body: { status: 'error', message: 'temporary save failure' } });
        return;
      }
      request.reply({ statusCode: 200, body: authoritativeFormalResponse('server-retry-result') });
    }).as('saveResult');

    startGuestFormalQuiz();
    openSubmitConfirmation();
    confirmSubmit();
    cy.wait('@saveResult');
    cy.contains('Lỗi khi nộp bài!').filter(':visible').should('be.visible');
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem(`tohieuquiz_quiz_attempt_v1:${QUIZ_ID}`), 'draft after failed save')
        .not.to.equal(null);
    });
    cy.get('@unexpectedWrite.all').should('have.length', 0);

    openSubmitConfirmation();
    confirmSubmit();
    cy.get('@saveResult.all').should('have.length', 2);
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Kết quả đã được lưu');
    cy.get('[role="dialog"][aria-modal="true"]').contains('button', 'Xem kết quả').click();
    cy.get('#result-summary-title').should('contain.text', '5/10');
    assertNoUnexpectedWrites();
  });

  it('retries a null reward by saved result id without resaving, then supports keyboard result view at 320px', () => {
    let claimCount = 0;
    let releaseRetry!: () => void;
    const retryReady = new Promise<void>((resolve) => { releaseRetry = resolve; });
    const claimedIds: string[] = [];
    const quiz = makeFormalQuiz();

    cy.viewport(320, 740);
    stubStudentProfile();
    stubFormalStart(quiz);
    cy.intercept({ method: 'POST', pathname: '/api/results' }, (request) => (
      request.reply({ statusCode: 200, body: authoritativeFormalResponse('server-null-reward-result') })
    )).as('saveResult');
    cy.intercept({ method: 'POST', pathname: '/api/game-state/result-reward' }, (request) => {
      claimCount += 1;
      claimedIds.push(String(request.body.resultId));
      if (claimCount === 1) {
        // A 200 { status: 'error' } body is wrapped as a successful transport
        // response by gamificationService; use a real service failure so the
        // store catches it and returns the null-reward baseline.
        request.reply({ statusCode: 503, body: { status: 'error', message: 'reward unavailable' } });
        return;
      }
      return retryReady.then(() => request.reply({ statusCode: 200, body: rewardResponse }));
    }).as('claimReward');
    cy.intercept({ method: 'POST', pathname: '/api/game-loop/track-quiz' }, {
      statusCode: 200,
      body: trackActivityResponse,
    }).as('trackActivity');

    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz, true) });
    cy.wait('@studentProfile');
    cy.contains('button', 'Bắt đầu làm bài').click();
    cy.wait('@playQuestions');
    cy.get('#question-submission-q1').should('be.visible');
    openSubmitConfirmation();
    confirmSubmit();
    cy.wait('@saveResult');
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Phần thưởng chưa đồng bộ được.');
    cy.get('@saveResult.all').should('have.length', 1);

    cy.get('[role="dialog"][aria-modal="true"]').contains('button', 'Thử đồng bộ lại').click();
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Đang đồng bộ phần thưởng...');
    cy.get('@claimReward.all').should('have.length', 2);
    cy.get('@saveResult.all').should('have.length', 1);
    cy.then(() => releaseRetry());
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Đã cộng vào tài khoản của em.');
    cy.wrap(claimedIds).should('deep.equal', ['server-null-reward-result', 'server-null-reward-result']);

    cy.get('[role="dialog"][aria-modal="true"]').contains('button', 'Xem kết quả')
      .should('be.focused')
      .type('{enter}');
    cy.get('#result-summary-title').should('contain.text', '5/10');
    cy.get('@trackActivity.all').should('have.length', 1);
    assertNoHorizontalOverflow();
    assertNoUnexpectedWrites();
  });

  it('uses one submission guard when manual submit races the deadline timeout', () => {
    let releaseSave!: () => void;
    const saveReady = new Promise<void>((resolve) => { releaseSave = resolve; });
    const quiz = makeFormalQuiz({ timeLimit: 1 });
    cy.intercept({ method: 'POST', pathname: '/api/results' }, (request) => (
      saveReady.then(() => request.reply({ statusCode: 200, body: authoritativeFormalResponse('server-timeout-race-result') }))
    )).as('saveResult');

    stubFormalStart(quiz);
    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz) });
    cy.clock(new Date('2026-11-28T00:00:00.000Z').getTime());
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh hết giờ');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();
    cy.wait('@playQuestions');
    cy.get('#question-submission-q1').should('be.visible');

    cy.tick(59_000);
    openSubmitConfirmation();
    confirmSubmit();
    cy.get('@saveResult.all').should('have.length', 1);
    cy.tick(2_000);
    cy.get('@saveResult.all').should('have.length', 1);
    cy.get('[role="dialog"][aria-modal="true"]').should('not.exist');
    cy.then(() => releaseSave());
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Kết quả đã được lưu');
    assertNoUnexpectedWrites();
  });

  it('grades secure practice on the server and renders review without formal writes or answer leakage', () => {
    const validationDetails = [{
      questionId: 'practice-q1',
      isCorrect: true,
      type: 'MCQ',
      status: 'correct',
    }];
    const hiddenReviewValue = { kind: 'unsupported', lines: [{ value: 'Không hiển thị dữ liệu đáp án' }] };
    const practiceGrade = {
      status: 'success',
      practiceId: PRACTICE_ID,
      score: 10,
      correctCount: 1,
      questionCount: 1,
      totalQuestions: 1,
      voidedCount: 0,
      gradingVersion: 'practice-worker-v1',
      answers: {
        'practice-q1': { selectedAnswer: 'option-0', isCorrect: true, status: 'correct' },
      },
      validationDetails,
      reviewDetails: [{
        questionId: 'practice-q1',
        type: 'MCQ',
        status: 'correct',
        isCorrect: true,
        studentAnswer: hiddenReviewValue,
        correctAnswer: hiddenReviewValue,
        presentation: {
          schemaVersion: 1,
          source: 'submission',
          type: 'UNSUPPORTED',
          reason: 'insufficient-authoritative-data',
          items: [],
        },
      }],
    };

    cy.intercept({ method: 'POST', pathname: '/api/practice/grade' }, (request) => {
      expect(request.body).to.deep.include({
        sessionToken: PRACTICE_TOKEN,
        questionOrder: ['practice-q1'],
      });
      expect(request.body.answers).to.have.property('practice-q1');
      request.reply({ statusCode: 200, body: practiceGrade });
    }).as('gradePractice');

    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, securePracticeQuiz) });
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh luyện tập');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();
    cy.get('#question-practice-q1').should('be.visible');
    cy.get('#question-practice-q1 button').first().click();
    openSubmitConfirmation();
    confirmSubmit();
    cy.wait('@gradePractice');
    cy.get('[role="dialog"][aria-modal="true"]').should('contain.text', 'Bài luyện tập đã hoàn thành');
    cy.get('[role="dialog"][aria-modal="true"]').contains('button', 'Xem kết quả').click();
    cy.get('#result-summary-title').should('contain.text', '10/10');
    cy.contains('[role="tab"]', 'Xem lại bài').click();
    cy.get('[role="tabpanel"][aria-label="Xem lại bài"]').should('contain.text', 'Đúng');
    cy.get('body').should('not.contain.text', PRACTICE_TOKEN);
    cy.get('@unexpectedWrite.all').should('have.length', 0);
    assertNoUnexpectedWrites();
  });
});
