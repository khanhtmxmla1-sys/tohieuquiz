export type LiveExamPreflightCheckId = 'online' | 'cookies' | 'viewport' | 'api-health' | 'clock';

export interface LiveExamPreflightCheck {
  id: LiveExamPreflightCheckId;
  ok: boolean;
  message: string;
}

export interface LiveExamPreflightResult {
  ready: boolean;
  checks: LiveExamPreflightCheck[];
  clockDriftMs: number | null;
  checkedAt: string;
}

export interface LiveExamPreflightOptions {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  online?: boolean;
  cookieEnabled?: boolean;
  viewport?: { width: number; height: number };
  timeoutMs?: number;
  maxClockDriftMs?: number;
  minimumViewport?: { width: number; height: number };
}

const healthUrl = (baseUrl: string): string => `${baseUrl.replace(/\/$/, '')}/api/health`;

export const runLiveExamPreflight = async (
  options: LiveExamPreflightOptions,
): Promise<LiveExamPreflightResult> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const online = options.online ?? (typeof navigator === 'undefined' || navigator.onLine !== false);
  const cookieEnabled = options.cookieEnabled ?? (typeof navigator === 'undefined' || navigator.cookieEnabled !== false);
  const viewport = options.viewport ?? {
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  };
  const minimumViewport = options.minimumViewport ?? { width: 320, height: 480 };
  const maxClockDriftMs = options.maxClockDriftMs ?? 30_000;
  const timeoutMs = Math.max(1, options.timeoutMs ?? 5_000);
  const checks: LiveExamPreflightCheck[] = [
    {
      id: 'online',
      ok: online,
      message: online ? 'Đã kết nối mạng.' : 'Thiết bị đang ngoại tuyến.',
    },
    {
      id: 'cookies',
      ok: cookieEnabled,
      message: cookieEnabled ? 'Cookie đăng nhập khả dụng.' : 'Trình duyệt đang chặn cookie.',
    },
    {
      id: 'viewport',
      ok: viewport.width >= minimumViewport.width && viewport.height >= minimumViewport.height,
      message: viewport.width >= minimumViewport.width && viewport.height >= minimumViewport.height
        ? 'Kích thước màn hình phù hợp.'
        : 'Cửa sổ quá nhỏ để làm bài an toàn.',
    },
  ];

  let clockDriftMs: number | null = null;
  if (!online) {
    checks.push(
      { id: 'api-health', ok: false, message: 'Chưa thể kiểm tra máy chủ khi ngoại tuyến.' },
      { id: 'clock', ok: false, message: 'Chưa thể đối chiếu đồng hồ với máy chủ.' },
    );
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(healthUrl(options.apiBaseUrl), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { status?: unknown; timestamp?: unknown };
      const serverTime = typeof payload.timestamp === 'string' ? Date.parse(payload.timestamp) : Number.NaN;
      const healthOk = payload.status === 'ok' && Number.isFinite(serverTime);
      checks.push({
        id: 'api-health',
        ok: healthOk,
        message: healthOk ? 'Máy chủ Live Exam sẵn sàng.' : 'Máy chủ trả về trạng thái không hợp lệ.',
      });
      clockDriftMs = healthOk ? Math.abs(serverTime - now()) : null;
      checks.push({
        id: 'clock',
        ok: clockDriftMs !== null && clockDriftMs <= maxClockDriftMs,
        message: clockDriftMs !== null && clockDriftMs <= maxClockDriftMs
          ? 'Đồng hồ thiết bị đã đồng bộ.'
          : 'Đồng hồ thiết bị lệch quá nhiều so với máy chủ.',
      });
    } catch {
      checks.push(
        { id: 'api-health', ok: false, message: 'Không thể kết nối máy chủ Live Exam.' },
        { id: 'clock', ok: false, message: 'Chưa thể đối chiếu đồng hồ với máy chủ.' },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ready: checks.every((check) => check.ok),
    checks,
    clockDriftMs,
    checkedAt: new Date(now()).toISOString(),
  };
};
