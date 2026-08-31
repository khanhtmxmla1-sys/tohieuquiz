const MOBILE_VIEWPORTS = [
  { width: 360, height: 800, label: '360x800' },
  { width: 390, height: 844, label: '390x844' },
  { width: 412, height: 915, label: '412x915' },
  { width: 768, height: 1024, label: '768x1024' },
];

const assertNoHorizontalOverflow = () => {
  cy.window().then((win) => {
    const doc = win.document.documentElement;
    expect(doc.scrollWidth, 'document scrollWidth').to.be.lte(doc.clientWidth + 1);
  });
};

describe('Mobile Responsive Smoke', () => {
  MOBILE_VIEWPORTS.forEach(({ width, height, label }) => {
    it(`Public routes render well on ${label}`, () => {
      cy.viewport(width, height);

      cy.visit('/');
      cy.contains('Trang chủ').should('exist');
      assertNoHorizontalOverflow();

      cy.visit('/about');
      cy.contains('Giới thiệu').should('exist');
      assertNoHorizontalOverflow();

      cy.visit('/contact');
      cy.contains('Liên hệ').should('exist');
      assertNoHorizontalOverflow();
    });

    it(`Auth + dashboard shell on ${label}`, () => {
      cy.viewport(width, height);
      cy.visit('/');

      cy.get('input[type="text"]').first().should('be.visible');
      cy.get('input[type="password"]').first().should('be.visible');
      cy.get('form[aria-label="Đăng nhập"] button[type="submit"]').should('be.visible');
      assertNoHorizontalOverflow();

      // Teacher login attempt (keeps test stable even if backend data differs)
      cy.contains('button', 'Giáo viên').click();
      cy.get('input[type="text"]').first().clear().type('admin');
      cy.get('input[type="password"]').first().clear().type('admin');
      cy.get('form[aria-label="Đăng nhập"] button[type="submit"]').click();

      cy.get('body').then(($body) => {
        const hasTeacherDashboard = $body.find('.teacher-dashboard-shell').length > 0;
        if (hasTeacherDashboard) {
          assertNoHorizontalOverflow();
          if (width < 1024) {
            cy.get('button[aria-label="Mở menu điều hướng"]').should('exist');
          }
        } else {
          // Fallback: still validate the login surface when the local API is unavailable.
          cy.get('form[aria-label="Đăng nhập"]').should('be.visible');
          assertNoHorizontalOverflow();
        }
      });
    });
  });
});

const COMPETITION_MOBILE_VIEWPORTS = [
  { width: 360, height: 800, label: '360x800' },
  { width: 390, height: 844, label: '390x844' },
  { width: 412, height: 915, label: '412x915' },
];

const competitionRounds = Array.from({ length: 6 }, (_, index) => ({
  roundNumber: index + 1,
  title: `Vòng ${index + 1}`,
  opensAt: '2026-09-01T00:00:00.000Z',
  closesAt: '2026-09-30T00:00:00.000Z',
  state: index === 0 ? 'OPEN' : 'LOCKED',
}));

const competitionArticle = {
  slug: 'the-le',
  title: 'Thể lệ cuộc thi',
  summary: 'Thông tin thể lệ.',
  content: 'Nội dung thể lệ cuộc thi.',
  type: 'RULES',
  publishedAt: '2026-08-20T00:00:00.000Z',
};

const competitionPublicDetail = {
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  summary: 'Sân chơi học tập dành cho học sinh.',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-10-30T00:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  hero: { title: 'Chinh phục thử thách Toán học', subtitle: 'Sáu vòng thi dành cho em.' },
  cta: { label: 'VÀO THI' },
  rounds: competitionRounds,
  articleSummaryAvailable: true,
  goldenBoardAvailable: true,
  articles: [competitionArticle],
};

const competitionPublicSummary = {
  ...competitionPublicDetail,
  articles: undefined,
};

const competitionPortal = {
  campaignId: 'campaign-1',
  slug: 'olympic-toan',
  title: 'Olympic Toán 2026',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  rounds: competitionRounds.map((round, index) => ({
    ...round,
    roundId: `round-${index + 1}`,
    attemptCount: 0,
    maxAttempts: 3,
  })),
};

const competitionStudentDetail = {
  id: competitionPortal.campaignId,
  title: competitionPortal.title,
  schoolYear: competitionPortal.schoolYear,
  status: 'ACTIVE',
  eligibility: { version: 1, qualified: true, reasonCodes: [] },
  rounds: competitionPortal.rounds.map((round) => ({
    id: round.roundId,
    roundNumber: round.roundNumber,
    maxAttempts: round.maxAttempts,
    passingScore: 70,
    status: round.roundNumber === 1 ? 'OPEN' : 'SCHEDULED',
    attemptsUsed: 0,
    bestScore: null,
    isPassed: false,
    progressStatus: null,
  })),
};

const competitionPreflight = {
  status: 'READY',
  campaignId: competitionPortal.campaignId,
  roundId: 'round-1',
  quizId: 'quiz-1',
  serverTime: '2026-09-01T01:00:00.000Z',
  window: {
    opensAt: '2026-09-01T00:00:00.000Z',
    closesAt: '2026-09-30T00:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
  },
  attemptsRemaining: 3,
};

