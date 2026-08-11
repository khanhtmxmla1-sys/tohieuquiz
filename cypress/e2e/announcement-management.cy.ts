interface AxeViolation { impact?: string | null }
interface AxeReport { violations: AxeViolation[] }
interface AxeRuntime {
  run: (context: Document, options: Record<string, unknown>) => Promise<AxeReport>;
}

const adminStorage = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'admin.announcement',
    teacherName: 'Announcement Admin',
    isAdmin: true,
    teacherClass: '',
  },
  version: 0,
});

const baseRows = [
  {
    id: 'draft-1', content: 'Nội dung bản nháp', bannerTitle: 'Bản nháp đầu tuần', bannerSubtitle: '', bannerLink: '', bannerImage: '',
    isActive: true, isBannerActive: false, status: 'DRAFT', effectiveStatus: 'DRAFT', audience: 'ALL',
    startsAt: null, endsAt: null, updatedAt: '2026-08-11T01:00:00.000Z', priority: 'INFO', channels: ['TICKER'], dismissible: true,
    ctaLabel: '', surfaceOverrides: {},
  },
  {
    id: 'scheduled-1', content: 'Bảo trì hệ thống tối nay', bannerTitle: 'Bảo trì hệ thống', bannerSubtitle: '', bannerLink: '', bannerImage: '',
    isActive: false, isBannerActive: true, status: 'SCHEDULED', effectiveStatus: 'SCHEDULED', audience: 'TEACHERS',
    startsAt: '2026-08-12T15:00:00.000Z', endsAt: null, updatedAt: '2026-08-11T02:00:00.000Z', priority: 'IMPORTANT', channels: ['BANNER'], dismissible: true,
    ctaLabel: '', surfaceOverrides: {},
  },
  {
    id: 'published-1', content: 'Lịch kiểm tra đã được cập nhật', bannerTitle: 'Lịch kiểm tra', bannerSubtitle: '', bannerLink: '', bannerImage: '',
    isActive: false, isBannerActive: true, status: 'PUBLISHED', effectiveStatus: 'PUBLISHED', audience: 'STUDENTS',
    startsAt: null, endsAt: null, updatedAt: '2026-08-11T03:00:00.000Z', priority: 'INFO', channels: ['BANNER'], dismissible: true,
    ctaLabel: '', surfaceOverrides: {},
  },
];

const installBaseBackend = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: {
      status: 'success',
      data: { username: 'admin.announcement', fullName: 'Announcement Admin', role: 'admin', classes: [], mustChangePassword: false },
    },
  }).as('account');
  cy.intercept('GET', '**/api/announcements/current*', {
    statusCode: 200,
    body: { status: 'success', data: { items: [] } },
  });
};

const installAnnouncementBackend = () => {
  let rows = baseRows.map((row) => ({ ...row }));
  let createdCount = 0;

  cy.intercept({ method: 'GET', pathname: '/api/admin/announcements' }, (request) => {
    request.reply({ statusCode: 200, body: { status: 'success', data: rows } });
  }).as('announcementList');

  cy.intercept({ method: 'POST', pathname: '/api/admin/announcements' }, (request) => {
    createdCount += 1;
    const created = {
      ...request.body,
      id: `created-${createdCount}`,
      effectiveStatus: request.body.status || 'DRAFT',
      updatedAt: '2026-08-11T12:00:00.000Z',
    };
    rows = [created, ...rows];
    request.reply({ statusCode: 201, body: { status: 'success', data: { id: created.id, updatedAt: created.updatedAt } } });
  }).as('createAnnouncement');

  cy.intercept({ method: 'PUT', pathname: '/api/admin/announcements/*' }, (request) => {
    const id = request.url.split('/api/admin/announcements/')[1].split('?')[0];
    rows = rows.map((row) => row.id === id ? {
      ...row,
      ...request.body,
      effectiveStatus: request.body.status || row.effectiveStatus,
      updatedAt: '2026-08-11T12:10:00.000Z',
    } : row);
    request.reply({ statusCode: 200, body: { status: 'success', data: { id, updatedAt: '2026-08-11T12:10:00.000Z' } } });
  }).as('updateAnnouncement');

  cy.intercept({ method: 'POST', pathname: '/api/admin/announcements/*/publish' }, (request) => {
    const id = request.url.split('/api/admin/announcements/')[1].split('/')[0];
    const current = rows.find((row) => row.id === id);
    const status = current?.status === 'SCHEDULED' ? 'SCHEDULED' : 'PUBLISHED';
    rows = rows.map((row) => row.id === id ? { ...row, status, effectiveStatus: status, updatedAt: '2026-08-11T12:20:00.000Z' } : row);
    request.reply({ statusCode: 200, body: { status: 'success', data: { id, status, updatedAt: '2026-08-11T12:20:00.000Z' } } });
  }).as('publishAnnouncement');

  const installAction = (action: 'cancel' | 'end' | 'archive', status: string) => {
    cy.intercept({ method: 'POST', pathname: `/api/admin/announcements/*/${action}` }, (request) => {
      const id = request.url.split('/api/admin/announcements/')[1].split('/')[0];
      rows = rows.map((row) => row.id === id ? { ...row, status, effectiveStatus: status, updatedAt: '2026-08-11T12:20:00.000Z' } : row);
      request.reply({ statusCode: 200, body: { status: 'success', data: { id, status, updatedAt: '2026-08-11T12:20:00.000Z' } } });
    }).as(`${action}Announcement`);
  };

  installAction('cancel', 'DRAFT');
  installAction('end', 'EXPIRED');
  installAction('archive', 'ARCHIVED');
};

