import { callApi } from '../../../services/apiAdapter';
import type { TeacherRecord } from '../types';

type TeacherApi = <T = any>(action: string, payload?: Record<string, any>) => Promise<T>;

interface TeacherPageResponse {
    data?: {
        items?: TeacherRecord[];
        hasMore?: boolean;
        nextCursor?: string | null;
    };
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export const loadActiveTeacherOptions = async (
    api: TeacherApi = callApi,
): Promise<TeacherRecord[]> => {
    const teachers: TeacherRecord[] = [];
    const seenUsernames = new Set<string>();
    const seenCursors = new Set<string>();
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const payload = {
            status: 'ACTIVE',
            role: 'teacher',
            limit: PAGE_SIZE,
            ...(cursor ? { cursor } : {}),
        };
        const response = await api<TeacherPageResponse>('get_teachers', payload);
        const pageData = response.data;
        const items = Array.isArray(pageData?.items) ? pageData.items : [];

        for (const teacher of items) {
            const role = String(teacher.role || '').trim().toLowerCase();
            const status = String(teacher.status || 'ACTIVE').trim().toUpperCase();
            if (role !== 'teacher' || status !== 'ACTIVE' || seenUsernames.has(teacher.username)) continue;
            seenUsernames.add(teacher.username);
            teachers.push(teacher);
        }

        if (!pageData?.hasMore) return teachers;

        const nextCursor = String(pageData.nextCursor || '').trim();
        if (!nextCursor || seenCursors.has(nextCursor)) {
            throw new Error('Teacher pagination cursor is missing or repeated.');
        }
        seenCursors.add(nextCursor);
        cursor = nextCursor;
    }

    throw new Error('Teacher pagination exceeded the maximum page limit.');
};
