const VIEWPORTS = [
  { width: 375, height: 812, label: '375x812' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 1440, height: 900, label: '1440x900' },
] as const;

let studentCredentials = { username: '', password: '' };

const loadStudentCredentials = () =>
  cy
    .env<{ studentUsername?: string; studentPassword?: string }>([
      'studentUsername',
      'studentPassword',
    ])
    .then(({ studentUsername, studentPassword }) => {
      studentCredentials = {
        username: String(studentUsername || ''),
        password: String(studentPassword || ''),
      };

      expect(
        studentCredentials.username,
        'studentUsername is required. Run with --env studentUsername=...,studentPassword=...',
      ).to.not.equal('');
      expect(
        studentCredentials.password,
        'studentPassword is required. Run with --env studentUsername=...,studentPassword=...',
      ).to.not.equal('');
    });

const loginAsStudent = () => {
  cy.visit('/');
  cy.contains('button', 'Học sinh').click();
  cy.get('input[type="text"]').first().clear().type(studentCredentials.username, { log: false });
  cy.get('input[type="password"]').first().clear().type(studentCredentials.password, { log: false });
  cy.contains('button', 'Đăng nhập ngay').click();
  cy.get('.student-dashboard', { timeout: 20_000 }).should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    const root = document.documentElement;
    expect(root.scrollWidth, 'document scrollWidth').to.be.lte(root.clientWidth + 1);
  });
};

/** Thẻ chuyên đề bám theo data-testid nên không lệ thuộc nhãn tiếng Việt hay trạng thái loading. */
const topicCards = () => cy.get('[data-testid="practice-topic-card"]');

/** Vị trí cuộn của dashboard ngay trước khi bấm vào môn — dùng để kiểm tra Back khôi phục đúng chỗ. */
let dashboardScrollY = 0;

const openFirstAvailableSubject = () => {
  // Giữ tiêu đề môn trong một biến JS thường, KHÔNG dùng alias Cypress: alias sinh từ truy vấn DOM
  // sẽ được truy vấn lại khi đọc, nên sau khi click điều hướng sang /student/practice/<môn> thì
  // phần tử gốc không còn tồn tại và alias trả về tập rỗng — trước đây mọi test trong file đều
  // chết ở đúng bước này dù trang đích render đúng.
  let subjectTitle = '';

  cy.get('#practice-library').scrollIntoView().should('be.visible');
  cy.window().then((win) => { dashboardScrollY = win.scrollY; });
  cy.get('[data-testid="subject-practice-grid"] button').first().within(() => {
    cy.get('span.text-lg').invoke('text').then((text) => {
      subjectTitle = String(text).trim();
    });
  });
  cy.get('[data-testid="subject-practice-grid"] button').first().click();
  cy.location('pathname', { timeout: 15_000 }).should(
    'match',
    /^\/student\/practice\/(toan|tieng-viet|tu-nhien-xa-hoi|tieng-anh|tin-hoc)$/,
  );
  // Trước đây chỗ này phải tự gọi win.scrollTo(0, 0): điều hướng client-side giữ nguyên vị trí cuộn
  // nên trang môn mở ra ở giữa trang, và ở 375px phần cuộn còn lại đủ lớn để đẩy hẳn h1 ra ngoài
  // màn hình (đo được scrollY 1371, h1 ở top -324). useScrollReset đã xử lý, nên workaround đó giờ
  // thành assertion — chính nó chứng minh lỗi không quay lại.
  cy.window().its('scrollY').should('equal', 0);
  cy.then(() => {
    expect(subjectTitle, 'tiêu đề môn đọc được trước khi điều hướng').to.not.equal('');
    cy.contains('h1', subjectTitle).should('be.visible');
  });
  cy.get('input[type="search"][aria-label="Tìm chuyên đề"], input#practice-topic-search')
    .should('be.visible');
};

