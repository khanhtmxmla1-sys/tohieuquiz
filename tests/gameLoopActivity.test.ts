import { describe, expect, it } from 'vitest';
import { recordQuizActivity } from '../workers/src/gameLoop/activityService';
import { GameLoopDatabase } from './fixtures/gameLoopWorkerFixture';

const input = {
    activityId: 'activity-1',
    quizId: 'quiz-1',
    category: 'toan',
    totalQuestions: 10,
    correctCount: 8,
};

describe('Game Loop activity persistence', () => {
    it('binds the authenticated username and normalized activity payload', async () => {
        const db = new GameLoopDatabase();
        await recordQuizActivity(db as any, 'student-from-jwt', input);

        const insert = db.executed.find(({ sql }) =>
            sql.includes('INSERT INTO student_game_activity_events'));
        expect(insert?.bindings[1]).toBe('student-from-jwt');
        expect(JSON.parse(String(insert?.bindings[3]))).toEqual({
            quizId: 'quiz-1', category: 'toan', correctCount: 8, totalQuestions: 10,
        });
        expect(db.executed.some(({ sql }) =>
            sql.includes('UPDATE student_weekly_progress'))).toBe(true);
    });

    it('does not write progress again when the activity ID already exists', async () => {
        const db = new GameLoopDatabase(true);
        await recordQuizActivity(db as any, 'student-from-jwt', input);

        expect(db.executed.some(({ sql }) =>
            sql.includes('INSERT INTO student_game_activity_events'))).toBe(false);
        expect(db.executed.some(({ sql }) =>
            sql.includes('UPDATE student_daily_progress'))).toBe(false);
    });
});
