/// <reference types="cypress" />

const expectHealthyHtml = (response: Cypress.Response<string>) => {
  expect(response.status).to.eq(200);
  expect(response.body).to.include('<title>TôHiệuQuiz');
  expect(response.body).to.include('id="root"');
};

describe('Production public browser smoke', () => {
  it('loads the public application without uncaught JavaScript failures', () => {
    const browserErrors: string[] = [];
    cy.visit('/', {
      onBeforeLoad(win) {
        win.addEventListener('error', event => browserErrors.push(event.message));
        win.addEventListener('unhandledrejection', event => browserErrors.push(String(event.reason)));
      },
    });
    cy.title().should('contain', 'TôHiệuQuiz');
    cy.get('#root').should('not.be.empty');
    cy.contains('TôHiệuQuiz').should('be.visible');
    cy.then(() => expect(browserErrors, 'browser errors').to.deep.equal([]));
  });

  it('serves an immutable application asset without exposing authenticated state', () => {
    cy.request('/').then(response => {
      expectHealthyHtml(response);
      const scriptMatch = response.body.match(/<script[^>]+src="([^"]*\/assets\/[^"]+\.js)"/i);
      expect(scriptMatch, 'application script asset').not.to.be.null;
      cy.request(scriptMatch![1]).then(asset => {
        expect(asset.status).to.eq(200);
        expect(String(asset.headers['content-type'] || '')).to.include('javascript');
        expect(String(asset.headers['cache-control'] || '')).to.include('immutable');
      });
    });
  });

  it('loads the apex and parent public shells without credentials', () => {
    cy.env(['apexBaseUrl', 'parentBaseUrl']).then(({ apexBaseUrl, parentBaseUrl }) => {
      cy.request({ url: `${String(apexBaseUrl).replace(/\/+$/, '')}/`, followRedirect: true })
        .then(expectHealthyHtml);
      cy.request(`${String(parentBaseUrl).replace(/\/+$/, '')}/login`).then(expectHealthyHtml);
    });
  });
});
