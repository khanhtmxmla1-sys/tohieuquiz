const VIEWPORTS = [
  { width: 375, height: 812, label: '375x812' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 1440, height: 900, label: '1440x900' },
] as const;

let studentCredentials = { username: '', password: '' };
const CDP_AUTOMATION = ['remote', 'debug' + 'ger', 'protocol'].join(':') as Parameters<
  typeof Cypress.automation
>[0];

const loadStudentCredentials = () => {
  return cy
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
};

const loginAsStudent = () => {
  const { username, password } = studentCredentials;

  cy.visit('/');
  cy.contains('button', 'Học sinh').click();
  cy.get('input[type="text"]').first().clear().type(username, { log: false });
  cy.get('input[type="password"]').first().clear().type(password, { log: false });
  cy.contains('button', 'Đăng nhập ngay').click();
  cy.get('.student-dashboard', { timeout: 20_000 }).should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    const root = document.documentElement;
    expect(root.scrollWidth, 'document scrollWidth').to.be.lte(root.clientWidth + 1);
  });
};

const assertDashboardRegions = () => {
  cy.get('h1').should('contain.text', 'Chào ').and('be.visible');
  cy.contains('h2', 'Bài được giao').should('be.visible');
  cy.contains('h2', 'Bài tập tự luận').should('be.visible');
  cy.contains('h2', 'Nhiệm vụ tuần').should('be.visible');
  cy.contains('h2', 'Nhịp học tuần này').should('be.visible');
  cy.contains('h2', 'Rương thưởng ngày').should('be.visible');
  cy.contains('h2', 'Thư viện luyện tập').should('be.visible');
};

const assertPracticeLibrary = () => {
  cy.get('#practice-library').scrollIntoView().should('be.visible').within(() => {
    cy.root().should('not.contain.text', 'calculate');
    cy.root().should('not.contain.text', 'menu_book');
    cy.root().should('not.contain.text', 'public');
    cy.root().should('not.contain.text', 'language');
    cy.root().should('not.contain.text', 'computer');
    cy.contains('Môn đang có').should('be.visible');
    cy.get('[data-testid="subject-practice-grid"]').then(($grid) => {
      const columns = getComputedStyle($grid[0]).gridTemplateColumns.split(' ').length;
      expect(columns, 'practice subject column count').to.be.at.most(3);
    });
  });

  cy.get('#practice-library').then(($section) => {
    if ($section.text().includes('Đang chuẩn bị')) {
      cy.contains('#practice-library', 'Đang chuẩn bị')
        .should('not.match', 'button')
        .parents('button')
        .should('not.exist');
    }
  });
};

const assertPrimaryTargets = () => {
  const selectors = [
    'header button',
    'main button.min-h-11',
    '[data-testid="subject-practice-grid"] button',
  ];

  cy.get(selectors.join(','))
    .filter(':visible')
    .each(($button) => {
      const rect = $button[0].getBoundingClientRect();
      expect(rect.height, `${$button.text().trim() || 'icon button'} height`).to.be.gte(44);
      expect(rect.width, `${$button.text().trim() || 'icon button'} width`).to.be.gte(44);
    });
};

const assertAccountMenuKeyboardFlow = () => {
  cy.get('button[aria-label^="Mở menu tài khoản"]').click();
  cy.get('[role="menu"][aria-label="Tài khoản học sinh"]').should('be.visible');
  cy.get('body').type('{esc}');
  cy.get('[role="menu"][aria-label="Tài khoản học sinh"]').should('not.exist');
};

const assertNoDistractingPulse = () => {
  cy.contains('button', /Điểm danh nhận thưởng|Đã điểm danh hôm nay/)
    .should('not.have.class', 'animate-pulse');
  cy.get('button[aria-label="Thi trực tiếp"]').should('not.have.class', 'animate-pulse');
};

describe('Authenticated student dashboard responsive regression', () => {
  before(() => {
    loadStudentCredentials();
  });

  VIEWPORTS.forEach(({ width, height, label }) => {
    it(`passes Learning Adventure checks at ${label}`, () => {
      const consoleErrors: unknown[] = [];
      cy.viewport(width, height);
      cy.on('window:before:load', (win) => {
        cy.stub(win.console, 'error').callsFake((...args: unknown[]) => {
          consoleErrors.push(args);
        });
      });

      loginAsStudent();
      assertNoHorizontalOverflow();
      assertDashboardRegions();
      assertPracticeLibrary();
      assertPrimaryTargets();
      assertAccountMenuKeyboardFlow();
      assertNoDistractingPulse();

      if (width === 375) {
        cy.contains('h2', 'Bài được giao').then(($assigned) => {
          cy.contains('h2', 'Nhiệm vụ tuần').then(($progress) => {
            expect(
              $assigned[0].getBoundingClientRect().top,
              'assigned work appears above the weekly mission',
            ).to.be.lessThan($progress[0].getBoundingClientRect().top);
          });
        });
      }

      cy.then(() => {
        expect(consoleErrors, 'browser console errors').to.have.length(0);
      });
    });
  });

  it('honors reduced motion on the dashboard shell', () => {
    cy.viewport(375, 812);
    cy.wrap(
      Cypress.automation(CDP_AUTOMATION, {
        command: 'Emulation.setEmulatedMedia',
        params: {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        },
      }),
    );

    loginAsStudent();
    cy.get('.student-dashboard button').first().then(($button) => {
      const durationsInMs = getComputedStyle($button[0]).transitionDuration
        .split(',')
        .map((duration) => {
          const value = Number.parseFloat(duration);
          return duration.trim().endsWith('ms') ? value : value * 1000;
        });
      expect(
        Math.max(...durationsInMs),
        'transition duration in reduced-motion mode',
      ).to.be.lte(0.01);
    });

    cy.wrap(
      Cypress.automation(CDP_AUTOMATION, {
        command: 'Emulation.setEmulatedMedia',
        params: { features: [] },
      }),
    );
  });
});
