import { getWorkersApiBaseUrl } from '../../services/api/config';
import { buildAuthHeaders } from '../../services/api/auth';
import type {
    MathAuditIssue,
    MathAuditSummary,
    MathRenderEvent,
} from './mathAudit.types';

const requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${getWorkersApiBaseUrl()}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...buildAuthHeaders('session', path),
            ...init.headers,
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
    }
    return payload as T;
};

export const mathAuditService = {
    async listIssues(limit = 500): Promise<{ data: MathAuditIssue[]; summary: MathAuditSummary }> {
        return requestJson(`/api/admin/math-audit/issues?limit=${limit}`);
    },


    async listTelemetry(days = 7): Promise<{
        data: MathRenderEvent[];
        summary: { events: number; occurrences: number; days: number };
    }> {
        return requestJson(`/api/admin/math-telemetry?days=${days}`);
    },
};
