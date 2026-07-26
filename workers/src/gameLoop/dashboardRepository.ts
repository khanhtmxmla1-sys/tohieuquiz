export const getStudentCoins = async (db: D1Database, username: string): Promise<number> => {
    const student = await db.prepare(`
        SELECT coins
        FROM students
        WHERE username = ?
        LIMIT 1
    `).bind(username).first<{ coins: number }>();

    return Number(student?.coins) || 0;
};

export const getWeeklySummary = async (db: D1Database, username: string): Promise<{ completedDays: number; targetDays: number }> => {
    const rows = await db.prepare(`
        SELECT progress_date
        FROM student_daily_progress
        WHERE username = ?
          AND mission_questions_claimed = 1
          AND mission_accuracy_claimed = 1
          AND mission_subject_claimed = 1
        ORDER BY progress_date DESC
        LIMIT 7
    `).bind(username).all<{ progress_date: string }>();

    return {
        completedDays: rows.results.length,
        targetDays: 5,
    };
};