const visitAnnouncements = () => {
  cy.visit('/teacher/announcements', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', adminStorage);
    },
  });
  cy.wait('@account');
  cy.wait('@announcementList');
  cy.contains('h2', 'Quản lý thông báo', { timeout: 20_000 }).should('be.visible');
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

describe('Announcement management admin UX', () => {
  beforeEach(() => {
    installBaseBackend();
    installAnnouncementBackend();
  });

  [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [320, 568],
  ].forEach(([width, height]) => {
    it(`has no horizontal overflow at ${width}x${height}`, () => {
      cy.viewport(width, height);
      visitAnnouncements();
      assertNoHorizontalOverflow();
    });
  });

  it('keeps filters after list → editor → back and guards a dirty draft', () => {
    visitAnnouncements();
    cy.get('input[aria-label="Tìm thông báo"]').type('Bảo trì');
    cy.get('select[aria-label="Đối tượng lọc"]').select('TEACHERS');
    cy.contains('button', 'Bảo trì hệ thống').click();

    cy.get('textarea[aria-label="Nội dung chính"]').clear().type('Bảo trì hệ thống có thay đổi');
    cy.window().then((win) => {
      const event = new win.Event('beforeunload', { cancelable: true });
      win.dispatchEvent(event);
      expect(event.defaultPrevented).to.equal(true);
    });
    cy.contains('button', 'Quay lại danh sách').click();
    cy.contains('Bỏ thay đổi').should('be.visible').click();

    cy.get('input[aria-label="Tìm thông báo"]').should('have.value', 'Bảo trì');
    cy.get('select[aria-label="Đối tượng lọc"]').should('have.value', 'TEACHERS');
  });

  it('creates a draft without publishing', () => {
    visitAnnouncements();
    cy.contains('button', 'Tạo thông báo').click();
    cy.get('input[type="radio"][aria-label="Tin chạy"]').check();
    cy.get('textarea[aria-label="Nội dung chính"]').type('Bản nháp chỉ lưu, chưa phát.');
    cy.contains('button', 'Lưu nháp').click();

    cy.wait('@createAnnouncement');
    cy.get('@publishAnnouncement.all').should('have.length', 0);
  });

  it('creates and schedules a banner with one publish action, then supports duplicate/cancel/archive lifecycle', () => {
    visitAnnouncements();
    cy.contains('button', 'Tạo thông báo').click();
    cy.get('input[type="radio"][aria-label="Thông báo nổi bật"]').check();
    cy.get('input[aria-label="Tiêu đề"]').type('Thông báo kiểm tra');
    cy.get('textarea[aria-label="Nội dung chính"]').type('Nội dung kiểm tra lịch phát');
    cy.get('input[type="radio"][aria-label="Giáo viên"]').check();
    cy.get('input[type="radio"][aria-label="Lên lịch"]').check();
    cy.get('input[aria-label="Bắt đầu phát"]').type('2026-08-13T08:00');
    cy.contains('button', 'Lên lịch').click();

    cy.wait('@createAnnouncement');
    cy.wait('@publishAnnouncement');

    cy.contains('button', 'Nhân bản').click();
    cy.contains('Đã đồng bộ').should('be.visible');
    cy.contains('button', 'Quay lại danh sách').click();

    cy.get('input[aria-label="Tìm thông báo"]').clear().type('Bảo trì hệ thống');
    cy.contains('button', 'Bảo trì hệ thống').click();
    cy.contains('button', 'Hủy lịch').click();
    cy.contains('[role="dialog"]', 'Hủy lịch thông báo?').within(() => cy.contains('button', 'Xác nhận hủy lịch').click());
    cy.wait('@cancelAnnouncement');

    cy.contains('button', 'Lưu trữ').click();
    cy.contains('[role="dialog"]', 'Lưu trữ thông báo?').within(() => cy.contains('button', 'Xác nhận lưu trữ').click());
    cy.wait('@archiveAnnouncement');
  });

  it('publishes an ALL message only after confirmation', () => {
    visitAnnouncements();
    cy.contains('button', 'Tạo thông báo').click();
    cy.get('input[type="radio"][aria-label="Tin chạy"]').check();
    cy.get('textarea[aria-label="Nội dung chính"]').type('Thông báo chung cho toàn hệ thống.');
    cy.contains('button', 'Công bố ngay').click();

    cy.contains('[role="dialog"]', 'Xác nhận công bố toàn hệ thống').should('be.visible');
    cy.get('@publishAnnouncement.all').should('have.length', 0);
    cy.contains('[role="dialog"]', 'Xác nhận công bố toàn hệ thống').within(() => {
      cy.contains('button', 'Xác nhận công bố').click();
    });
    cy.wait('@createAnnouncement');
    cy.wait('@publishAnnouncement');
  });

  it('supports keyboard completion, urgent confirmation, error focus, semantics, 44px targets and axe', () => {
    visitAnnouncements();
    assertNoSeriousA11yViolations();

    cy.contains('button', 'Tạo thông báo').click();
    cy.contains('button', 'Công bố ngay').click();
    cy.get('[role="alert"]').should('contain.text', 'Hãy kiểm tra lại').and('be.focused');

    cy.get('[role="radiogroup"][aria-label="Loại thông báo"]').should('be.visible');
    cy.get('input[type="radio"][aria-label="Cảnh báo khẩn"]').focus();
    cy.press(Cypress.Keyboard.Keys.SPACE);
    cy.get('input[type="radio"][aria-label="Cảnh báo khẩn"]').should('be.checked');
    cy.get('textarea[aria-label="Nội dung chính"]').focus().type('Hệ thống sẽ bảo trì khẩn trong ít phút.');
    cy.get('[role="radiogroup"][aria-label="Đối tượng nhận"]').should('be.visible');
    cy.get('input[type="radio"][aria-label="Giáo viên"]').focus();
    cy.press(Cypress.Keyboard.Keys.SPACE);
    cy.get('input[type="radio"][aria-label="Giáo viên"]').should('be.checked');

    cy.get('[aria-label="Bề mặt xem trước"] button').each(($button) => {
      expect($button).to.have.attr('aria-pressed');
    });
    cy.get('[aria-label="Bề mặt xem trước"] button[aria-pressed="true"]').should('have.length', 1).first().focus().should('be.focused');
    cy.get('[aria-label="Thiết bị xem trước"] button').contains('Mobile').focus().should('be.focused').click().should('have.attr', 'aria-pressed', 'true');

    cy.get('[data-testid="announcement-composer-layout"] button:visible').each(($button) => {
      expect($button[0].getBoundingClientRect().height, $button.text()).to.be.gte(44);
    });
    cy.get('[data-testid="announcement-composer-layout"] label').each(($label) => {
      if ($label.find('input[type="radio"], input[type="checkbox"]').length > 0) {
        expect($label[0].getBoundingClientRect().height, $label.text()).to.be.gte(44);
      }
    });
    cy.contains('button', 'Công bố ngay').then(($button) => {
      expect($button[0].getBoundingClientRect().height).to.be.gte(44);
    }).focus().should('be.focused').click();

    cy.contains('[role="dialog"]', 'Xác nhận cảnh báo khẩn').should('be.visible');
    assertNoSeriousA11yViolations();
    cy.contains('[role="dialog"]', 'Xác nhận cảnh báo khẩn').within(() => {
      cy.contains('button', 'Xác nhận công bố').focus().should('be.focused').click();
    });
    cy.wait('@createAnnouncement');
    cy.wait('@publishAnnouncement');
  });
});
