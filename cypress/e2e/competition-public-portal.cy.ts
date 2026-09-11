/// <reference types="cypress" />

const campaignSlug = 'hoi-thi-toan-2026';
const campaignId = 'campaign-1';
const roundId = 'round-1';

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

const publicRounds = Array.from({ length: 6 }, (_, index) => ({
  roundNumber: index + 1,
  title: `Vòng ${index + 1}`,
  opensAt: '2026-09-01T00:00:00.000Z',
  closesAt: '2026-09-30T00:00:00.000Z',
  state: index === 0 ? 'OPEN' : 'LOCKED',
}));

const portalRounds = publicRounds.map((round) => ({
  ...round,
  roundId: `round-${round.roundNumber}`,
  attemptCount: 0,
  maxAttempts: 2,
}));

const publicSummary = {
  slug: campaignSlug,
  title: 'Hội thi Toán 2026',
  summary: 'Sân chơi Toán học dành cho học sinh.',
  schoolYear: '2026-2027',
  publicState: 'ONGOING',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2027-05-31T00:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  hero: { title: 'Chinh phục tri thức' },
  cta: { label: 'Vào thi' },
  rounds: publicRounds,
  articleSummaryAvailable: true,
  goldenBoardAvailable: true,
};

const publicResponse = (data: unknown) => ({ status: 'success', data });

const publicDetail = {
  ...publicSummary,
  articles: [{
    slug: 'quy-che',
    title: 'Quy chế cuộc thi',
    summary: 'Các quy định cần biết trước khi tham gia.',
    content: 'Thí sinh đọc kỹ quy chế và hoàn thành bài thi đúng thời gian.',
    type: 'RULES',
    publishedAt: '2026-08-25T00:00:00.000Z',
  }],
};

const studentCompetition = {
  id: campaignId,
  title: publicSummary.title,
  schoolYear: publicSummary.schoolYear,
  status: 'ACTIVE',
  eligibility: { version: 1, qualified: true, reasonCodes: [], qualifiedAt: '2026-08-25T00:00:00.000Z' },
  rounds: portalRounds.map((round) => ({
    id: round.roundId,
    roundNumber: round.roundNumber,
    opensAt: round.opensAt,
    closesAt: round.closesAt,
    maxAttempts: round.maxAttempts,
    passingScore: 7,
    status: round.roundNumber === 1 ? 'OPEN' : 'UPCOMING',
    attemptsUsed: 0,
    bestScore: null,
  })),
};

const studentPortal = {
  campaignId,
  slug: campaignSlug,
  title: publicSummary.title,
  schoolYear: publicSummary.schoolYear,
  publicState: publicSummary.publicState,
  rounds: portalRounds,
  schoolExam: {
    qualified: true,
    eventId: 'event-1',
    scheduledAt: '2027-05-01T00:00:00.000Z',
    roomName: 'Phòng A',
    ready: true,
  },
};

const ordinaryPreflight = {
  status: 'READY',
  campaignId,
  roundId,
  quizId: 'quiz-round-1',
  serverTime: '2026-09-01T00:00:00.000Z',
  window: {
    opensAt: '2026-09-01T00:00:00.000Z',
    closesAt: '2026-09-30T00:00:00.000Z',
    timezone: 'Asia/Ho_Chi_Minh',
  },
  attemptsRemaining: 2,
};

const installPlatformIntercepts = () => {
  cy.intercept('GET', '**/api/system-settings*', {
    status: 'success',
    data: { aiAssistantEnabled: false },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 401,
    body: { status: 'error' },
  });
};

const installPublicIntercepts = () => {
  installPlatformIntercepts();
  cy.intercept('GET', '**/api/public/competitions', {
    statusCode: 200,
    body: publicResponse([publicSummary]),
  }).as('publicIndex');
  cy.intercept('GET', `**/api/public/competitions/${campaignSlug}`, {
    statusCode: 200,
    body: publicResponse(publicDetail),
  }).as('publicDetail');
  cy.intercept('GET', `**/api/public/competitions/${campaignSlug}/articles/quy-che`, {
    statusCode: 200,
    body: publicResponse(publicDetail.articles[0]),
  }).as('publicArticle');
};

