describe('teacher cookie session', () => {
  it('does not trust forged localStorage authentication', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('auth-storage', JSON.stringify({ state: { isLoggedIn: true, isAdmin: true, username: 'forged' } }));
      },
    });
    cy.location('pathname').should('not.match', /\/admin(?:\/|$)/);
  });
});
