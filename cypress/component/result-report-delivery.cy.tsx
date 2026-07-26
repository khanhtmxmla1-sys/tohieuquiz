import React from 'react';
import { ResultReportDeliveryWizard } from '../../src/features/results/components/result-report-delivery';
import { useAuthStore } from '../../src/stores/useAuthStore';
import type {
  ResultReportBatchDetail,
  ResultReportCohortResponse,
} from '../../shared/result-reports.contract';

const cohort: ResultReportCohortResponse = {
  class: { id: 'class-4a9', name: '4A9' },
  quiz: { id: 'quiz-1', title: 'Bài 1 – Ôn tập phép nhân' },
  attemptPolicy: 'latest',
  summary: {
    totalStudents: 3,
    completedStudents: 2,
    notCompletedStudents: 1,
    unresolvedStudents: 0,
    reportCount: 2,
  },
  ready: [
    {
      student: { id: 'student-an', fullName: 'Nguyễn Văn An', username: 'an', parentPhone: '0901' },
      result: {
        id: 'result-an', studentName: 'Nguyễn Văn An', score: 8,
        correctCount: 8, totalQuestions: 10,
        submittedAt: '2026-07-20T08:00:00.000Z', quizTitle: 'Bài 1',
      },
      attemptCount: 2,
    },
    {
      student: { id: 'student-binh', fullName: 'Trần Minh Bình', username: 'binh', parentPhone: null },
      result: {
        id: 'result-binh', studentName: 'Trần Minh Bình', score: 6,
        correctCount: 6, totalQuestions: 10,
        submittedAt: '2026-07-20T08:05:00.000Z', quizTitle: 'Bài 1',
      },
      attemptCount: 1,
    },
  ],
  notCompleted: [
    { id: 'student-chi', fullName: 'Lê Thị Chi', username: 'chi', parentPhone: '0903' },
  ],
  unresolved: [],
};

const partialDetail: ResultReportBatchDetail = {
  batch: {
    id: 'batch-1', requestId: 'request-cypress', classId: 'class-4a9', className: '4A9',
    quizId: 'quiz-1', quizTitle: 'Bài 1 – Ôn tập phép nhân', attemptPolicy: 'latest',
    notifyStudents: true, createParentLinks: true, deliveryStatus: 'partial_failed',
    createdAt: '2026-07-21T08:00:00.000Z', updatedAt: '2026-07-21T08:00:00.000Z',
    counts: { total: 2, studentSent: 1, studentViewed: 0, parentLinks: 2, parentOpened: 0, failed: 1 },
  },
  items: [
    {
      id: 'item-an', batchId: 'batch-1', resultId: 'result-an', phieuId: 'phieu-an',
      studentId: 'student-an', studentName: 'Nguyễn Văn An', parentPhone: '0901',
      notificationId: 'notification-an', publicLinkId: 'link-an', publicUrl: 'https://phieu.test/an',
      studentStatus: 'sent', parentStatus: 'link_created', attemptCount: 1,
      lastError: null, score: 8, submittedAt: '2026-07-20T08:00:00.000Z',
    },
    {
      id: 'item-binh', batchId: 'batch-1', resultId: 'result-binh', phieuId: 'phieu-binh',
      studentId: 'student-binh', studentName: 'Trần Minh Bình', parentPhone: null,
      notificationId: null, publicLinkId: 'link-binh', publicUrl: 'https://phieu.test/binh',
      studentStatus: 'failed', parentStatus: 'link_created', attemptCount: 1,
      lastError: 'Student notification: unavailable', score: 6,
      submittedAt: '2026-07-20T08:05:00.000Z',
    },
  ],
};

const completedDetail: ResultReportBatchDetail = {
  ...partialDetail,
  batch: {
    ...partialDetail.batch,
    deliveryStatus: 'completed',
    counts: { ...partialDetail.batch.counts, studentSent: 2, failed: 0 },
  },
  items: partialDetail.items.map((item) => ({
    ...item,
    studentStatus: 'sent' as const,
    lastError: null,
  })),
};

