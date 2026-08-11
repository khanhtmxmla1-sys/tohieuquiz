interface AxeViolation { impact?: string | null }
interface AxeReport { violations: AxeViolation[] }
interface AxeRuntime {
  run: (context: Document, options: Record<string, unknown>) => Promise<AxeReport>;
}

const adminStorage = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'admin.rollout',
    teacherName: 'Rollout Admin',
    isAdmin: true,
    teacherClass: '',
  },
  version: 0,
});

const baseFlag = {
  key: 'unified_notifications_v1',
  description: 'Unified notifications',
  enabled: false,
  audience: 'all',
  percentage: 100,
  allowUsers: [],
  allowClasses: ['class-4a'],
  startsAt: null,
  endsAt: null,
  owner: 'platform',
  reason: 'Pilot ban đầu',
  stopConditions: { max5xxRatePercent: 1, maxClientErrorMultiplier: 2, maxP95IncreasePercent: 30 },
  version: 2,
  updatedBy: 'admin.rollout',
  updatedAt: '2026-08-11T01:00:00.000Z',
};

const installBackend = () => {
  let flag = { ...baseFlag };
  let batchCalls = 0;

  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      status: 'success',
      data: { username: 'admin.rollout', fullName: 'Rollout Admin', role: 'admin', classes: [], mustChangePassword: false },
    },
  }).as('account');
  cy.intercept('GET', '**/api/announcements/current*', {
    statusCode: 200,
    body: { status: 'success', data: { items: [] } },
  });
  cy.intercept({ method: 'GET', pathname: '/api/system-settings/feature-flags' }, (request) => {
    request.reply({ statusCode: 200, body: { status: 'success', data: [flag] } });
  }).as('featureFlags');
  cy.intercept({ method: 'PATCH', pathname: '/api/system-settings/feature-flags/unified_notifications_v1/batch' }, (request) => {
    batchCalls += 1;
    expect(batchCalls).to.equal(1);
    expect(request.body.expectedVersion).to.equal(2);
    expect(request.body.reason).to.equal('Thử 10% giáo viên');
    expect(request.body.changes).to.deep.equal([
      { field: 'enabled', value: true },
      { field: 'audience', value: 'teacher' },
      { field: 'percentage', value: 10 },
    ]);
    flag = {
      ...flag,
      enabled: true,
      audience: 'teacher',
      percentage: 10,
      reason: request.body.reason,
      version: 3,
      updatedAt: '2026-08-11T02:00:00.000Z',
    };
    request.reply({ statusCode: 200, body: { status: 'success', data: flag } });
  }).as('batchFlag');
  cy.intercept({ method: 'POST', pathname: '/api/system-settings/feature-flags/unified_notifications_v1/rollback' }, (request) => {
    expect(request.body).to.deep.equal({ reason: 'Rollback do lỗi tăng' });
    flag = { ...baseFlag, version: 4, reason: 'Rollback do lỗi tăng' };
    request.reply({ statusCode: 200, body: { status: 'success', data: flag } });
  }).as('rollbackFlag');
};

const visitRollout = () => {
  cy.visit('/teacher/feature-rollout', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', adminStorage);
    },
  });
  cy.wait('@account');
  cy.wait('@featureFlags');
  cy.contains('h2', 'Tính năng thử nghiệm', { timeout: 20_000 }).should('be.visible');
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.be.lte(document.documentElement.clientWidth + 1);
  });
};

const assertNoSeriousA11yViolations = () => {
  cy.document().then((document) => document.documentElement.setAttribute('lang', 'vi'));
  cy.readFile('node_modules/axe-core/axe.min.js', 'utf8').then((source: string) => {
    cy.window().then(async (win) => {
      win.eval(source);
      const axeWindow = win as typeof win & { axe: AxeRuntime };
      const report = await axeWindow.axe.run(win.document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        resultTypes: ['violations'],
      });
      const serious = report.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
      expect(serious, JSON.stringify(serious, null, 2)).to.deep.equal([]);
    });
  });
};

describe('Feature rollout admin UX', () => {
  beforeEach(() => installBackend());

  [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [320, 568],
  ].forEach(([width, height]) => {
    it(`has no horizontal overflow at ${width}x${height}`, () => {
      cy.viewport(width, height);
      visitRollout();
      assertNoHorizontalOverflow();
    });
  });

  it('applies 10% to teachers with exactly one atomic batch request', () => {
    visitRollout();
    cy.get('select[aria-label="Đối tượng thử nghiệm"]').select('teacher');
    cy.contains('button', '10%').click();
    cy.contains('Sau khi áp dụng').parent().should('contain.text', '10%').and('contain.text', 'Giáo viên');
    cy.get('textarea[aria-label="Lý do thay đổi"]').type('Thử 10% giáo viên');
    cy.contains('button', 'Áp dụng thay đổi').click();
    cy.wait('@batchFlag');
    cy.contains('v3').should('be.visible');
  });

  it('requires reason and confirmation before rollback and passes axe', () => {
    visitRollout();
    assertNoSeriousA11yViolations();

    cy.contains('button', 'Hoàn tác thay đổi gần nhất').click();
    cy.get('textarea[aria-label="Lý do thay đổi"]').type('Rollback do lỗi tăng');
    cy.contains('button', 'Hoàn tác thay đổi gần nhất').click();
    cy.contains('[role="dialog"]', 'Hoàn tác thay đổi gần nhất?').within(() => {
      cy.contains('v2').should('be.visible');
      cy.contains(/Mutation gần nhất/i).should('be.visible');
      cy.contains('button', 'Xác nhận hoàn tác').click();
    });
    cy.wait('@rollbackFlag');
  });
});
