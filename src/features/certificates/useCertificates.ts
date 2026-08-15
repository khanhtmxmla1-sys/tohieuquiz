import { useState, useEffect, useCallback } from 'react';
import type { Certificate } from './certificates.types';
import { getWorkersApiBaseUrl } from '../../services/api/config';
import type {
    CertificateApiError,
    CertificateApiSuccess,
    CertificateListPage,
    StudentCertificateItem,
} from '../../../shared/certificates.contract';

function mapCertificate(certificate: StudentCertificateItem): Certificate {
    return {
        id: certificate.id,
        batchId: certificate.batch_id,
        title: certificate.title,
        teacherName: certificate.teacher_name,
        studentScore: certificate.student_score,
        quizTitle: certificate.quiz_title,
        pngUrl: certificate.image_url,
        issuedAt: certificate.issued_at,
        renderStatus: certificate.status,
        errorMessage: null,
        isRevoked: certificate.status === 'revoked',
    };
}

export async function fetchCertificateImageBlob(imagePath: string): Promise<Blob> {
    const base = getWorkersApiBaseUrl();
    const url = imagePath.startsWith('http') ? imagePath : `${base}${imagePath}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`Không thể tải ảnh chứng nhận (${response.status})`);
    return response.blob();
}

export function useCertificates() {
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const fetchCertificates = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const base = getWorkersApiBaseUrl();
            const res = await fetch(`${base}/api/certificates/my?limit=12`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => null) as CertificateApiError | null;
                throw new Error(payload?.error?.message ?? `Lỗi tải chứng nhận: ${res.status}`);
            }

            const payload = await res.json() as CertificateApiSuccess<CertificateListPage>;
            const page = payload.data;
            setCertificates((page?.items ?? []).map(mapCertificate));
            setNextCursor(page?.meta.nextCursor ?? null);
            setHasMore(Boolean(page?.meta.hasMore));
            setTotal(page?.meta.total ?? page?.items.length ?? 0);
        } catch (e: unknown) {
            setCertificates([]);
            setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!nextCursor || isLoadingMore) return;
        setIsLoadingMore(true);
        setError(null);
        try {
            const base = getWorkersApiBaseUrl();
            const params = new URLSearchParams({ limit: '12', cursor: nextCursor });
            const res = await fetch(`${base}/api/certificates/my?${params.toString()}`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null) as CertificateApiError | null;
                throw new Error(payload?.error?.message ?? `Lỗi tải chứng nhận: ${res.status}`);
            }
            const payload = await res.json() as CertificateApiSuccess<CertificateListPage>;
            const page = payload.data;
            setCertificates((current) => [...current, ...(page?.items ?? []).map(mapCertificate)]);
            setNextCursor(page?.meta.nextCursor ?? null);
            setHasMore(Boolean(page?.meta.hasMore));
            setTotal(page?.meta.total ?? total);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, nextCursor, total]);

    useEffect(() => {
        fetchCertificates();
    }, [fetchCertificates]);

    return { certificates, isLoading, isLoadingMore, error, refetch: fetchCertificates, loadMore, hasMore, total };
}