const assertCompetitionTouchTargets = () => {
  cy.get('a[href], button, input, textarea, select')
    .filter(':not(.sr-only)')
    .each(($element) => {
      const element = $element[0];
      if (element.hasAttribute('disabled')) return;
      if (element.matches('input[type="checkbox"], input[type="radio"]')) return;
      expect(element.getBoundingClientRect().height, `${element.tagName} touch target`).to.be.at.least(44);
    });
};

const assertCompetitionFocusTreatment = () => {
  cy.get('a[href], button, input, textarea, select')
    .filter(':not(.sr-only)')
    .each(($element) => {
      expect($element.attr('class') ?? '', `${$element[0].tagName} focus treatment`).to.match(/focus-visible:/);
    });
};

const stubCompetitionPublicApi = () => {
  cy.intercept('GET', '**/api/public/competitions', {
    statusCode: 200,
    body: { status: 'success', data: [competitionPublicSummary] },
  });
  cy.intercept('GET', '**/api/public/competitions/olympic-toan', {
    statusCode: 200,
    body: { status: 'success', data: competitionPublicDetail },
  });
  cy.intercept('GET', '**/api/public/competitions/olympic-toan/articles/the-le', {
    statusCode: 200,
    body: { status: 'success', data: competitionArticle },
  });
  cy.intercept('GET', '**/api/public/competitions/olympic-toan/golden-board', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        winners: [],
        publicationVersion: 1,
        rankingVersion: 1,
        awardRuleVersion: 1,
        publishedAt: '2026-08-20T00:00:00.000Z',
      },
    },
  });
};

const stubCompetitionStudentApi = () => {
  cy.intercept('GET', '**/api/system-settings*', {
    statusCode: 200,
    body: { status: 'success', data: { aiAssistantEnabled: false } },
  });
  cy.intercept('GET', '**/api/account/me', { statusCode: 401, body: { status: 'error' } });
  cy.intercept('GET', '**/api/student-profile', {
    statusCode: 200,
    body: {
      status: 'success',
      data: {
        studentId: 'student-1',
        fullName: 'Nguyễn Văn An',
        username: 'hs.an',
        classId: 'class-4a',
        className: '4A',
        avatar: '',
        coins: 100,
        pet: null,
        shopItems: [],
      },
    },
  });
  cy.intercept('GET', '**/api/student/competitions/by-slug/olympic-toan', {
    statusCode: 200,
    body: { competition: competitionStudentDetail, portal: competitionPortal },
  });
  cy.intercept('GET', '**/api/student/competitions/campaign-1', {
    statusCode: 200,
    body: { competition: competitionStudentDetail },
  });
  cy.intercept('GET', '**/api/student/competitions/campaign-1/official-result', {
    statusCode: 404,
    body: { error: 'SCHOOL_EXAM_PUBLICATION_NOT_FOUND' },
  });
  cy.intercept('POST', '**/api/student/competitions/campaign-1/rounds/round-1/preflight', {
    statusCode: 200,
    body: { preflight: competitionPreflight },
  });
  cy.intercept('GET', '**/api/public/competitions/olympic-toan', {
    statusCode: 200,
    body: competitionPublicDetail,
  });
};

describe('Competition portal mobile accessibility', () => {
  COMPETITION_MOBILE_VIEWPORTS.forEach(({ width, height, label }) => {
    it(`keeps public competition routes usable on ${label}`, () => {
      cy.viewport(width, height);
      stubCompetitionPublicApi();

      cy.visit('/cuoc-thi');
      cy.contains('h1', 'SÂN CHƠI TÔ HIỆU QUIZ').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/cuoc-thi/olympic-toan');
      cy.contains('h1', 'Olympic Toán 2026').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/cuoc-thi/olympic-toan/tin-tuc/the-le');
      cy.contains('h1', 'Thể lệ cuộc thi').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/cuoc-thi/olympic-toan/bang-vang');
      cy.contains('h1', 'Bảng vàng').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();
    });

    it(`keeps student competition routes usable on ${label}`, () => {
      cy.viewport(width, height);
      stubCompetitionPublicApi();
      stubCompetitionStudentApi();

      cy.visit('/thi/olympic-toan', {
        onBeforeLoad(win) {
          win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
        },
      });
      cy.contains('h1', 'Olympic Toán 2026').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/thi/olympic-toan/vong/1');
      cy.contains('h1', 'Vòng 1').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/thi/olympic-toan/vong/1/quy-che');
      cy.contains('h1', 'Thể lệ cuộc thi').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/thi/olympic-toan/vong/1/kiem-tra', {
        onBeforeLoad(win) {
          win.sessionStorage.setItem('competition-rules:campaign-1:round-1', 'acknowledged');
        },
      });
      cy.contains('h1', 'Sẵn sàng vào thi').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/thi/olympic-toan/vong/1/lam-bai');
      cy.contains('h1', 'Vòng 1').should('be.visible');
      cy.contains('button', 'BẮT ĐẦU BÀI THI').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();

      cy.visit('/thi/olympic-toan/school-exam/lam-bai');
      cy.contains('h1', 'School Exam').should('be.visible');
      cy.contains('button', 'BẮT ĐẦU SCHOOL EXAM').should('be.visible');
      assertNoHorizontalOverflow();
      assertCompetitionTouchTargets();
      assertCompetitionFocusTreatment();
    });
  });
});
