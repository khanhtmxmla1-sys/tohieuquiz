/// <reference types="cypress" />

const dollar = String.fromCharCode(36);
const slash = String.fromCharCode(92);
const richMathText = `Rich ${dollar}24 ${slash}div 6${dollar}`;

const richPrompt = (text: string) => ({
  schemaVersion: 1,
  doc: {
    type: 'doc',
    content: [{
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', text, marks: [{ type: 'bold' }] }],
    }],
  },
});

const teacherAuthStorageValue = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'teacher.rich',
    teacherName: 'Giáo viên Rich',
    isAdmin: false,
    teacherClass: '4A',
  },
  version: 0,
});

const stubTeacherSession = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      data: {
        username: 'teacher.rich',
        fullName: 'Giáo viên Rich',
        role: 'teacher',
        classes: [{ id: 'class-4a', name: '4A' }],
        mustChangePassword: false,
      },
    },
  }).as('teacherSession');
};

const installTeacherHistoricalResult = (win: Window) => {
  const currentQuestion = {
    id: 'q-history-rich',
    type: 'MCQ',
    question: 'Current plain prompt',
    questionRichText: richPrompt('Current rich prompt'),
    options: ['A', 'B'],
    correctAnswer: 'A',
  };
  const historicalQuestion = {
    ...currentQuestion,
    question: 'Historical plain prompt',
    questionRichText: richPrompt(richMathText),
  };
  const quiz = {
    id: 'quiz-history-rich',
    title: 'Đề lịch sử Rich',
    classLevel: '4',
    category: 'toan',
    timeLimit: 15,
    createdAt: '2026-08-08T08:00:00.000Z',
    questions: [currentQuestion],
  };
  const result = {
    id: 'result-history-rich',
    studentName: 'Lan',
    studentClass: '4A',
    quizId: quiz.id,
    quizTitle: quiz.title,
    score: 0,
    correctCount: 0,
    totalQuestions: 1,
    timeTaken: 120,
    submittedAt: '2026-08-08T09:00:00.000Z',
    answers: {
      'q-history-rich': {
        selectedAnswer: 'B',
        isCorrect: false,
        questionSnapshot: historicalQuestion,
      },
    },
  };

  win.localStorage.setItem('auth-storage', teacherAuthStorageValue);
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'teacher',
      quizzes: [quiz],
      results: [result],
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};

const assertNoDocumentOverflow = () => {
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth + 1);
  });
};

describe('Rich historical result presentation', () => {
  it('renders the teacher historical rich snapshot and remains responsive', () => {
    stubTeacherSession();
    cy.visit('/teacher/results/result-history-rich', { onBeforeLoad: installTeacherHistoricalResult });
    cy.wait('@teacherSession');

    cy.get('[data-testid="question-rich-text-renderer"]', { timeout: 20_000 }).should('be.visible');
    cy.get('[data-testid="question-rich-text-renderer"] strong').should('contain.text', 'Rich');
    cy.contains('Current rich prompt').should('not.exist');
    cy.contains('<strong>').should('not.exist');

    [320, 768, 1024, 1440].forEach((width) => {
      cy.viewport(width, 900);
      assertNoDocumentOverflow();
    });
  });
});

const immediateQuestion = {
  id: 'rich-immediate',
  quizId: 'quiz-rich-immediate',
  type: 'MCQ',
  question: 'Immediate plain fallback',
  questionRichText: richPrompt(richMathText),
  options: ['4', '5'],
  correctAnswer: 'A',
};

const immediateQuiz = {
  id: 'quiz-rich-immediate',
  title: 'Kiểm tra Rich tức thời',
  classLevel: '4',
  category: 'toan',
  timeLimit: 15,
  requireCode: false,
  isPractice: true,
  questions: [immediateQuestion],
};

const installImmediateQuiz = (win: Window) => {
  Object.defineProperty(win.Math, 'random', {
    configurable: true,
    value: () => 0.999999,
  });
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'student',
      quizzes: [immediateQuiz],
      selectedQuiz: immediateQuiz,
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};

describe('Student immediate rich result review', () => {
  it('keeps rich prompt presentation after submission', () => {
    cy.intercept('GET', '**/api/system-settings*', {
      statusCode: 200,
      body: { status: 'success', data: { aiAssistantEnabled: false } },
    });
    cy.intercept('POST', '**/api/validate', {
      statusCode: 200,
      body: {
        status: 'success',
        score: 10,
        correctCount: 1,
        total: 1,
        gradingVersion: '2.0.0',
        details: [{ questionId: 'rich-immediate', isCorrect: true, status: 'correct' }],
      },
    }).as('validateRich');

    cy.visit('/', { onBeforeLoad: installImmediateQuiz });
    cy.contains('Kiểm tra Rich tức thời', { timeout: 15_000 }).should('be.visible');
    cy.get('input[placeholder="Ví dụ: Lò Văn A"]').type('Học sinh Rich');
    cy.get('select').select('4A1');
    cy.contains('button', 'Bắt đầu làm bài!').click();
    cy.get('#question-rich-immediate').within(() => cy.get('button').eq(0).click());
    cy.contains('button', 'Nộp bài').click();
    cy.contains('button', 'Đồng ý nộp').click();
    cy.wait('@validateRich');
    cy.get('[role="dialog"]').within(() => cy.contains('button', 'Xem kết quả').click());
    cy.get('[role="tab"]').contains('Xem lại bài').click();

    cy.get('[role="tabpanel"]').within(() => {
      cy.get('[data-testid="question-rich-text-renderer"]').should('be.visible');
      cy.get('[data-testid="question-rich-text-renderer"] strong').should('contain.text', 'Rich');
      cy.contains('Immediate plain fallback').should('not.exist');
      cy.contains('<strong>').should('not.exist');
    });
    assertNoDocumentOverflow();
  });
});

