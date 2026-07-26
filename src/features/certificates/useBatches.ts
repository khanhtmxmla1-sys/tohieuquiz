import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkersApiBaseUrl } from '../../services/api/config';
import type {
    CertificateApiError,
    CertificateApiSuccess,
    CertificateBatchSummary,
    CreateCertificateBatchRequest,
    CreateCertificateBatchResult,
    CertificateBatchDetail,
} from '../../../shared/certificates.contract';

export interface BatchStudent {
    student_id: string;
    student_name: string;
    student_score?: number | null;
    quiz_title?: string | null;
}

export type BatchRecord = CertificateBatchSummary;

export interface TemplateOption {
    id: string;
    name: string;
    is_active: number;
    is_default: number;
}

const base = () => getWorkersApiBaseUrl();

function authHeaders(): HeadersInit {
    return {
        'Content-Type': 'application/json',
    };
}

async function readCertificateError(res: Response): Promise<string> {
    try {
        const payload = await res.json() as Partial<CertificateApiError> & { message?: string; error?: unknown };
        if (payload.error && typeof payload.error === 'object' && 'message' in payload.error) {
            return String(payload.error.message);
        }
        if (typeof payload.error === 'string') return payload.error;
        if (payload.message) return payload.message;
    } catch {
        // Fall through to status-based message.
    }
    return `Lỗi ${res.status}`;
}

export function useBatches() {
    const [batches, setBatches] = useState<BatchRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pollAttempt = useRef(0);

    const fetchBatches = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${base()}/api/certificate-batches`, {
                headers: authHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error(await readCertificateError(res));
            const json = await res.json() as CertificateApiSuccess<BatchRecord[]>;
            setBatches(json.data ?? []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchBatches(); }, [fetchBatches]);

    useEffect(() => {
        const hasActiveBatch = batches.some((batch) => batch.status === 'pending' || batch.status === 'processing');
        if (!hasActiveBatch) {
            pollAttempt.current = 0;
            return;
        }
        const delay = Math.min(15000, 3000 * (2 ** pollAttempt.current));
        const timer = window.setTimeout(() => {
            pollAttempt.current += 1;
            fetchBatches();
        }, delay);
        return () => window.clearTimeout(timer);
    }, [batches, fetchBatches]);

    const createBatch = useCallback(async (
        payload: CreateCertificateBatchRequest,
    ): Promise<CreateCertificateBatchResult> => {
        const res = await fetch(`${base()}/api/certificate-batches`, {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readCertificateError(res));
        const json = await res.json() as CertificateApiSuccess<CreateCertificateBatchResult>;
        return json.data;
    }, []);

    const fetchBatchDetail = useCallback(async (batchId: string): Promise<CertificateBatchDetail> => {
        const res = await fetch(`${base()}/api/certificate-batches/${batchId}`, { headers: authHeaders(), credentials: 'include' });
        if (!res.ok) throw new Error(await readCertificateError(res));
        const json = await res.json() as CertificateApiSuccess<CertificateBatchDetail>;
        return json.data;
    }, []);

    const retryBatch = useCallback(async (batchId: string): Promise<void> => {
        const res = await fetch(`${base()}/api/certificate-batches/${batchId}/retry`, {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'include',
        });
        if (!res.ok) throw new Error(await readCertificateError(res));
        pollAttempt.current = 0;
        await fetchBatches();
    }, [fetchBatches]);

    return { batches, isLoading, error, refetch: fetchBatches, createBatch, fetchBatchDetail, retryBatch };
}

export async function fetchTemplateOptions(): Promise<TemplateOption[]> {
    const res = await fetch(`${base()}/api/certificates/templates`, {
        headers: authHeaders(),
        credentials: 'include',
    });
    if (!res.ok) throw new Error(await readCertificateError(res));
    const json = await res.json() as CertificateApiSuccess<TemplateOption[]>;
    return (json.data ?? []).filter((template) => template.is_active);
}
