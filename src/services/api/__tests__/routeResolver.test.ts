import { describe, it, expect } from 'vitest';
import { resolveApiRoute } from '../routeResolver';

describe('resolveApiRoute', () => {
    it('resolves login route', () => {
        const r = resolveApiRoute('login');
        expect(r.method).toBe('POST');
        expect(r.path({})).toBe('/api/login');
        expect(r.auth).toBe('public');
    });

    it('resolves get_questions route with query', () => {
        const r = resolveApiRoute('get_questions');
        expect(r.method).toBe('GET');
        expect(r.path({})).toBe('/api/questions');
        expect(r.query?.({ quizId: 'a b' })?.toString()).toBe('quizId=a+b');
    });

    it('resolves result dashboard summary as a protected GET', () => {
        const route = resolveApiRoute('get_results_summary');
        expect(route).toMatchObject({ method: 'GET', auth: 'session' });
        expect(route.path({})).toBe('/api/results/summary');
    });
    it('resolves delete_quiz without body', () => {
        const r = resolveApiRoute('delete_quiz');
        expect(r.method).toBe('DELETE');
        expect(r.body).toBeUndefined();
    });

    it('resolves update_quiz as PUT', () => {
        const r = resolveApiRoute('update_quiz');
        expect(r.method).toBe('PUT');
        expect(r.path({ id: '123' })).toBe('/api/quizzes/123');
        expect(r.path({ quizId: '456' })).toBe('/api/quizzes/456');
    });

    it('resolves start_assignment_attempt as POST', () => {
        const r = resolveApiRoute('start_assignment_attempt');
        expect(r.method).toBe('POST');
        expect(r.path({ assignmentId: '789' })).toBe('/api/assignments/789/start');
        expect(r.auth).toBe('session');
    });

    it('uses soft archive routes for classes', () => {
        const archive = resolveApiRoute('delete_class');
        expect(archive.method).toBe('PATCH');
        expect(archive.path({ classId: 'lop 5A' })).toBe('/api/classes/lop%205A/archive');
        expect(archive.body?.('delete_class', { classId: 'c1' })).toMatchObject({ archived: true });

        const restore = resolveApiRoute('restore_class');
        expect(restore.method).toBe('PATCH');
        expect(restore.body?.('restore_class', { classId: 'c1' })).toMatchObject({ archived: false });
    });

    it('supports requesting archived classes only when explicitly enabled', () => {
        const route = resolveApiRoute('get_classes');
        expect(route.query?.({})?.toString()).toBe('');
        expect(route.query?.({ includeArchived: true })?.toString()).toBe('includeArchived=true');
    });

    it('resolves get_game_loop_dashboard as GET session', () => {
        const r = resolveApiRoute('get_game_loop_dashboard');
        expect(r.method).toBe('GET');
        expect(r.path({})).toBe('/api/game-loop/dashboard');
        expect(r.auth).toBe('session');
    });

    it('resolves get_gift_shop_orders query params', () => {
        const r = resolveApiRoute('get_gift_shop_orders');
        const qs = r.query?.({ studentId: 's1', classId: 'c1', actorIsAdmin: true })?.toString();
        expect(qs).toContain('studentId=s1');
        expect(qs).toContain('classId=c1');
        expect(qs).toContain('actorIsAdmin=true');
    });

    it('resolves phieu actions to canonical REST routes', () => {
        const upsert = resolveApiRoute('upsert_phieu');
        expect(upsert.method).toBe('POST');
        expect(upsert.path({})).toBe('/api/phieu');
        expect(upsert.body).toBeUndefined();

        const bySubmission = resolveApiRoute('get_phieu_by_submission');
        expect(bySubmission.method).toBe('GET');
        expect(bySubmission.path({ submissionId: 'sub 1' })).toBe('/api/phieu/submissions/sub%201');

        const resultPhieu = resolveApiRoute('get_result_phieu');
        expect(resultPhieu.method).toBe('GET');
        expect(resultPhieu.path({ resultId: 'result 1' })).toBe('/api/phieu/results/result%201');

        const upsertResult = resolveApiRoute('upsert_result_phieu');
        expect(upsertResult.method).toBe('POST');
        expect(upsertResult.path({ resultId: 'result 1' })).toBe('/api/phieu/results/result%201');
        expect(upsertResult.body?.('upsert_result_phieu', { resultId: 'r1', nhan_xet: 'TÃ¡Â»â€˜t' }))
            .toEqual({ nhan_xet: 'TÃ¡Â»â€˜t' });

        expect(resolveApiRoute('publish_phieu_batch').path({})).toBe('/api/phieu/batches');
        expect(resolveApiRoute('deactivate_public_phieu_link').path({ publicToken: 'tok 1' }))
            .toBe('/api/phieu/public-links/tok%201/deactivate');
    });

    it('resolves get_public_phieu as public', () => {
        const r = resolveApiRoute('get_public_phieu');
        expect(r.auth).toBe('public');
        expect(r.path({ publicToken: 'tok 1' })).toBe('/api/phieu/public/tok%201');
    });

    it('resolves ai_chat as session', () => {
        const r = resolveApiRoute('ai_chat');
        expect(r.auth).toBe('session');
    });

    it('resolves AI quota routes with JWT session policy', () => {
        const getQuota = resolveApiRoute('get_teacher_ai_quota');
        const consumeQuota = resolveApiRoute('consume_teacher_ai_quota');
        expect(getQuota).toMatchObject({ method: 'GET', auth: 'session' });
        expect(getQuota.path({})).toBe('/api/teacher-ai-quota');
        expect(consumeQuota).toMatchObject({ method: 'POST', auth: 'session' });
        expect(consumeQuota.path({})).toBe('/api/teacher-ai-quota/consume');
    });

    it('resolves get_announcement with the public policy', () => {
        const r = resolveApiRoute('get_announcement');
        expect(r.auth).toBe('public');
    });

    it('resolves the admin-only bulk teacher password reset route', () => {
        const r = resolveApiRoute('reset_all_teacher_passwords');
        expect(r.method).toBe('POST');
        expect(r.auth).toBe('session');
        expect(r.path({})).toBe('/api/admin/teachers/reset-passwords');
    });


    it('throws on unknown action', () => {
        expect(() => resolveApiRoute('does_not_exist')).toThrow(
            'Unknown API action: does_not_exist',
        );
    });
});