const studentSession = {
  studentId: 'student-rich',
  fullName: 'Học sinh Lịch sử',
  username: 'student.rich',
  classId: 'class-4a',
  className: '4A',
  coins: 0,
  shopItems: [],
};

const currentAssignmentQuiz = {
  id: 'quiz-assignment-rich',
  title: 'Bài giao Rich lịch sử',
  classLevel: '4',
  category: 'toan',
  timeLimit: 15,
  createdAt: '2026-08-08T08:00:00.000Z',
  questions: [
    {
      id: 'snapshot-rich', type: 'MCQ', question: 'Current rich plain',
      questionRichText: richPrompt('Current rich must not appear'), options: ['A', 'B'], correctAnswer: 'A',
    },
    {
      id: 'snapshot-legacy', type: 'MCQ', question: 'Current legacy plain',
      questionRichText: richPrompt('Current legacy rich must not appear'), options: ['A', 'B'], correctAnswer: 'A',
    },
  ],
};

const storedAssignmentAnswers = {
  _questionOrder: ['snapshot-rich', 'snapshot-legacy'],
  'snapshot-rich': {
    selectedAnswer: 'B',
    isCorrect: false,
    questionSnapshot: {
      id: 'snapshot-rich', type: 'MCQ', question: 'Historical rich plain',
      questionRichText: richPrompt('Historical rich snapshot'), options: ['A', 'B'],
    },
  },
  'snapshot-legacy': {
    selectedAnswer: 'A',
    isCorrect: true,
    questionSnapshot: {
      id: 'snapshot-legacy', type: 'MCQ', question: 'Historical legacy plain', options: ['A', 'B'],
    },
  },
};

const installStudentAssignmentState = (win: Window) => {
  win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
  win.localStorage.setItem('tohieuquiz-store', JSON.stringify({
    state: {
      view: 'studentDashboard',
      quizzes: [currentAssignmentQuiz],
      results: [],
      quizzesLoadedAt: Date.now(),
    },
    version: 0,
  }));
};

const stubStudentAssignmentApis = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/student-profile', {
    statusCode: 200,
    body: { status: 'success', data: studentSession },
  }).as('studentProfile');
  cy.intercept({ method: 'GET', pathname: '/api/assignments' }, {
    statusCode: 200,
    body: {
      status: 'success',
      data: [{
        id: 'assignment-rich',
        quizId: currentAssignmentQuiz.id,
        classId: 'class-4a',
        quizTitle: currentAssignmentQuiz.title,
        className: '4A',
        deadline: '2030-08-08T08:00:00.000Z',
        maxAttempts: 1,
        attemptCount: 1,
        status: 'OPEN',
        createdAt: '2026-08-08T08:00:00.000Z',
      }],
    },
  }).as('studentAssignments');
  cy.intercept('GET', '**/api/results*', {
    statusCode: 200,
    body: {
      data: [{
        id: 'result-assignment-rich',
        studentName: studentSession.fullName,
        studentClass: '4A',
        quizId: currentAssignmentQuiz.id,
        quizTitle: currentAssignmentQuiz.title,
        score: 5,
        correctCount: 1,
        totalQuestions: 2,
        timeTaken: 90,
        submittedAt: '2026-08-08T10:00:00.000Z',
        answers: '{}',
      }],
    },
  }).as('studentResults');
  cy.intercept('GET', '**/api/results/result-assignment-rich/answers', {
    statusCode: 200,
    body: {
      answers: storedAssignmentAnswers,
      reviewDetails: [
        {
          questionId: 'snapshot-rich', type: 'MCQ', status: 'wrong', isCorrect: false,
          studentAnswer: { kind: 'text', lines: [{ value: 'B' }] },
          correctAnswer: { kind: 'text', lines: [{ value: 'A' }] },
        },
        {
          questionId: 'snapshot-legacy', type: 'MCQ', status: 'correct', isCorrect: true,
          studentAnswer: { kind: 'text', lines: [{ value: 'A' }] },
          correctAnswer: { kind: 'text', lines: [{ value: 'A' }] },
        },
      ],
    },
  }).as('assignmentAnswers');
};

describe('Student historical assignment review', () => {
  it('uses stored rich snapshot and keeps legacy snapshot plain', () => {
    stubStudentAssignmentApis();
    cy.visit('/student/assignments', { onBeforeLoad: installStudentAssignmentState });
    cy.wait('@studentProfile');
    cy.wait('@studentAssignments');
    cy.contains(currentAssignmentQuiz.title, { timeout: 20_000 }).should('be.visible');
    cy.contains('button', 'Xem kết quả').click();
    cy.wait('@studentResults');
    cy.wait('@assignmentAnswers');

    cy.get('[role="tabpanel"]', { timeout: 20_000 }).within(() => {
      cy.contains('Historical rich snapshot').should('be.visible');
      cy.contains('Historical legacy plain').should('be.visible');
      cy.contains('Current rich must not appear').should('not.exist');
      cy.contains('Current legacy rich must not appear').should('not.exist');
      cy.get('[data-testid="question-rich-text-renderer"]').should('have.length', 1);
    });
    assertNoDocumentOverflow();
  });
});