describe('Authenticated student practice library flow', () => {
  before(() => {
    loadStudentCredentials();
  });

  it('returns to the dashboard with browser Back from a canonical subject route', () => {
    // 375x812 là đúng cấu hình từng đỏ: dashboard một cột đủ cao để phần cuộn còn lại đẩy hẳn
    // tiêu đề ra ngoài màn hình.
    cy.viewport(375, 812);
    loginAsStudent();
    openFirstAvailableSubject();

    cy.go('back');
    cy.location('pathname').should('equal', '/');
    cy.get('#practice-library').should('be.visible');
    // Đọc dashboardScrollY trong cy.then để lấy giá trị lúc chạy, không phải lúc xếp hàng lệnh.
    cy.then(() => {
      expect(dashboardScrollY, 'dashboard đã cuộn trước khi điều hướng').to.be.greaterThan(0);
      cy.window().its('scrollY').should('be.closeTo', dashboardScrollY, 50);
    });
  });

  it('returns to where the student left the dashboard via the in-app back button', () => {
    cy.viewport(375, 812);
    loginAsStudent();
    openFirstAvailableSubject();

    // Nút này từng là navigate('/') — một PUSH mới, nên sau khi có reset cuộn nó sẽ đẩy học sinh
    // về đầu dashboard. Giờ nó lùi lại history thật, và POP khôi phục đúng vị trí cũ.
    cy.get('header button[aria-label="Trở về thư viện"]').click();
    cy.location('pathname').should('equal', '/');
    cy.get('#practice-library').should('be.visible');
    cy.then(() => {
      cy.window().its('scrollY').should('be.closeTo', dashboardScrollY, 50);
    });
  });

  it('keeps a canonical direct subject route across reload', () => {
    loginAsStudent();
    openFirstAvailableSubject();

    cy.location('pathname').then((pathname) => {
      const subjectPath = String(pathname);
      cy.reload();
      cy.location('pathname').should('equal', subjectPath);
      cy.get('h1').should('be.visible');

      cy.visit('/');
      cy.visit(subjectPath);
      cy.location('pathname').should('equal', subjectPath);
      cy.get('h1').should('be.visible');
    });
  });

  it('filters topics and distinguishes a search-empty state', () => {
    loginAsStudent();
    openFirstAvailableSubject();

    topicCards().first().find('span.text-xl').invoke('text').then((topicTitle) => {
      cy.get('input#practice-topic-search').clear().type(String(topicTitle).trim());
      topicCards().should('have.length.at.least', 1);
    });

    cy.get('input#practice-topic-search').clear().type('khong-co-chuyen-de-nay-987654');
    cy.contains('Không tìm thấy chuyên đề phù hợp.').should('be.visible');
  });

  it('shows local topic loading before entering the quiz player', () => {
    loginAsStudent();
    openFirstAvailableSubject();

    cy.intercept('**', (request) => {
      const requestBody = typeof request.body === 'string'
        ? request.body
        : JSON.stringify(request.body || {});
      if (request.url.includes('practice') || requestBody.includes('get_practice_quiz')) {
        request.continue((response) => response.setDelay(800));
      }
    });

    // Không dùng alias theo chữ: khi bấm, nhãn nút đổi từ "Luyện 10 câu" thành "Đang chuẩn bị..."
    // (TopicCard.tsx), nên truy vấn lại theo chữ cũ sẽ bắt sang một chuyên đề khác đang rảnh và
    // assert aria-busy chắc chắn fail. data-testid không đổi theo trạng thái.
    topicCards().first().click();
    topicCards().first().should('have.attr', 'aria-busy', 'true').and('be.disabled');

    cy.get('body', { timeout: 20_000 }).should(($body) => {
      const hasQuizQuestions = $body.find('[aria-label^="Câu "]').length > 0;
      const hasStudentStart = $body.text().includes('Bắt đầu làm bài!');
      expect(hasQuizQuestions || hasStudentStart, 'quiz player is visible').to.equal(true);
    });
  });

  VIEWPORTS.forEach(({ width, height, label }) => {
    it(`has no horizontal overflow on the subject page at ${label}`, () => {
      cy.viewport(width, height);
      loginAsStudent();
      openFirstAvailableSubject();
      assertNoHorizontalOverflow();
      cy.get('header button[aria-label="Trở về thư viện"]').should('have.css', 'min-height', '44px');
      topicCards().first().should('be.visible');
    });
  });
});
