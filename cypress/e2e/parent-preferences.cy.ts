/// <reference types="cypress" />

const student = { id: 'student-an', fullName: 'Nguyễn Văn An', className: '4A9', avatar: '' };
const basePreferences = {
  email: 'parent@example.com',
  emailVerifiedAt: null,
  weeklyDigestEnabled: false,
  digestWeekday: 1,
  digestHour: 19,
  timezone: 'Asia/Ho_Chi_Minh',
  quietHoursEnabled: true,
  quietHoursStart: '21:00',
  quietHoursEnd: '07:00',
  emailKinds: ['quiz_result', 'homework_due'],
  emailRolloutReady: true,
  updatedAt: '2026-07-29T08:00:00.000Z',
};

const installAuthenticatedParent = () => {
  cy.intercept('GET', '**/api/parent/session', {
    statusCode: 200,
    body: { data: { student, accessCodeMasked: '••••••G234' } },
  }).as('parentSession');
  cy.intercept('GET', '**/api/parent/preferences', {
    statusCode: 200,
    body: { data: basePreferences },
  }).as('preferences');
  cy.intercept('PUT', '**/api/parent/preferences', req => {
    expect(req.body).to.deep.include({
      email: 'new.parent@example.com',
      weeklyDigestEnabled: true,
      digestWeekday: 5,
      digestHour: 18,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
    });
    expect(req.body.emailKinds).to.include('class_announcement');
    req.reply({
      statusCode: 200,
      body: { data: { ...basePreferences, ...req.body, emailVerifiedAt: null } },
    });
  }).as('savePreferences');
  cy.intercept('POST', '**/api/parent/preferences/email/request-verification', {
    statusCode: 202,
    body: { data: { requested: true } },
  }).as('requestVerification');
};

const installAnonymousParent = () => {
  cy.intercept('GET', '**/api/parent/session', {
    statusCode: 401,
    body: { error: { code: 'PARENT_SESSION_INVALID', message: 'Phiên đăng nhập không hợp lệ.' } },
  }).as('anonymousSession');
  cy.intercept('POST', '**/api/parent/recovery/request', req => {
    expect(req.body).to.deep.equal({ accessCode: 'ABCDEFG234', email: 'parent@example.com' });
    req.reply({ statusCode: 202, body: { data: { requested: true } } });
  }).as('recoveryRequest');
  cy.intercept('POST', '**/api/parent/recovery/confirm', req => {
    expect(req.body).to.deep.equal({ token: 'recovery-token', pin: '654321' });
    req.reply({ statusCode: 200, body: { data: { reset: true } } });
  }).as('recoveryConfirm');
  cy.intercept('POST', '**/api/parent/preferences/email/verify', req => {
    expect(req.body).to.deep.equal({ token: 'verify-token' });
    req.reply({ statusCode: 200, body: { data: { verified: true } } });
  }).as('emailVerify');
};

describe('Parent preferences and account recovery', () => {
  it('saves digest categories, schedule and quiet hours then requests email verification', () => {
    installAuthenticatedParent();
    cy.visit('/profile?portal=parent');
    cy.wait('@parentSession');
    cy.wait('@preferences');

    cy.findByLabelText?.('Email phụ huynh');
    cy.get('input[type="email"]').clear().type('new.parent@example.com');
    cy.contains('Nhận bản tin học tập hằng tuần').click();
    cy.contains('label', 'Ngày gửi').find('select').select('5');
    cy.contains('label', 'Giờ gửi').find('select').select('18');
    cy.contains('label', 'Thông báo lớp').click();
    cy.contains('button', 'Lưu cài đặt').click();
    cy.wait('@savePreferences');
    cy.contains('Đã lưu cài đặt liên lạc.').should('be.visible');

    cy.contains('button', 'Gửi xác minh').click();
    cy.wait('@requestVerification');
    cy.contains('Đã gửi liên kết xác minh').should('be.visible');
  });

  it('uses generic recovery messaging, consumes reset/verification tokens and removes them from the URL', () => {
    installAnonymousParent();
    cy.visit('/login?portal=parent');
    cy.wait('@anonymousSession');
    cy.contains('a', 'Quên PIN?').click();
    cy.get('input[autocomplete="username"]').type('ABCDEFG234');
    cy.get('input[type="email"]').type('parent@example.com');
    cy.contains('button', 'Gửi liên kết đặt lại PIN').click();
    cy.wait('@recoveryRequest');
    cy.contains('Nếu thông tin khớp').should('be.visible');

    cy.visit('/recover/confirm?token=recovery-token&portal=parent');
    cy.get('input[type="password"]').eq(0).type('654321');
    cy.get('input[type="password"]').eq(1).type('654321');
    cy.contains('button', 'Cập nhật PIN').click();
    cy.wait('@recoveryConfirm');
    cy.contains('PIN đã được cập nhật').should('be.visible');
    cy.location('search').should('eq', '');

    cy.visit('/verify-email?token=verify-token&portal=parent');
    cy.contains('button', 'Xác minh email').click();
    cy.wait('@emailVerify');
    cy.contains('Email đã được xác minh').should('be.visible');
    cy.location('search').should('eq', '');
  });
});
