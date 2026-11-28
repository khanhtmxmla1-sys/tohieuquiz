/// <reference types="cypress" />

const LANDING_VIEWPORTS = [
  { width: 320, height: 800, label: '320x800' },
  { width: 375, height: 812, label: '375x812' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1920, height: 1080, label: '1920x1080' },
] as const;

const LANDING_HEADLINE = 'Học và kiểm tra trực tuyến, vui như một trò chơi cho học sinh tiểu học';

const installLandingBackend = () => {
  cy.intercept({ method: 'GET', pathname: '/api/**' }, {
    statusCode: 200,
    body: { status: 'success', data: [] },
  });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    cy.intercept({ method, pathname: '/api/**' }, (request) => {
      const requestPath = new URL(request.url).pathname;
      if (method !== 'POST' || requestPath !== '/api/client-telemetry') {
        throw new Error(`Unexpected backend mutation in public landing fixture: ${request.method} ${request.url}`);
      }
    });
  }
  cy.intercept('GET', '**/api/system-settings/feature-flags/resolve*', {
    statusCode: 200,
    body: {
      status: 'success',
      data: { key: 'unified_notifications_v1', enabled: false, reason: 'disabled', version: 1 },
    },
  });
  cy.intercept('GET', '**/api/announcements/current*', {
    statusCode: 200,
    body: { status: 'success', data: { items: [] } },
  });
  cy.intercept('POST', '**/api/client-telemetry', {
    statusCode: 202,
    body: { status: 'success' },
  });
};

const assertNoHorizontalOverflow = () => {
  cy.window().then((win) => {
    const documentElement = win.document.documentElement;
    expect(documentElement.scrollWidth, 'document scrollWidth').to.be.lte(documentElement.clientWidth + 1);
  });
};

const assertLandingShell = () => {
  cy.get('[data-testid="public-home-landing"]').should('be.visible');
  cy.contains('h1', LANDING_HEADLINE).should('be.visible');
  cy.get('main').should('have.length', 1);
  cy.get('footer').should('have.length', 1);
  assertNoHorizontalOverflow();
};

const assertTouchTarget = ($element: JQuery<HTMLElement>, label: string) => {
  const rect = $element[0].getBoundingClientRect();
  expect(rect.width, `${label} width`).to.be.at.least(44);
  expect(rect.height, `${label} height`).to.be.at.least(44);
};

const assertSettledHashSection = (sectionId: string) => {
  cy.get(`#${sectionId}`).should('be.visible').should(($section) => {
    const sectionElement = $section[0] as HTMLElement;
    const top = sectionElement.getBoundingClientRect().top;
    const header = sectionElement.ownerDocument
      .querySelector('[data-testid="public-home-landing"] header');
    expect(header, 'landing sticky header').not.to.be.null;
    const headerRect = (header as HTMLElement).getBoundingClientRect();
    expect(headerRect.top, 'sticky header top').to.be.closeTo(0, 1);
    expect(headerRect.bottom, 'sticky header bottom').to.be.greaterThan(0);
    expect(top, `${sectionId} is below the sticky header`).to.be.at.least(headerRect.bottom - 1);
    const viewportHeight = sectionElement.ownerDocument.defaultView?.innerHeight ?? 0;
    expect(top, `${sectionId} is inside the viewport`).to.be.lessThan(viewportHeight);
  });
};

const scrollWindowAndAwaitEvent = (target: number | 'bottom'): Cypress.Chainable<number> => {
  let observedScrollY: number | undefined;
  let removeScrollListener: (() => void) | undefined;

  return cy.window()
    .then((win) => {
      const maxScrollY = Math.max(0, win.document.documentElement.scrollHeight - win.innerHeight);
      const requestedScrollY = target === 'bottom' ? maxScrollY : target;
      const clampedTargetY = Math.min(Math.max(requestedScrollY, 0), maxScrollY);
      const recordScroll = () => {
        observedScrollY = win.scrollY;
      };
      win.addEventListener('scroll', recordScroll, { passive: true });
      removeScrollListener = () => win.removeEventListener('scroll', recordScroll);
      return target === 'bottom' ? cy.scrollTo('bottom') : cy.scrollTo(0, clampedTargetY);
    })
    .window()
    .should((win) => {
      const maxScrollY = Math.max(0, win.document.documentElement.scrollHeight - win.innerHeight);
      const requestedScrollY = target === 'bottom' ? maxScrollY : target;
      const clampedTargetY = Math.min(Math.max(requestedScrollY, 0), maxScrollY);
      expect(win.scrollY, 'current window scrollY').to.be.closeTo(clampedTargetY, 5);
      expect(observedScrollY, 'scroll event observed at target').to.be.a('number').and.closeTo(clampedTargetY, 5);
    })
    .then((win) => {
      removeScrollListener?.();
      return observedScrollY ?? win.scrollY;
    });
};

