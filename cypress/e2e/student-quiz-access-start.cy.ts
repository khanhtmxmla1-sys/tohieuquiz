/// <reference types="cypress" />

const QUIZ_ID = 'student-access-start-fixture';
const ASSIGNMENT_ID = 'assignment-access-start-fixture';
const STUDENT_ID = 'student-access-start-fixture';
const ACCESS_GRANT = 'grant-access-start-fixture';
const QUESTION_ID = 'scoped-question-1';

const catalogQuestion = {
  id: 'catalog-question-only',
  quizId: QUIZ_ID,
  type: 'MCQ',
  question: 'Câu hỏi chỉ xuất hiện sau khi được cấp quyền.',
  options: ['Đáp án A', 'Đáp án B'],
  correctAnswer: 'A',
};

const learnerQuestion = {
  id: QUESTION_ID,
  quizId: QUIZ_ID,
  type: 'MCQ',
  question: catalogQuestion.question,
  options: catalogQuestion.options,
};

const assignment = {
  id: ASSIGNMENT_ID,
  quizId: QUIZ_ID,
  classId: 'class-access-start-fixture',
  deadline: '2099-01-01T00:00:00.000Z',
  maxAttempts: 2,
  attemptCount: 0,
  status: 'OPEN',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const studentProfile = {
  studentId: STUDENT_ID,
  fullName: 'Học sinh truy cập',
  username: 'student.access.start.fixture',
  classId: assignment.classId,
  className: '4A1',
  avatar: 'default',
  coins: 0,
  pet: null,
  shopItems: [],
};

const makeQuiz = (withAssignment = false) => ({
  id: QUIZ_ID,
  title: 'Bài kiểm thử mã truy cập và bắt đầu',
  classLevel: '4',
  category: 'kiem-thu',
  timeLimit: 10,
  duration: 10,
  requireCode: true,
  isPractice: false,
  questions: [catalogQuestion],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...(withAssignment ? { _assignmentData: assignment } : {}),
});

const installQuizState = (win: Window, quiz: ReturnType<typeof makeQuiz>, restoreStudent = false) => {
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

const stubCommonApis = () => {
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

const blockUnexpectedPosts = () => {
  // This guard is registered before the allow-listed routes. Cypress resolves
  // non-middleware intercepts in reverse order, so the explicit fixtures below
  // handle their requests while every other write fails locally.
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    cy.intercept({ method, pathname: '/api/**' }, (request) => {
      request.reply({
        statusCode: 500,
        body: { status: 'error', message: `Unexpected write in access/start smoke: ${request.url}` },
      });
    }).as('unexpectedWrite');
  }
};

const stubScopedQuestions = () => {
  cy.intercept('POST', `**/api/quizzes/${QUIZ_ID}/play-questions`, {
    statusCode: 200,
    body: {
      quizId: QUIZ_ID,
      revision: 1,
      questions: [learnerQuestion],
    },
  }).as('playQuestions');
};

const assertNoUnexpectedWrites = () => {
  cy.get('@unexpectedWrite.all').then((interceptions) => {
    if (interceptions.length > 0) {
      throw new Error(`unexpected writes: ${interceptions.map((item) => item.request.url).join(', ')}`);
    }
  });
};

describe('student quiz access and start', () => {
  beforeEach(() => {
    blockUnexpectedPosts();
    stubCommonApis();
  });

  it('normalizes a rejected code, retries with Enter, and starts a guest quiz after scoped loading', () => {
    const quiz = makeQuiz();
    let verifyCount = 0;
    cy.intercept('POST', `**/api/quizzes/access-verification/${QUIZ_ID}`, (request) => {
      verifyCount += 1;
      if (verifyCount === 1) {
        request.reply({ statusCode: 400, body: { status: 'error', message: 'Invalid access code' } });
      } else {
        request.reply({
          statusCode: 200,
          body: { valid: true, accessGrant: ACCESS_GRANT, expiresAt: '2099-01-01T00:10:00.000Z', revision: 1 },
        });
      }
    }).as('verifyCode');
    stubScopedQuestions();

    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz) });
    cy.get('input[placeholder="ABC123"]').type('bad{enter}');
    cy.wait('@verifyCode').its('request.body').should('deep.include', { accessCode: 'BAD' });
    cy.get('[class*="text-red-500"]').should('contain.text', 'Mã không đúng');

    cy.get('input[placeholder="ABC123"]').clear().type('good{enter}');
    cy.wait('@verifyCode');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').should('be.visible');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh khách');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();
    cy.wait('@playQuestions').its('request.body').should((body) => {
      expect(body).to.deep.include({ accessGrant: ACCESS_GRANT });
      expect(body).not.to.have.property('assignmentId');
    });
    cy.get(`#question-${QUESTION_ID}`).should('be.visible');
    cy.window().then((win) => {
      const storage = `${win.localStorage.getItem('tohieuquiz-store') || ''}${win.sessionStorage.getItem('tohieuquiz_quiz_attempt_v1:' + QUIZ_ID) || ''}`;
      expect(storage).not.to.include(ACCESS_GRANT);
      expect(storage).not.to.include('GOOD');
    });
    assertNoUnexpectedWrites();
  });

  it('does not verify again from the busy code form', () => {
    const quiz = makeQuiz();
    let releaseVerification!: () => void;
    let verificationCount = 0;
    const verificationReady = new Promise<void>((resolve) => { releaseVerification = resolve; });
    cy.intercept('POST', `**/api/quizzes/access-verification/${QUIZ_ID}`, (request) => {
      verificationCount += 1;
      return verificationReady.then(() => request.reply({
        statusCode: 200,
        body: { valid: true, accessGrant: ACCESS_GRANT },
      }));
    }).as('pendingVerification');

    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz) });
    cy.get('input[placeholder="ABC123"]').type('good{enter}');
    cy.contains('button', 'Đang kiểm tra...').should('be.disabled');
    cy.get('input[placeholder="ABC123"]').type('{enter}');
    cy.then(() => {
      expect(verificationCount).to.equal(1);
      releaseVerification();
    });
    cy.wait('@pendingVerification');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').should('be.visible');
    assertNoUnexpectedWrites();
  });

  it('keeps a pending guest start before questions arrive and remains usable at 320px', () => {
    const quiz = makeQuiz();
    let releaseQuestions: (() => void) | undefined;
    const questionsReady = new Promise<void>((resolve) => { releaseQuestions = resolve; });

    cy.intercept('POST', `**/api/quizzes/access-verification/${QUIZ_ID}`, {
      statusCode: 200,
      body: { valid: true, accessGrant: ACCESS_GRANT },
    }).as('validCode');
    cy.intercept('POST', `**/api/quizzes/${QUIZ_ID}/play-questions`, (request) => (
      questionsReady.then(() => request.reply({
        statusCode: 200,
        body: { quizId: QUIZ_ID, revision: 1, questions: [learnerQuestion] },
      }))
    )).as('playQuestions');

    cy.viewport(320, 740);
    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz) });
    cy.get('input[placeholder="ABC123"]').type('good{enter}');
    cy.wait('@validCode');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh mobile');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();
    cy.get(`#question-${QUESTION_ID}`).should('not.exist');
    cy.contains('button', 'Bắt đầu làm bài!').should('be.visible');
    cy.then(() => releaseQuestions?.());
    cy.wait('@playQuestions');
    cy.get(`#question-${QUESTION_ID}`).should('be.visible');
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.at.most(document.documentElement.clientWidth + 1);
    });
    assertNoUnexpectedWrites();
  });

  it('passes grant, assignment and student identity through the logged-in start pipeline', () => {
    const quiz = makeQuiz(true);
    cy.intercept('GET', '**/api/student-profile', {
      statusCode: 200,
      body: { status: 'success', data: studentProfile },
    }).as('studentProfile');
    cy.intercept('POST', `**/api/quizzes/access-verification/${QUIZ_ID}`, {
      statusCode: 200,
      body: { valid: true, accessGrant: ACCESS_GRANT },
    }).as('validCode');
    stubScopedQuestions();
    cy.intercept('POST', `**/api/assignments/${ASSIGNMENT_ID}/start`, {
      statusCode: 200,
      body: { status: 'success', data: { ...assignment, attemptCount: 1, remainingAttempts: 1 } },
    }).as('startAssignment');

    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz, true) });
    cy.wait('@studentProfile');
    cy.get('input[placeholder="ABC123"]').type('good{enter}');
    cy.wait('@validCode').its('request.body').should('deep.include', {
      accessCode: 'GOOD',
      assignmentId: ASSIGNMENT_ID,
    });
    cy.contains('Lưu ý trước khi làm bài').should('be.visible');
    cy.contains('button', 'Bắt đầu làm bài').click();
    cy.wait('@playQuestions').its('request.body').should('deep.include', {
      assignmentId: ASSIGNMENT_ID,
      accessGrant: ACCESS_GRANT,
    });
    cy.wait('@startAssignment').its('request.body').should('deep.include', {
      assignmentId: ASSIGNMENT_ID,
      studentId: STUDENT_ID,
    });
    cy.get(`#question-${QUESTION_ID}`).should('be.visible');
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem(`tohieuquiz_quiz_attempt_v1:${QUIZ_ID}`) || '').not.to.include(ACCESS_GRANT);
    });
    assertNoUnexpectedWrites();
  });

  it('retries a failed scoped load before calling assignment preflight', () => {
    const quiz = makeQuiz(true);
    let loadCount = 0;
    cy.intercept('GET', '**/api/student-profile', {
      statusCode: 200,
      body: { status: 'success', data: studentProfile },
    }).as('studentProfile');
    cy.intercept('POST', `**/api/quizzes/access-verification/${QUIZ_ID}`, {
      statusCode: 200,
      body: { valid: true, accessGrant: ACCESS_GRANT },
    }).as('validCode');
    cy.intercept('POST', `**/api/quizzes/${QUIZ_ID}/play-questions`, (request) => {
      loadCount += 1;
      expect(request.body).to.deep.equal({ assignmentId: ASSIGNMENT_ID, accessGrant: ACCESS_GRANT });
      request.reply(loadCount === 1
        ? { statusCode: 503, body: { status: 'error', message: 'Tạm thời chưa tải được câu hỏi.' } }
        : { statusCode: 200, body: { quizId: QUIZ_ID, revision: 1, questions: [learnerQuestion] } });
    }).as('scopedLoad');
    cy.intercept('POST', `**/api/assignments/${ASSIGNMENT_ID}/start`, {
      statusCode: 200,
      body: { status: 'success', data: { ...assignment, remainingAttempts: 2 } },
    }).as('startAssignment');

    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz, true) });
    cy.wait('@studentProfile');
    cy.get('input[placeholder="ABC123"]').type('good{enter}');
    cy.wait('@validCode');
    cy.contains('button', 'Bắt đầu làm bài').click();
    cy.wait('@scopedLoad');
    cy.get('[role="alert"]').should('be.visible');
    cy.get('@startAssignment.all').should('have.length', 0);
    cy.get(`#question-${QUESTION_ID}, #question-${catalogQuestion.id}`).should('not.exist');
    cy.window().then((win) => {
      expect(win.sessionStorage.getItem(`tohieuquiz_quiz_attempt_v1:${QUIZ_ID}`)).to.equal(null);
    });

    cy.contains('button', 'Bắt đầu làm bài').click();
    cy.wait('@scopedLoad');
    cy.wait('@startAssignment');
    cy.get('@startAssignment.all').should('have.length', 1);
    cy.get(`#question-${QUESTION_ID}`).should('be.visible');
    cy.get(`#question-${catalogQuestion.id}`).should('not.exist');
    cy.then(() => expect(loadCount).to.equal(2));
    assertNoUnexpectedWrites();
  });

  it('shows a preflight denial and retries the same start without rendering catalog questions', () => {
    const quiz = makeQuiz(true);
    cy.intercept('GET', '**/api/student-profile', {
      statusCode: 200,
      body: { status: 'success', data: studentProfile },
    }).as('studentProfile');
    cy.intercept('POST', `**/api/quizzes/access-verification/${QUIZ_ID}`, {
      statusCode: 200,
      body: { valid: true, accessGrant: ACCESS_GRANT },
    }).as('validCode');
    stubScopedQuestions();
    let preflightCount = 0;
    cy.intercept('POST', `**/api/assignments/${ASSIGNMENT_ID}/start`, (request) => {
      preflightCount += 1;
      if (preflightCount === 1) {
        request.reply({
          statusCode: 409,
          body: {
            status: 'error',
            code: 'ASSIGNMENT_ATTEMPTS_EXHAUSTED',
            message: 'Em đã hết lượt làm bài này (2/2).',
            attemptCount: 2,
            maxAttempts: 2,
          },
        });
      } else {
        request.reply({
          statusCode: 200,
          body: { status: 'success', data: { ...assignment, attemptCount: 1, remainingAttempts: 1 } },
        });
      }
    }).as('assignmentPreflight');

    cy.visit('/', { onBeforeLoad: (win) => installQuizState(win, quiz, true) });
    cy.wait('@studentProfile');
    cy.get('input[placeholder="ABC123"]').type('good{enter}');
    cy.wait('@validCode');
    cy.contains('button', 'Bắt đầu làm bài').click();
    cy.wait('@playQuestions');
    cy.wait('@assignmentPreflight');
    cy.get('[role="alert"]').should('contain.text', 'Em đã hết lượt làm bài này');
    cy.get(`#question-${QUESTION_ID}`).should('not.exist');

    cy.contains('button', 'Bắt đầu làm bài').click();
    cy.wait('@playQuestions');
    cy.wait('@assignmentPreflight');
    cy.get(`#question-${QUESTION_ID}`).should('be.visible');
    assertNoUnexpectedWrites();
  });
});
