/// <reference types="cypress" />

const QUIZ_ID = 'quiz-student-avatar-fixture';
const QUESTION_ID = 'avatar-question';

const quiz = {
  id: QUIZ_ID,
  title: 'Bài kiểm thử avatar học sinh',
  classLevel: '4',
  category: 'kiem-thu',
  subject: 'toan',
  timeLimit: 60,
  duration: 60,
  requireCode: false,
  isPractice: false,
  questions: [
    {
      id: QUESTION_ID,
      quizId: QUIZ_ID,
      type: 'MCQ',
      question: 'Chọn đáp án đúng để giữ lại bản nháp khi tải lại trang.',
      options: ['Đáp án A', 'Đáp án B'],
      correctAnswer: 'A',
    },
  ],
};

const studentProfile = (avatar: string) => ({
  studentId: 'student-avatar-fixture',
  fullName: 'Nguyễn Minh Khang',
  username: 'student.avatar.fixture',
  classId: 'class-avatar-fixture',
  className: '4A1',
  avatar,
  coins: 0,
  pet: null,
  shopItems: [],
});

const installStudentQuizState = (win: Window) => {
  win.localStorage.clear();
  win.sessionStorage.clear();
  win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
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

const stubStudentQuizApis = (avatar: string) => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/system-settings*', {
    statusCode: 200,
    body: { status: 'success', data: { aiAssistantEnabled: false } },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 401,
    body: { status: 'error', message: 'Unauthorized' },
  });
  cy.intercept('GET', '**/api/student-profile', {
    statusCode: 200,
    body: { status: 'success', data: studentProfile(avatar) },
  }).as('studentProfile');
  cy.intercept('GET', '**/api/quizzes*', {
    statusCode: 200,
    body: [quiz],
  });
  cy.intercept('GET', '**/api/questions*', {
    statusCode: 200,
    body: quiz.questions,
  });
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth, 'document scrollWidth')
      .to.be.lte(document.documentElement.clientWidth + 1);
  });
};

const assertAvatar = (expectedPath: string) => {
  cy.get('img[alt="Ảnh đại diện của Nguyễn Minh Khang"]')
    .should('be.visible')
    .and(($image) => {
      const image = $image[0] as HTMLImageElement;
      expect(image.naturalWidth, 'avatar natural width').to.be.greaterThan(0);
      expect(new URL(image.currentSrc || image.src, window.location.origin).pathname)
        .to.equal(expectedPath);
    });
};

const startQuiz = () => {
  cy.wait('@studentProfile');
  cy.contains(quiz.title, { timeout: 15_000 }).should('be.visible');
  cy.contains('button', 'Bắt đầu làm bài', { timeout: 15_000 }).click();
  cy.get(`#question-${QUESTION_ID}`, { timeout: 15_000 }).should('be.visible');
};

describe('Student quiz avatar', () => {
  it('renders the selected avatar and restores it with the in-progress answer on desktop reload', () => {
    cy.viewport(1280, 720);
    stubStudentQuizApis('boy_02');

    cy.visit('/', { onBeforeLoad: installStudentQuizState });
    startQuiz();

    assertAvatar('/avatar2.webp');
    cy.get('[aria-label^="Thời gian còn lại"]')
      .should('be.visible')
      .and('contain.text', ':');
    cy.get(`#question-${QUESTION_ID} button[aria-pressed="false"]`).first().click();
    cy.get(`#question-${QUESTION_ID} button[aria-pressed="true"]`).should('exist');
    cy.screenshot('quiz-student-avatar-desktop');

    cy.reload();
    cy.wait('@studentProfile');
    assertAvatar('/avatar2.webp');
    cy.get('[aria-label^="Thời gian còn lại"]').should('be.visible');
    cy.get(`#question-${QUESTION_ID} button[aria-pressed="true"]`).should('exist');
    assertNoHorizontalOverflow();
  });

  it('uses the default avatar when the student profile has no avatar on a 375px viewport', () => {
    cy.viewport(375, 812);
    stubStudentQuizApis('');

    cy.visit('/', { onBeforeLoad: installStudentQuizState });
    startQuiz();

    assertAvatar('/avatar1.webp');
    cy.get('[aria-label^="Thời gian còn lại"]')
      .should('be.visible')
      .and('contain.text', ':');
    assertNoHorizontalOverflow();
    cy.screenshot('quiz-student-avatar-mobile-default');
  });
});
