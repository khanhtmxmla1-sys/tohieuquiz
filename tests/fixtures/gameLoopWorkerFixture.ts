export class GameLoopStatement {
    bindings: unknown[] = [];
    constructor(readonly sql: string, private readonly db: GameLoopDatabase) {}
    bind(...values: unknown[]) { this.bindings = values; return this; }
    async first<T>() { this.db.executed.push(this); return this.db.first(this.sql) as T; }
    async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql) as T[] }; }
    async run() { this.db.executed.push(this); return { success: true }; }
}

export class GameLoopDatabase {
    executed: GameLoopStatement[] = [];
    constructor(private readonly existingActivity = false) {}
    prepare(sql: string) { return new GameLoopStatement(sql, this); }
    async batch(statements: GameLoopStatement[]) {
        this.executed.push(...statements);
        return statements.map(() => ({ success: true }));
    }

    first(sql: string) {
        if (sql.includes('FROM student_game_activity_events')) {
            return this.existingActivity ? { activity_id: 'activity-1' } : null;
        }
        if (sql.includes('FROM student_game_profiles')) return {
            username: 'student-a', daily_streak: 2, last_mission_completion_date: '',
            hint_tokens: 1, streak_shields: 0, collection_json: '[]',
            created_at: '2026-07-19T00:00:00.000Z', updated_at: '2026-07-19T00:00:00.000Z',
        };
        if (sql.includes('FROM student_daily_progress')) return {
            username: 'student-a', progress_date: '2026-07-19', questions_answered: 0,
            correct_answers: 0, quizzes_completed: 0, toan_quizzes_completed: 0,
            tieng_viet_quizzes_completed: 0, mission_questions_claimed: 0,
            mission_accuracy_claimed: 0, mission_subject_claimed: 0, chest_claimed: 0,
            created_at: '2026-07-19T00:00:00.000Z', updated_at: '2026-07-19T00:00:00.000Z',
        };
        if (sql.includes('SELECT coins') && sql.includes('FROM students')) return { coins: 120 };
        if (sql.includes('AS total_quizzes')) return { total_quizzes: 0, completed_days: 0 };
        if (sql.includes('AS math_correct')) return {
            math_correct: 0, vietnamese_correct: 0, english_correct: 0,
            speed_count: 0, perfect_count: 0, early_bird_count: 0,
            night_owl_count: 0, total_correct: 0,
        };
        return null;
    }

    all(sql: string) {
        if (!sql.includes('FROM student_weekly_progress')) return [];
        return [
            { quest_id: 'weekly_20_quizzes', progress: 2, target: 20, claimed: 0 },
            { quest_id: 'weekly_top_5', progress: 0, target: 1, claimed: 0 },
            { quest_id: 'weekly_100_correct', progress: 15, target: 100, claimed: 0 },
            { quest_id: 'weekly_subject_master', progress: 1, target: 3, claimed: 0 },
            { quest_id: 'weekly_perfect_streak', progress: 0, target: 3, claimed: 0 },
        ];
    }
}

export const gameLoopEnv = (db: GameLoopDatabase) => ({
    DB: db, JWT_SECRET: 'test-secret',
} as any);

export const gameLoopRequest = (path: string, init: RequestInit = {}) =>
    new Request(`https://test${path}`, {
        ...init,
        headers: {
            Authorization: 'Bearer test-token', 'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
