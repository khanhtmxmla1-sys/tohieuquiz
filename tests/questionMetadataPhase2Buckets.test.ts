import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildPhase2ReviewRow } = require('../workers/scripts/question-metadata-phase2-review-utils.cjs');

describe('buildPhase2ReviewRow', () => {
    it('flags trang_nguyen bucket for manual sampling instead of auto-map', () => {
        const reviewRow = buildPhase2ReviewRow({
            id: 'q-1',
            question: 'Doc doan tho va cho biet khung canh thien nhien duoc ta o dau.',
            tags: '#tieng_viet,#trang_nguyen',
            subject: '',
            skill_code: '',
            subskill_code: '',
            difficulty: null,
        });

        expect(reviewRow).toMatchObject({
            id: 'q-1',
            tag_signature: '#tieng_viet,#trang_nguyen',
            inferred_subject: 'vietnamese',
            inferred_skill_code: '',
            review_category: 'mixed-signal-source-tag',
            review_action: 'sample_and_classify',
        });
    });

    it('flags gia_dinh bucket as theme-only review candidate', () => {
        const reviewRow = buildPhase2ReviewRow({
            id: 'q-2',
            question: 'Tu nao duoi day chi nguoi than trong gia dinh?',
            tags: '#gia_dinh,#tieng_viet',
            subject: '',
            skill_code: '',
            subskill_code: '',
            difficulty: null,
        });

        expect(reviewRow).toMatchObject({
            tag_signature: '#gia_dinh,#tieng_viet',
            inferred_subject: 'vietnamese',
            review_category: 'theme-tag',
            review_action: 'theme_then_skill_review',
        });
    });

    it('drops rows that are already preview-safe for phase 1', () => {
        const reviewRow = buildPhase2ReviewRow({
            id: 'q-3',
            question: 'Rut gon phan so 6/8.',
            tags: '#toan,#phan_so,#rut_gon_phan_so',
            subject: '',
            skill_code: '',
            subskill_code: '',
            difficulty: null,
        });

        expect(reviewRow).toBeNull();
    });
});
