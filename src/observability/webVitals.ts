import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

export type CoreWebVitalName = 'CLS' | 'INP' | 'LCP';
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalReport {
  kind: 'web_vital';
  name: CoreWebVitalName;
  value: number;
  rating: WebVitalRating;
  route: string;
  release: string;
  requestId: string;
  time: string;
}

export type WebVitalTransport = (
  endpoint: string,
  report: WebVitalReport,
) => boolean | void | Promise<boolean | void>;

interface BuildWebVitalOptions {
  route?: string;
  release?: string;
  requestId?: string;
  now?: () => Date;
}

interface InstallWebVitalsOptions extends BuildWebVitalOptions {
  endpoint?: string;
  sampleRate?: number;
  random?: () => number;
  transport?: WebVitalTransport;
}

const DEFAULT_ENDPOINT = '/api/client-telemetry';
const DEFAULT_SAMPLE_RATE = 0.1;
const RELEASE_LIMIT = 100;
const REQUEST_ID_LIMIT = 128;

const normalizeRoute = (route?: string): string => {
  const candidate = route
    || (typeof window !== 'undefined' ? window.location.pathname : '/');
  try {
    return new URL(candidate, 'https://route.local').pathname || '/';
  } catch {
    return '/';
  }
};

const safeText = (value: unknown, limit: number): string => (
  String(value ?? '').replace(/[\r\n\t]/g, ' ').slice(0, limit)
);

const createRequestId = (): string => {
  try {
    return globalThis.crypto?.randomUUID?.() || `vital-${Date.now()}`;
  } catch {
    return `vital-${Date.now()}`;
  }
};

const configuredRelease = (): string => (
  String(import.meta.env.VITE_APP_RELEASE || 'unknown')
);

const configuredEndpoint = (): string => (
  String(import.meta.env.VITE_WEB_VITALS_REPORT_URL || DEFAULT_ENDPOINT).trim()
  || DEFAULT_ENDPOINT
);

const configuredSampleRate = (): number => {
  const value = Number(import.meta.env.VITE_WEB_VITALS_SAMPLE_RATE ?? DEFAULT_SAMPLE_RATE);
  return Number.isFinite(value)
    ? Math.min(DEFAULT_SAMPLE_RATE, Math.max(0, value))
    : DEFAULT_SAMPLE_RATE;
};

const defaultTransport: WebVitalTransport = (endpoint, report) => {
  const body = JSON.stringify(report);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    return navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
  }
  if (typeof fetch !== 'function') return false;
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    credentials: 'same-origin',
    keepalive: true,
  }).then(() => true, () => false);
};

export const shouldSampleWebVitals = (
  sampleRate: number,
  random: () => number = Math.random,
): boolean => {
  const normalized = Number.isFinite(sampleRate)
    ? Math.min(DEFAULT_SAMPLE_RATE, Math.max(0, sampleRate))
    : DEFAULT_SAMPLE_RATE;
  return random() < normalized;
};

export const buildWebVitalReport = (
  metric: Pick<Metric, 'name' | 'value' | 'rating'>,
  options: BuildWebVitalOptions = {},
): WebVitalReport => ({
  kind: 'web_vital',
  name: metric.name as CoreWebVitalName,
  value: Number(metric.value),
  rating: metric.rating,
  route: normalizeRoute(options.route),
  release: safeText(options.release ?? configuredRelease(), RELEASE_LIMIT),
  requestId: safeText(options.requestId ?? createRequestId(), REQUEST_ID_LIMIT),
  time: (options.now?.() ?? new Date()).toISOString(),
});

export const reportWebVital = (
  metric: Pick<Metric, 'name' | 'value' | 'rating'>,
  options: InstallWebVitalsOptions = {},
): void => {
  try {
    const report = buildWebVitalReport(metric, options);
    const endpoint = options.endpoint ?? configuredEndpoint();
    const transport = options.transport ?? defaultTransport;
    void Promise.resolve(transport(endpoint, report)).catch(() => undefined);
  } catch {
    // Telemetry must never affect the application path.
  }
};

export const installWebVitalsTelemetry = (options: InstallWebVitalsOptions = {}): void => {
  if (typeof window === 'undefined') return;
  const sampleRate = options.sampleRate ?? configuredSampleRate();
  if (!shouldSampleWebVitals(sampleRate, options.random)) return;

  const reporter = (metric: Metric) => reportWebVital(metric, options);
  onCLS(reporter);
  onINP(reporter);
  onLCP(reporter);
};
