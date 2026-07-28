describe('Offline state shell', () => {
  it('announces offline mode and removes the banner after reconnecting', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        Object.defineProperty(win.navigator, 'onLine', {
          configurable: true,
          value: false,
        });
      },
    });

    cy.contains('[role="status"]', 'Bạn đang ngoại tuyến', { timeout: 15_000 })
      .should('be.visible')
      .and('have.attr', 'aria-live', 'polite');

    cy.window().then((win) => {
      Object.defineProperty(win.navigator, 'onLine', {
        configurable: true,
        value: true,
      });
      win.dispatchEvent(new Event('online'));
    });

    cy.contains('[role="status"]', 'Bạn đang ngoại tuyến').should('not.exist');
  });
});