const installApi = () => {
  cy.intercept('GET', '**/api/classes*', {
    statusCode: 200,
    body: {
      status: 'success',
      data: [{
        id: 'class-4a9', name: 'Lớp 4A9', teacherUsername: 'teacher-a',
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    },
  }).as('classes');
  cy.intercept('POST', '**/api/result-reports/cohort', (request) => {
    expect(request.body).to.deep.equal({
      classId: 'class-4a9', quizId: 'quiz-1', attemptPolicy: 'latest',
    });
    request.reply({ statusCode: 200, body: { data: cohort } });
  }).as('cohort');
  cy.intercept('POST', '**/api/result-reports/batches', (request) => {
    expect(request.body.classId).to.equal('class-4a9');
    expect(request.body.quizId).to.equal('quiz-1');
    expect(request.body.drafts).to.have.length(2);
    expect(request.body.notifyStudents).to.equal(true);
    expect(request.body.createParentLinks).to.equal(true);
    request.reply({ statusCode: 201, body: { data: { batchId: 'batch-1', status: 'partial_failed' } } });
  }).as('createBatch');
  cy.intercept('GET', '**/api/result-reports/batches/batch-1', {
    statusCode: 200,
    body: { data: partialDetail },
  }).as('batchDetail');
  cy.intercept('POST', '**/api/result-reports/batches/batch-1/retry', (request) => {
    expect(request.body).to.deep.equal({ itemIds: ['item-binh'] });
    request.reply({ statusCode: 200, body: { data: completedDetail } });
  }).as('retryBatch');
};

const mountWizard = () => {
  useAuthStore.setState({
    isAuthenticated: true,
    username: 'teacher-a',
    fullName: 'Cô Khánh',
    role: 'teacher',
    teacherClass: '4A9',
  });
  cy.mount(
    <ResultReportDeliveryWizard
      isOpen
      className="4A9"
      quizId="quiz-1"
      quizTitle="Bài 1 – Ôn tập phép nhân"
      onClose={() => undefined}
      requestIdFactory={() => 'request-cypress'}
    />,
  );
};

const assertNoHorizontalOverflow = () => {
  cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.be.lte(document.documentElement.clientWidth + 1);
  });
};

describe('class result report delivery wizard', () => {
  beforeEach(() => {
    installApi();
  });

  it('completes the desktop flow and retries only the failed delivery', () => {
    cy.viewport(1440, 1000);
    mountWizard();
    cy.wait(['@classes', '@cohort']);

    cy.get('[role="dialog"][aria-label="Tạo và gửi phiếu kết quả"]').should('be.visible');
    cy.contains('Lê Thị Chi — chưa làm bài').should('be.visible');
    assertNoHorizontalOverflow();

    cy.contains('button', /^Tiếp tục$/).click();
    cy.contains('Sẽ gửi 2 phiếu').should('be.visible');
    cy.get('input[placeholder="Tìm học sinh trong danh sách..."]').type('Bình');
    cy.get('[data-testid="result-report-student-list"]').within(() => {
      cy.contains('Trần Minh Bình').should('be.visible');
      cy.contains('Nguyễn Văn An').should('not.exist');
    });
    cy.contains('Sẽ gửi 2 phiếu').should('be.visible');

    cy.contains('button', 'Tiếp tục chọn cách gửi').click();
    cy.get('input[aria-label="Gửi vào tài khoản học sinh"]').should('be.checked');
    cy.get('input[aria-label="Tạo link riêng cho phụ huynh"]').should('be.checked');
    cy.contains('Lớp 4A9').should('be.visible');
    cy.contains('Bài 1 – Ôn tập phép nhân').should('be.visible');

    cy.contains('button', 'Gửi 2 phiếu kết quả').click();
    cy.wait(['@createBatch', '@batchDetail']);
    cy.contains('Có 1 phiếu cần thử lại').should('be.visible');
    cy.contains('button', 'Thử gửi lại 1 phiếu').click();
    cy.wait('@retryBatch');
    cy.contains('Đã gửi đủ 2 phiếu').should('be.visible');
    assertNoHorizontalOverflow();
  });

  it('keeps mobile cards and sticky actions inside a 390px viewport', () => {
    cy.viewport(390, 844);
    mountWizard();
    cy.wait(['@classes', '@cohort']);
    assertNoHorizontalOverflow();

    cy.contains('button', /^Tiếp tục$/).should('have.css', 'min-height', '44px').click();
    cy.get('[data-testid="result-report-student-list"]').should('be.visible');
    cy.get('[data-testid="result-report-review-actions"]').should('have.css', 'position', 'sticky');
    assertNoHorizontalOverflow();

    cy.contains('button', 'Tiếp tục chọn cách gửi').click();
    cy.contains('button', 'Gửi 2 phiếu kết quả')
      .should('have.css', 'min-height', '44px')
      .should('be.visible');
    assertNoHorizontalOverflow();
  });
});
