describe('Low-bandwidth experience', () => {
  it('keeps the student dashboard usable without loading 3D media', () => {
    cy.intercept('GET', '**/api/account/me', {
      statusCode: 401,
      body: { status: 'error', message: 'Unauthorized' },
    });
    cy.intercept('GET', '**/api/student-profile', {
      statusCode: 200,
      body: {
        status: 'success',
        data: {
          studentId: 'student-low-bandwidth',
          fullName: 'Học sinh Mạng Yếu',
          username: 'student.low',
          classId: 'class-4a',
          className: '4A',
          coins: 10,
          pet: null,
          shopItems: [],
        },
      },
    }).as('studentProfile');

    cy.visit('/student/dashboard', {
      onBeforeLoad(win) {
        Object.defineProperty(win, 'matchMedia', {
          configurable: true,
          value: () => ({
            matches: true,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => true,
          }),
        });
        Object.defineProperty(win.navigator, 'connection', {
          configurable: true,
          value: {
            saveData: true,
            effectiveType: '3g',
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          },
        });
        Object.defineProperty(win.navigator, 'deviceMemory', {
          configurable: true,
          value: 1,
        });
        Object.defineProperty(win.navigator, 'hardwareConcurrency', {
          configurable: true,
          value: 2,
        });
        Object.defineProperty(win.navigator, 'onLine', {
          configurable: true,
          value: true,
        });
        win.localStorage.setItem('tohieuquiz_student_restore_hint', '1');
      },
    });

    cy.wait('@studentProfile');
    cy.location('pathname').should('eq', '/student/dashboard');
    cy.contains('[role="status"]', 'Chế độ tiết kiệm dữ liệu đang bật', { timeout: 20_000 })
      .should('be.visible');
    cy.get('[data-testid="student-dashboard-main-column"]').should('be.visible');
    cy.get('img[src*="/3D/"]').should('not.exist');

    cy.window().then((win) => {
      const richMediaRequests = win.performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((name) => name.includes('/3D/'));
      expect(richMediaRequests, '3D resource requests').to.deep.equal([]);
    });
  });
});