const installStudentIntercepts = () => {
  installPlatformIntercepts();
  cy.intercept('GET', '**/api/student-profile', {
    status: 'success',
    data: student,
  }).as('studentProfile');
  cy.intercept('GET', `**/api/student/competitions/by-slug/${campaignSlug}`, {
    statusCode: 200,
    body: { competition: studentCompetition, portal: studentPortal },
  }).as('studentPortal');
};

const visitAsStudent = (path: string) => cy.visit(path, {
  onBeforeLoad(win) {
    win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
  },
});

describe('Competition public portal release journey', () => {
  it('serves the anonymous index, campaign detail, and published article', () => {
    installPublicIntercepts();

    cy.visit('/cuoc-thi');
    cy.wait('@publicIndex');
    cy.contains('h1', 'SÂN CHƠI TÔ HIỆU QUIZ').should('be.visible');
    cy.contains('Hội thi Toán 2026').should('be.visible');

    cy.visit(`/cuoc-thi/${campaignSlug}`);
    cy.wait('@publicDetail');
    cy.contains('h1', 'Hội thi Toán 2026').should('be.visible');
    cy.contains('Hành trình 6 vòng').should('be.visible');
    cy.get('section[aria-label="Hành trình 6 vòng"] li').should('have.length', 6);

    cy.contains('a', 'Quy chế cuộc thi').click();
    cy.wait('@publicArticle');
    cy.contains('h1', 'Quy chế cuộc thi').should('be.visible');
    cy.contains('Thí sinh đọc kỹ quy chế').should('be.visible');
  });

  it('redirects an anonymous Student deep link to login with a safe return path', () => {
    installPlatformIntercepts();
    cy.intercept('GET', '**/api/student-profile', {
      statusCode: 401,
      body: { status: 'error' },
    });

    visitAsStudent(`/thi/${campaignSlug}/vong/1/lam-bai`);
    cy.location('pathname').should('eq', '/');
    cy.location('search').should('include', 'login=student');
    cy.location('search').should('include', 'returnTo=%2Fthi%2Fhoi-thi-toan-2026%2Fvong%2F1%2Flam-bai');
  });

  it('shows six rounds, confirms rules, runs preflight without creating an attempt, then starts and submits', () => {
    installStudentIntercepts();
    cy.intercept('GET', `**/api/student/competitions/${campaignId}`, {
      statusCode: 200,
      body: { competition: studentCompetition },
    }).as('studentCompetition');
    cy.intercept('GET', `**/api/student/competitions/${campaignId}/official-result`, {
      statusCode: 404,
      body: { error: 'SCHOOL_EXAM_PUBLICATION_NOT_FOUND' },
    });
    cy.intercept('GET', `**/api/public/competitions/${campaignSlug}`, {
      statusCode: 200,
      body: publicResponse(publicDetail),
    }).as('rulesDetail');
    cy.intercept('POST', `**/api/student/competitions/${campaignId}/rounds/${roundId}/preflight`, {
      statusCode: 200,
      body: { preflight: ordinaryPreflight },
    }).as('roundPreflight');
    let attemptCreateCount = 0;
    cy.intercept('POST', `**/api/student/competitions/${campaignId}/rounds/${roundId}/attempts`, (request) => {
      attemptCreateCount += 1;
      request.reply({
      statusCode: 200,
      body: {
        attempt: { id: 'attempt-1', campaignId, roundId, startedAt: '2026-09-01T01:00:00.000Z' },
        quiz: {
          id: 'quiz-round-1',
          title: 'Đề vòng 1',
          timeLimit: 30,
          questions: [{ id: 'question-1', type: 'MCQ', question: '1 + 1 = ?', options: ['1', '2'] }],
        },
      },
      });
    }).as('startAttempt');
    cy.intercept('POST', `**/api/student/competitions/${campaignId}/rounds/${roundId}/attempts/attempt-1/submit`, {
      statusCode: 200,
      body: {
        result: {
          score: 10,
          correctCount: 1,
          totalQuestions: 1,
          progress: { attemptsUsed: 1, bestScore: 10, isPassed: true },
        },
      },
    }).as('submitAttempt');

    cy.clock(new Date('2026-09-01T01:00:00.000Z').getTime(), ['Date']);
    visitAsStudent(`/thi/${campaignSlug}`);
    cy.wait('@studentProfile');
    cy.wait('@studentPortal');
    cy.wait('@studentCompetition');
    cy.contains('h2', 'Hành trình 6 vòng thi').should('be.visible');
    cy.get('section[aria-labelledby="six-round-journey-title"] article').should('have.length', 6);

    cy.contains('a', 'Vào thi vòng 1').click();
    cy.contains('h1', 'Vòng 1').should('be.visible');
    cy.contains('a', 'VÀO THI').click();
    cy.wait('@rulesDetail');
    cy.contains('h1', 'Quy chế cuộc thi').should('be.visible');
    cy.get('input[type="checkbox"]').check();
    cy.contains('button', 'TIẾP TỤC KIỂM TRA').click();
    cy.wait('@roundPreflight');
    cy.contains('h1', 'Sẵn sàng vào thi').should('be.visible');
    cy.wrap(null).then(() => expect(attemptCreateCount).to.eq(0));

    cy.contains('a', 'BẮT ĐẦU').click();
    cy.contains('button', 'BẮT ĐẦU BÀI THI').click();
    cy.wait('@roundPreflight');
    cy.wait('@startAttempt');
    cy.contains('h1', 'Đề vòng 1').should('be.visible');
    cy.contains('button', 'Nộp bài').should('be.enabled').click();
    cy.get('[role="dialog"]').should('contain.text', 'Xác nhận thao tác').within(() => {
      cy.contains('button', 'Nộp bài').click();
    });
    cy.wait('@submitAttempt');
    cy.contains('h1', 'Kết quả bài thi').should('be.visible');
    cy.contains('Điểm: 10').should('be.visible');
    cy.wrap(null).then(() => expect(attemptCreateCount).to.eq(1));
  });

  it('takes School Exam from READY preflight through canonical Live Exam join and keeps results withheld', () => {
    installStudentIntercepts();
    cy.intercept('POST', `**/api/student/competitions/${campaignId}/school-exam/preflight`, {
      statusCode: 200,
      body: {
        preflight: {
          status: 'READY',
          campaignId,
          title: 'School Exam',
          roomName: 'Phòng A',
          scheduledAt: '2027-05-01T00:00:00.000Z',
          serverTime: '2027-05-01T00:00:00.000Z',
          window: {
            opensAt: '2027-05-01T00:00:00.000Z',
            closesAt: '2027-05-01T01:00:00.000Z',
            timezone: 'Asia/Ho_Chi_Minh',
          },
          accessCode: 'SCHOOL-2027',
        },
      },
    }).as('schoolExamPreflight');
    cy.intercept('POST', '**/api/live-exam/join', (request) => {
      expect(request.body).to.deep.equal({ accessCode: 'SCHOOL-2027' });
      request.reply({
        statusCode: 200,
        body: {
          success: true,
          participant: { id: 'participant-1' },
          session: {
            id: 'live-session-1',
            title: 'School Exam',
            quizId: 'live-quiz-1',
            duration: 45,
            startedAt: '2027-05-01T00:00:00.000Z',
            endsAt: '2027-05-01T00:45:00.000Z',
            status: 'waiting',
          },
        },
      });
    }).as('liveExamJoin');
    cy.intercept('GET', '**/api/live-exam/live-session-1/status', {
      statusCode: 200,
      body: {
        success: true,
        session: {
          id: 'live-session-1',
          title: 'School Exam',
          status: 'closed',
          duration: 45,
          endsAt: '2027-05-01T00:45:00.000Z',
        },
        participantSubmittedAt: '2027-05-01T00:30:00.000Z',
      },
    });
    cy.intercept('GET', '**/api/live-exam/live-session-1/chat', {
      statusCode: 200,
      body: { success: true, messages: [], settings: { enabled: false } },
    });

    visitAsStudent(`/thi/${campaignSlug}/school-exam/lam-bai`);
    cy.wait('@studentProfile');
    cy.wait('@studentPortal');
    cy.contains('h1', 'School Exam').should('be.visible');
    cy.contains('button', 'BẮT ĐẦU SCHOOL EXAM').click();
    cy.wait('@schoolExamPreflight');
    cy.wait('@liveExamJoin');
    cy.contains('Bài thi đã được ghi nhận. Kết quả chính thức sẽ được công bố sau khi Ban tổ chức hoàn tất đối soát.')
      .should('be.visible');
  });

  it('hides Golden Board before publication and refreshes the public source versions after correction and republish', () => {
    installPlatformIntercepts();
    let published = false;
    let board = {
      winners: [{
        fullName: 'Nguyễn Văn An',
        className: '4A',
        schoolName: 'Tiểu học Tô Hiệu',
        gradeLevel: 4,
        awardCode: 'GOLD',
        awardLabel: 'Giải Nhất',
      }],
      publicationVersion: 2,
      rankingVersion: 4,
      awardRuleVersion: 3,
      publishedAt: '2027-05-02T00:00:00.000Z',
    };
    cy.intercept('GET', `**/api/public/competitions/${campaignSlug}/golden-board`, (request) => {
      if (!published) {
        request.reply({ statusCode: 404, body: { error: 'GOLDEN_BOARD_PUBLICATION_UNAVAILABLE' } });
        return;
      }
      request.reply({ statusCode: 200, body: publicResponse(board) });
    }).as('goldenBoard');

    cy.visit(`/cuoc-thi/${campaignSlug}/bang-vang`);
    cy.get('@goldenBoard.all').should((requests) => {
      expect(requests.some((request) => request.response?.statusCode === 404)).to.eq(true);
    });
    cy.contains('Không tìm thấy bảng vàng hoặc bảng vàng tạm thời chưa khả dụng.').should('be.visible');

    cy.then(() => {
      published = true;
    });
    cy.get('button[aria-label="Tải lại bảng vàng"]').click();
    cy.get('@goldenBoard.all').should((requests) => {
      expect(requests.some((request) => (
        request.response?.statusCode === 200
        && request.response?.body.data.publicationVersion === 2
      ))).to.eq(true);
    });
    cy.contains('Nguyễn Văn An').should('be.visible');
    cy.contains('Giải Nhất').should('be.visible');

    cy.then(() => {
      board = { ...board, publicationVersion: 3, rankingVersion: 5, awardRuleVersion: 4 };
    });
    cy.get('button[aria-label="Tải lại bảng vàng"]').click();
    cy.get('@goldenBoard.all').should((requests) => {
      expect(requests.some((request) => (
        request.response?.statusCode === 200
        && request.response?.body.data.publicationVersion === 3
        && request.response?.body.data.rankingVersion === 5
        && request.response?.body.data.awardRuleVersion === 4
      ))).to.eq(true);
    });
  });

  it('follows the server-authoritative legacy competition slug', () => {
    installStudentIntercepts();
    cy.intercept('GET', '**/api/student/competitions', {
      statusCode: 200,
      body: { items: [{
        id: campaignId,
        title: publicSummary.title,
        status: 'ACTIVE',
        slug: campaignSlug,
      }] },
    }).as('legacyCompetitions');

    visitAsStudent('/student/competition');
    cy.wait('@studentProfile');
    cy.wait('@legacyCompetitions');
    cy.location('pathname').should('eq', `/thi/${campaignSlug}`);
    cy.wait('@studentPortal');
    cy.contains('h1', publicSummary.title).should('be.visible');
  });
});
