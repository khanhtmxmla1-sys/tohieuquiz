/// <reference types="cypress" />

const adminStorage = JSON.stringify({
  state: {
    isLoggedIn: true,
    username: 'admin.media',
    teacherName: 'Media Admin',
    isAdmin: true,
    teacherClass: '',
  },
  version: 0,
});

const settings = {
  id: 'default', displayMode: 'CONTENT', autoplay: true, intervalMs: 5000,
  transition: 'FADE', showDots: true, showArrows: true, pauseOnHover: true,
  version: 3, updatedAt: '2026-08-13T00:00:00.000Z', updatedBy: 'admin.media',
};

const slide = {
  id: 'slide-1',
  cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/slide-1',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/slide-1.webp',
  imageWidth: 1200, imageHeight: 520, altText: 'Banner hiện tại', internalTitle: 'Banner hiện tại',
  linkUrl: null, openNewTab: false, sortOrder: 10, enabled: true, startsAt: null, endsAt: null,
  createdAt: '2026-08-13T00:00:00.000Z', createdBy: 'admin.media',
  updatedAt: '2026-08-13T00:00:00.000Z', updatedBy: 'admin.media',
};

const installBackend = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  cy.intercept('GET', '**/api/account/me', {
    statusCode: 200,
    body: { status: 'success', data: { username: 'admin.media', fullName: 'Media Admin', role: 'admin', classes: [], mustChangePassword: false } },
  }).as('account');
  cy.intercept('GET', '**/api/announcements/current*', {
    statusCode: 200,
    body: { status: 'success', data: { items: [] } },
  });
  cy.intercept('GET', '**/api/admin/login-media', {
    statusCode: 200,
    body: { status: 'success', data: { settings, slides: [slide] } },
  }).as('loginMediaState');
  cy.intercept('PATCH', '**/api/admin/login-media/settings', (request) => {
    expect(request.body).to.include({ expectedVersion: 3, displayMode: 'SLIDER', intervalMs: 7000, reason: 'Bật chiến dịch tháng 8' });
    request.reply({ statusCode: 200, body: { status: 'success', data: { ...settings, displayMode: 'SLIDER', intervalMs: 7000, version: 4 } } });
  }).as('saveSettings');
  cy.intercept('POST', '**/api/admin/login-media/upload-signature', {
    statusCode: 200,
    body: { status: 'success', data: {
      cloudName: 'demo', apiKey: '12345', timestamp: 1786581750, signature: 'signed',
      publicId: 'tohieuquiz/login-media/2026/08/uploaded', assetFolder: 'tohieuquiz/login-media/2026/08',
      allowedFormats: 'jpg,jpeg,png,webp', uploadPreset: 'tohieuquiz_login_media_signed', overwrite: 'false',
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
    } },
  }).as('signature');
  cy.intercept('POST', 'https://api.cloudinary.com/v1_1/demo/image/upload', {
    statusCode: 200,
    body: {
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/uploaded.webp',
      public_id: 'tohieuquiz/login-media/2026/08/uploaded', width: 1200, height: 520,
    },
  }).as('cloudinaryUpload');
  cy.intercept('POST', '**/api/admin/login-media/slides', (request) => {
    expect(request.body).to.include({
      cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/uploaded',
      internalTitle: 'Banner mới E2E',
      altText: 'Banner ôn tập tháng 8',
      enabled: false,
    });
    request.reply({ statusCode: 201, body: { status: 'success', data: { ...slide, id: 'slide-2', ...request.body, updatedAt: '2026-08-13T01:00:00.000Z' } } });
  }).as('createSlide');
};

const visitPage = () => {
  cy.visit('/teacher/login-media', {
    onBeforeLoad(win) {
      win.localStorage.setItem('auth-storage', adminStorage);
    },
  });
  cy.wait('@account');
  // Intentionally wait for only the first state read: a duplicate StrictMode read must not clobber edits.
  cy.wait('@loginMediaState');
  cy.contains('h2', 'Banner đăng nhập', { timeout: 20_000 }).should('be.visible');
};

describe('Login Media admin UX', () => {
  beforeEach(() => installBackend());

  it('saves slider settings through the canonical admin route', () => {
    visitPage();
    cy.get('input[aria-label="Trình chiếu ảnh"]').click().should('be.checked');
    cy.get('input[aria-label="Thời gian mỗi ảnh (giây)"]').clear().type('7');
    cy.get('input[aria-label="Lý do thay đổi"]').type('Bật chiến dịch tháng 8');
    cy.contains('button', 'Lưu cài đặt').click();
    cy.wait('@saveSettings');
  });

  it('uploads to Cloudinary and persists only returned metadata', () => {
    visitPage();
    cy.contains('button', 'Thêm banner').click();
    cy.get('input[aria-label="Chọn ảnh banner"]').selectFile({
      contents: Cypress.Buffer.from('fake-webp-content'),
      fileName: 'banner.webp',
      mimeType: 'image/webp',
    });
    cy.wait('@signature');
    cy.wait('@cloudinaryUpload');
    cy.get('input[aria-label="Tên nội bộ"]').type('Banner mới E2E');
    cy.get('input[aria-label="Mô tả ảnh"]').type('Banner ôn tập tháng 8');
    cy.contains('button', 'Lưu banner').click();
    cy.wait('@createSlide');
  });

  it('does not create horizontal overflow on a narrow admin viewport', () => {
    cy.viewport(390, 844);
    visitPage();
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.lte(document.documentElement.clientWidth + 1);
    });
  });
});
