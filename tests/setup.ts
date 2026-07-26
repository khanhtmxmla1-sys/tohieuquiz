import '@testing-library/jest-dom';

// useScrollReset scrolls on every route change, and jsdom's window.scrollTo does nothing except
// log "Not implemented" to the virtual console. Stub it so that noise stays out of every suite
// that happens to render a route; tests that care spy on this function directly.
// Guarded because the *.worker.test.ts suites share this setup file but run without a DOM.
if (typeof window !== 'undefined') window.scrollTo = () => {};
