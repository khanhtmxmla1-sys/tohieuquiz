/// <reference types="cypress" />

const student = {
  studentId: 'student-1',
  fullName: 'Nguyễn Văn An',
  username: 'hs.an',
  classId: 'class-4a',
  className: '4A',
  avatar: '',
  coins: 100,
  pet: null,
  shopItems: [],
};

const campaign = { id: 'campaign-1', title: 'Hội thi Toán 2026', status: 'ACTIVE' };
const rounds = Array.from({ length: 6 }, (_, index) => ({
  id: `round-${index + 1}`,
  roundNumber: index + 1,
  status: index === 0 ? 'OPEN' : 'UPCOMING',
  maxAttempts: 2,
  attemptsUsed: 0,
  passingScore: 7,
  bestScore: null,
}));

describe('Competition V1 student release journey', () => {
  it('loads six rounds, starts a snapshot attempt and submits it', () => {
    let submitted = false;
    cy.intercept('GET', '**/api/system-settings*', { status: 'success', data: { aiAssistantEnabled: false } });
    cy.intercept('GET', '**/api/account/me', { statusCode: 401, body: { status: 'error' } });
    cy.intercept('GET', '**/api/student-profile', { status: 'success', data: student }).as('studentProfile');
    cy.intercept('GET', '**/api/student/competitions', { items: [campaign] }).as('competitionList');
    cy.intercept('GET', '**/api/student/competitions/campaign-1', (request) => request.reply({
      competition: {
        ...campaign,
        eligibility: null,
        rounds: rounds.map((round) => round.id === 'round-1' && submitted
          ? { ...round, attemptsUsed: 1, bestScore: 10 }
          : round),
      },
    })).as('competitionDetail');
    cy.intercept('GET', '**/api/student/competitions/campaign-1/official-result', {
      statusCode: 404,
      body: { error: 'SCHOOL_EXAM_PUBLICATION_NOT_FOUND' },
    }).as('officialResult');
    cy.intercept('POST', '**/api/student/competitions/campaign-1/rounds/round-1/attempts', (request) => {
      expect(request.body.requestId).to.match(/^competition-start-/);
      request.reply({
        attempt: {
          id: 'attempt-1',
          campaignId: 'campaign-1',
          roundId: 'round-1',
          startedAt: '2026-08-22T01:00:00.000Z',
        },
        quiz: {
          id: 'quiz-snapshot-1',
          title: 'Đề vòng 1',
          timeLimit: 30,
          questions: [{ id: 'q-1', type: 'MCQ', question: '1 + 1 = ?', options: ['1', '2'] }],
        },
      });
    }).as('startAttempt');
    cy.intercept('POST', '**/api/student/competitions/campaign-1/rounds/round-1/attempts/attempt-1/submit', (request) => {
      expect(request.body).to.include({ campaignId: 'campaign-1', roundId: 'round-1', attemptId: 'attempt-1' });
      expect(request.body.idempotencyKey).to.match(/^competition-submit-/);
      expect(request.body.answers).to.deep.equal({});
      submitted = true;
      request.reply({
        result: {
          score: 10,
          correctCount: 1,
          totalQuestions: 1,
          progress: { attemptsUsed: 1, bestScore: 10, isPassed: true },
        },
      });
    }).as('submitAttempt');

    cy.viewport(1440, 900);
    cy.visit('/student/competition', {
      onBeforeLoad(win) {
        win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
      },
    });
    cy.wait('@studentProfile');
    // The first cold Vite transform can delay the lazy Competition route on Windows.
    cy.wait('@competitionList', { timeout: 15_000 });
    cy.contains('h1', 'Cuộc thi của em').should('be.visible');
    cy.get('article').filter(':contains("Vòng ")').should('have.length', 6);
    cy.contains('Kết quả chính thức chưa được công bố.').should('be.visible');

    cy.contains('button', 'Bắt đầu vòng 1').click();
    cy.wait('@startAttempt');
    cy.contains('h1', 'Đề vòng 1').should('be.visible');
    cy.contains('button', 'Nộp bài').click();
    cy.wait('@submitAttempt');
    cy.contains('Điểm vòng: 10').should('be.visible');
    cy.contains('Điểm tốt nhất 10').should('be.visible');
  });
});
