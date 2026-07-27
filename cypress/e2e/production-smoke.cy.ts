/// <reference types="cypress" />

const expectHealthyHtml = (response: Cypress.Response<string>) => {
  expect(response.status).to.eq(200);
  expect(response.body).to.include('<title>TôHiệuQuiz');
  expect(response.body).to.include('id="root"');
};

describe('Production read-only smoke', () => {
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

  it('serves security headers and at least one immutable application asset', () => {
    cy.request('/').then(response => {
      expectHealthyHtml(response);
      expect(response.headers['strict-transport-security']).to.exist;
      expect(response.headers['x-content-type-options']).to.eq('nosniff');
      expect(response.headers['content-security-policy']).to.include("default-src 'self'");

      const scriptMatch = response.body.match(/<script[^>]+src="([^"]*\/assets\/[^"]+\.js)"/i);
      expect(scriptMatch, 'application script asset').not.to.be.null;
      cy.request(scriptMatch![1]).then(asset => {
        expect(asset.status).to.eq(200);
        expect(String(asset.headers['content-type'] || '')).to.include('javascript');
        expect(String(asset.headers['cache-control'] || '')).to.include('immutable');
      });
    });
  });

  it('keeps the same-origin API rewrite and direct Worker health endpoint healthy', () => {
    cy.request('/api/health').then(response => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('ok');
    });

    cy.env(['apiBaseUrl']).then(({ apiBaseUrl: rawApiBaseUrl }) => {
      const apiBaseUrl = String(rawApiBaseUrl || '').replace(/\/+$/, '');
      expect(apiBaseUrl, 'apiBaseUrl').to.match(/^https:\/\//);
      cy.request({
        url: `${apiBaseUrl}/api/health`,
        headers: { Origin: Cypress.config('baseUrl') },
      }).then(response => {
        expect(response.status).to.eq(200);
        expect(response.body.status).to.eq('ok');
        expect(response.headers['access-control-allow-origin']).to.eq(Cypress.config('baseUrl'));
      });
    });
  });

  it('serves the parent portal login shell without requiring a real account', () => {
    cy.env(['parentBaseUrl']).then(({ parentBaseUrl: rawParentBaseUrl }) => {
      const parentBaseUrl = String(rawParentBaseUrl || '').replace(/\/+$/, '');
      expect(parentBaseUrl, 'parentBaseUrl').to.match(/^https:\/\//);
      cy.request(`${parentBaseUrl}/login`).then(expectHealthyHtml);
    });
  });
});
