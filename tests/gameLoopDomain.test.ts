import { describe, expect, it } from 'vitest';
import {
    getCurrentDateKey,
    getCurrentWeekKey,
    getPreviousDateKey,
    getPreviousWeekKey,
    getWeekUtcRange,
} from '../workers/src/gameLoop/dateKeys';
import { normalizeGameLoopCategory } from '../workers/src/gameLoop/normalization';
import { getMissionRows } from '../workers/src/gameLoop/missionModel';
import { chooseChestReward } from '../workers/src/gameLoop/chestReward';
import { COLLECTIBLE_REWARDS } from '../workers/src/gameLoop/constants';
import type { DailyProgressRow } from '../workers/src/gameLoop/types';

const progress = (overrides: Partial<DailyProgressRow> = {}): DailyProgressRow => ({
    username: 'student-a', progress_date: '2026-07-19',
    questions_answered: 0, correct_answers: 0, quizzes_completed: 0,
    toan_quizzes_completed: 0, tieng_viet_quizzes_completed: 0,
    mission_questions_claimed: 0, mission_accuracy_claimed: 0,
    mission_subject_claimed: 0, chest_claimed: 0,
    created_at: '2026-07-19T00:00:00.000Z', updated_at: '2026-07-19T00:00:00.000Z',
    ...overrides,
});

describe('Game Loop pure domain contracts', () => {
    it('uses Hanoi calendar days and crosses year boundaries safely', () => {
        expect(getCurrentDateKey(new Date('2026-07-18T16:59:59.999Z'))).toBe('2026-07-18');
        expect(getCurrentDateKey(new Date('2026-07-18T17:00:00.000Z'))).toBe('2026-07-19');
        expect(getPreviousDateKey('2026-01-01')).toBe('2025-12-31');
    });

    it('uses Hanoi ISO weeks and exposes UTC boundaries for database queries', () => {
        const beforeMonday = new Date('2026-08-02T16:59:59.999Z');
        const mondayHanoi = new Date('2026-08-02T17:00:00.000Z');

        expect(getCurrentWeekKey(beforeMonday)).toBe('2026-W31');
        expect(getCurrentWeekKey(mondayHanoi)).toBe('2026-W32');
        expect(getPreviousWeekKey(mondayHanoi)).toBe('2026-W31');
        expect(getWeekUtcRange('2026-W32')).toEqual({
            startIso: '2026-08-02T17:00:00.000Z',
            endIsoExclusive: '2026-08-09T17:00:00.000Z',
        });
    });

    it('normalizes supported subject aliases to canonical server keys', () => {
        expect(normalizeGameLoopCategory('Toán lớp 4')).toBe('toan');
        expect(normalizeGameLoopCategory('TIẾNG VIỆT')).toBe('tieng-viet');
        expect(normalizeGameLoopCategory('English')).toBe('tieng-anh');
    });

    it('maps daily question, accuracy, and subject missions without changing thresholds', () => {
        const missions = getMissionRows(progress({
            questions_answered: 15, correct_answers: 12,
            toan_quizzes_completed: 1, mission_questions_claimed: 1,
        }));
        expect(missions.map(({ id, progress, completed, claimed }) => ({ id, progress, completed, claimed }))).toEqual([
            { id: 'daily_questions', progress: 15, completed: true, claimed: true },
            { id: 'daily_accuracy', progress: 80, completed: true, claimed: false },
            { id: 'daily_subject', progress: 1, completed: true, claimed: false },
        ]);
    });

    it.each([
        [0, 'COLLECTIBLE'], [0.6, 'COINS'], [0.85, 'HINT_TOKEN'], [0.95, 'STREAK_SHIELD'],
    ] as const)('keeps chest reward branch %s', (roll, type) => {
        expect(chooseChestReward([], () => roll).type).toBe(type);
    });

    it('falls back to coins when every collectible is already owned', () => {
        const collection = COLLECTIBLE_REWARDS.map(({ id, title, icon }) => ({ id, title, icon }));
        expect(chooseChestReward(collection, () => 0.1).type).toBe('COINS');
    });
});
