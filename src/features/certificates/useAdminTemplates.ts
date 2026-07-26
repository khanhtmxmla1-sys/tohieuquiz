import { useState, useEffect, useCallback } from 'react';
import { getWorkersApiBaseUrl } from '../../services/api/config';
import type { FieldConfig } from './certificates.types';

export interface AdminTemplate {
    id: string;
    name: string;
    bg_image_r2_key: string;
    thumbnail_r2_key: string | null;
    fields_config: string;
    is_active: number;
    is_default: number;
    canvas_width: number;
    canvas_height: number;
    created_at: string;
}

const base = () => getWorkersApiBaseUrl();

function authHeaders(): HeadersInit {
    return {
        'Content-Type': 'application/json',
    };
}

export function useAdminTemplates() {
    const [templates, setTemplates] = useState<AdminTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${base()}/api/admin/certificate-templates`, {
                headers: authHeaders(),
                credentials: 'include',
            });
            if (!res.ok) throw new Error(`Lỗi ${res.status}`);
            const json = await res.json() as { data: AdminTemplate[] };
            setTemplates(json.data ?? []);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

    const createTemplate = useCallback(async (payload: {
        name: string;
        bg_image_r2_key: string;
        fields_config?: string;
    }): Promise<{ id: string }> => {
        const res = await fetch(`${base()}/api/admin/certificate-templates`, {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        const json = await res.json() as { data?: { id: string }; error?: string };
        if (!res.ok) throw new Error(json.error ?? `Lỗi ${res.status}`);
        return json.data!;
    }, []);

    const updateTemplate = useCallback(async (
        id: string,
        patch: { name?: string; fields_config?: string; is_active?: number; is_default?: number; canvas_width?: number; canvas_height?: number }
    ): Promise<void> => {
        const res = await fetch(`${base()}/api/admin/certificate-templates/${id}`, {
            method: 'PATCH',
            headers: authHeaders(),
            credentials: 'include',
            body: JSON.stringify(patch),
        });
        if (!res.ok) {
            const json = await res.json() as { error?: string };
            throw new Error(json.error ?? `Lỗi ${res.status}`);
        }
    }, []);

    const parseFields = useCallback((raw: string): FieldConfig[] => {
        try { return JSON.parse(raw) as FieldConfig[]; }
        catch { return []; }
    }, []);

    return { templates, isLoading, error, refetch: fetchTemplates, createTemplate, updateTemplate, parseFields };
}