describe('Public home landing', () => {
  beforeEach(() => {
    installLandingBackend();
  });

  LANDING_VIEWPORTS.forEach(({ width, height, label }) => {
    it(`renders without horizontal overflow on ${label}`, () => {
      cy.viewport(width, height);
      cy.visit('/');
      assertLandingShell();
    });
  });

  [
    { width: 320, height: 800, label: 'mobile' },
    { width: 1440, height: 900, label: 'desktop' },
  ].forEach(({ width, height, label }) => {
    it(`keeps the hero entry CTA usable on ${label}`, () => {
      cy.viewport(width, height);
      cy.visit('/');
      assertLandingShell();

      cy.get('[data-testid="public-home-landing"] main a[href="#bat-dau"]').first()
        .should('be.visible')
        .then(($cta) => {
          const rect = $cta[0].getBoundingClientRect();
          expect(rect.top, 'hero CTA top').to.be.at.least(0);
          expect(rect.bottom, 'hero CTA bottom').to.be.at.most(height);
          assertTouchTarget($cta, 'hero CTA');
        });

      cy.get('[data-testid="public-home-landing"] img[fetchpriority="high"]')
        .first()
        .should(($hero) => {
          expect(($hero[0] as HTMLImageElement).naturalWidth, `${label} hero naturalWidth`)
            .to.be.greaterThan(0);
        });
      cy.screenshot(`public-home-landing-${label}`, { capture: 'fullPage', scale: true });
      cy.screenshot(`public-home-landing-${label}-viewport`, { capture: 'viewport', scale: true });

      cy.get('[data-testid="public-home-landing"] main a[href="#bat-dau"]').first()
        .click({ scrollBehavior: false });
      cy.location('hash').should('eq', '#bat-dau');
      cy.get('#bat-dau').should('be.visible');
      cy.get('#bat-dau a[href="/?login=student"]').should('be.visible').each(($link) => {
        assertTouchTarget($link, 'student role CTA');
      });
      cy.get('#bat-dau a[href="/?login=teacher"]').should('be.visible').each(($link) => {
        assertTouchTarget($link, 'teacher role CTA');
      });
    });
  });

  it('loads safe images with intrinsic dimensions and lazy below-fold media', () => {
    cy.viewport(1024, 768);
    cy.visit('/');
    cy.get('[data-testid="public-home-landing"] img[fetchpriority="high"]')
      .first()
      .should('exist')
      .should('not.have.attr', 'loading', 'lazy')
      .should(($hero) => {
        expect($hero.attr('width'), 'hero width attribute').to.exist;
        expect($hero.attr('height'), 'hero height attribute').to.exist;
      })
      .scrollIntoView({ duration: 0 })
      .should(($hero) => {
        expect(($hero[0] as HTMLImageElement).naturalWidth, 'eager hero naturalWidth').to.be.greaterThan(0);
      });

    cy.get('[data-testid="public-home-landing"] img').should('have.length.greaterThan', 0).each(($image) => {
      const image = $image[0] as HTMLImageElement;
      const panel = image.closest('[role="tabpanel"]');
      if (panel && (
        panel.hasAttribute('hidden')
        || getComputedStyle(panel).display === 'none'
        || getComputedStyle(panel).visibility === 'hidden'
      )) {
        return;
      }
      cy.wrap($image)
        .scrollIntoView({ duration: 0 })
        .should(($loadedImage) => {
          expect(($loadedImage[0] as HTMLImageElement).naturalWidth, `loaded image ${$loadedImage.attr('src')}`)
            .to.be.greaterThan(0);
          expect($loadedImage.attr('src') ?? '').not.to.match(/^data:/i);
          expect($loadedImage.attr('alt')).to.be.a('string');
        });
    });
    cy.get('[role="tablist"] [role="tab"]').each(($tab) => {
      const panelId = $tab.attr('aria-controls');
      if (!panelId) return;
      cy.wrap($tab).click();
      cy.get(`#${panelId}`).should('be.visible').then(($panel) => {
        const $images = $panel.find('img');
        if (!$images.length) return;
        cy.wrap($images).first()
          .scrollIntoView({ duration: 0 })
          .should(($image) => {
            expect(($image[0] as HTMLImageElement).naturalWidth, `role panel image ${panelId} naturalWidth`)
              .to.be.greaterThan(0);
            expect($image.attr('src') ?? '').not.to.match(/^data:/i);
          });
      });
    });
    cy.get('[data-testid="public-home-landing"] img[loading="lazy"]')
      .should('have.length.greaterThan', 0);
  });

  it('supports the mobile navigation and role benefit tabs from the keyboard', () => {
    cy.viewport(320, 800);
    cy.visit('/');
    assertLandingShell();

    cy.get('button[aria-controls][aria-expanded]').first().as('menuButton');
    cy.get('@menuButton').should('have.attr', 'aria-expanded', 'false').click();
    cy.get('@menuButton').should('have.attr', 'aria-expanded', 'true').type('{esc}');
    cy.get('@menuButton').should('have.attr', 'aria-expanded', 'false');

    cy.get('[role="tablist"] [role="tab"]').as('roleTabs');
    cy.get('@roleTabs').first().focus().type('{rightarrow}');
    cy.get('@roleTabs').eq(1).should('have.attr', 'aria-selected', 'true').and('have.attr', 'tabindex', '0');
    cy.get('@roleTabs').eq(1).type('{end}');
    cy.get('@roleTabs').last().should('have.attr', 'aria-selected', 'true').and('have.attr', 'tabindex', '0');
    cy.get('@roleTabs').last().type('{home}');
    cy.get('@roleTabs').first().should('have.attr', 'aria-selected', 'true').and('have.attr', 'tabindex', '0');
  });

  ['tinh-nang', 'bat-dau'].forEach((sectionId) => {
    it(`lands on #${sectionId} after the lazy page mounts`, () => {
      cy.viewport(375, 812);
      cy.visit(`/#${sectionId}`);
      cy.get('[data-testid="public-home-landing"]').should('be.visible');
      cy.get(`#${sectionId}`).should('be.visible').should(($section) => {
        const top = ($section[0] as HTMLElement).getBoundingClientRect().top;
        const header = ($section[0] as HTMLElement).ownerDocument
          .querySelector('[data-testid="public-home-landing"] header');
        expect(header, 'landing sticky header').not.to.be.null;
        const headerRect = (header as HTMLElement).getBoundingClientRect();
        expect(headerRect.top, 'sticky header top').to.be.closeTo(0, 1);
        expect(headerRect.bottom, 'sticky header bottom').to.be.greaterThan(0);
        const headerBottom = headerRect.bottom;
        expect(top, `${sectionId} is below the sticky header`).to.be.at.least(headerBottom - 1);
        expect(top, `${sectionId} is inside the viewport`).to.be.lessThan(812);
      });
      cy.window().its('scrollY').should('be.greaterThan', 0);
    });
  });

  it('keeps the saved landing offset when returning from a legal page after a hash visit', () => {
    cy.viewport(1280, 720);
    cy.visit('/#tinh-nang');
    cy.get('[data-testid="public-home-landing"]').should('be.visible');
    assertSettledHashSection('tinh-nang');
    scrollWindowAndAwaitEvent('bottom').then((offsetBeforeLeaving) => {
      cy.contains('footer a', 'Chính sách bảo mật').click({ scrollBehavior: false });
      cy.location('pathname').should('equal', '/privacy');
      cy.contains('button', 'Quay lại Trang chủ').click();
      cy.location('pathname').should('equal', '/');
      cy.window().should((win) => {
        expect(win.scrollY, 'saved landing offset after legal POP').to.be.closeTo(offsetBeforeLeaving, 100);
      });
    });
  });

  it('restores a smaller-than-anchor saved offset after legal-page SPA Back', () => {
    cy.viewport(1280, 720);
    cy.visit('/#tinh-nang');
    cy.get('[data-testid="public-home-landing"]').should('be.visible');
    assertSettledHashSection('tinh-nang');
    scrollWindowAndAwaitEvent(180).then((offsetBeforeLeaving) => {
      // Deliberately click the offscreen footer: this checks scroll-restore coordination, not footer usability.
      cy.contains('footer a', 'Chính sách bảo mật').click({ force: true, scrollBehavior: false });
      cy.location('pathname').should('equal', '/privacy');
      cy.contains('button', 'Quay lại Trang chủ').click();
      cy.location('pathname').should('equal', '/');
      cy.window().should((win) => {
        expect(win.scrollY, 'smaller saved landing offset after legal POP').to.be.closeTo(offsetBeforeLeaving, 20);
      });
    });
  });

  it('restores a zero saved offset after legal-page SPA Back from a hash visit', () => {
    cy.viewport(1280, 720);
    cy.visit('/#tinh-nang');
    cy.get('[data-testid="public-home-landing"]').should('be.visible');
    assertSettledHashSection('tinh-nang');
    scrollWindowAndAwaitEvent(0).then((offsetBeforeLeaving) => {
      // Deliberately click the offscreen footer: this checks scroll-restore coordination, not footer usability.
      cy.contains('footer a', 'Chính sách bảo mật').click({ force: true, scrollBehavior: false });
      cy.location('pathname').should('equal', '/privacy');
      cy.contains('button', 'Quay lại Trang chủ').click();
      cy.location('pathname').should('equal', '/');
      cy.window().should((win) => {
        expect(win.scrollY, 'zero saved landing offset after legal POP').to.be.closeTo(offsetBeforeLeaving, 20);
      });
    });
  });

  it('restores a larger-than-anchor saved offset after legal-page SPA Back', () => {
    cy.viewport(1280, 720);
    cy.visit('/#tinh-nang');
    cy.get('[data-testid="public-home-landing"]').should('be.visible');
    assertSettledHashSection('tinh-nang');
    cy.window().then((win) => {
      const section = win.document.getElementById('tinh-nang');
      expect(section, 'tinh-nang section').not.to.be.null;
      const anchorDocumentOffset = (section as HTMLElement).getBoundingClientRect().top + win.scrollY;
      const maxScroll = Math.max(0, win.document.documentElement.scrollHeight - win.innerHeight);
      const targetOffset = Math.min(anchorDocumentOffset + 400, maxScroll);
      expect(targetOffset, 'larger saved offset').to.be.greaterThan(anchorDocumentOffset);
      return targetOffset;
    }).then((targetOffset) => {
      scrollWindowAndAwaitEvent(targetOffset).then((offsetBeforeLeaving) => {
        // Deliberately click the offscreen footer: this checks scroll-restore coordination, not footer usability.
        cy.contains('footer a', 'Chính sách bảo mật').click({ force: true, scrollBehavior: false });
        cy.location('pathname').should('equal', '/privacy');
        cy.contains('button', 'Quay lại Trang chủ').click();
        cy.location('pathname').should('equal', '/');
        cy.window().should((win) => {
          expect(win.scrollY, 'larger saved landing offset after legal POP').to.be.closeTo(offsetBeforeLeaving, 20);
        });
      });
    });
  });

  it('opens explicit student login at the top when the bottom role CTA is selected', () => {
    cy.viewport(375, 812);
    cy.visit('/');
    cy.get('[data-testid="public-home-landing"]').should('be.visible');
    cy.get('#bat-dau a[href="/?login=student"]')
      .scrollIntoView({ offset: { top: -100, left: 0 }, duration: 0 })
      .should('be.visible');
    cy.window().its('scrollY').should('be.greaterThan', 0);
    cy.get('#bat-dau a[href="/?login=student"]').click({ scrollBehavior: false });
    cy.location('pathname').should('equal', '/');
    cy.location('search').should('equal', '?login=student');
    cy.get('#login-title', { timeout: 10000 }).should('be.visible');
    cy.window().its('scrollY').should('equal', 0);
  });
});
