export class ClassroomStatement {
    bindings: unknown[] = [];
    constructor(readonly sql: string, private readonly db: ClassroomDatabase) {}
    bind(...values: unknown[]) { this.bindings = values; return this; }
    async first<T>() { this.db.executed.push(this); return this.db.first(this.sql) as T; }
    async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql) as T[] }; }
    async run() { this.db.executed.push(this); return { success: true }; }
}

interface ClassroomFixtureOptions {
    classroom?: any;
    student?: any;
    students?: any[];
    assignment?: any;
    attemptCount?: number;
    batchError?: Error;
    shopItems?: any[];
}

export class ClassroomDatabase {
    executed: ClassroomStatement[] = [];
    constructor(private readonly options: ClassroomFixtureOptions = {}) {}
    prepare(sql: string) { return new ClassroomStatement(sql, this); }
    async batch(statements: ClassroomStatement[]) {
        this.executed.push(...statements);
        if (this.options.batchError) throw this.options.batchError;
        return statements.map(() => ({ success: true }));
    }
    first(sql: string) {
        if (sql.includes('FROM classes WHERE id = ?')) return this.options.classroom ?? null;
        if (sql.includes('FROM students WHERE id = ?')) return this.options.student ?? null;
        if (sql.includes('FROM students WHERE username = ?')) return this.options.student ?? null;
        if (sql.includes('FROM students s')) return this.options.student ?? null;
        if (sql.includes('FROM assignments WHERE id = ?')) return this.options.assignment ?? null;
        if (sql.includes('SELECT COUNT(*) as cnt FROM results')) {
            return { cnt: this.options.attemptCount ?? 0 };
        }
        return null;
    }
    all(sql: string) {
        if (sql.includes('SELECT * FROM students WHERE class_id = ?')) {
            return this.options.students ?? [];
        }
        if (sql.includes('SELECT * FROM shop_items')) return this.options.shopItems ?? [];
        return [];
    }
}

export const classroomEnv = (db: ClassroomDatabase) => ({
    DB: db,
    JWT_SECRET: 'test-secret',
} as any);

export const classroomRequest = (path: string, init: RequestInit = {}) =>
    new Request(`https://test${path}`, {
        ...init,
        headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
    });
