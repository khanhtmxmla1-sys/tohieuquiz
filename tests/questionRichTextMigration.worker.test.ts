// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0064_add_question_rich_text.sql';
const rollbackPath = 'workers/rollbacks/0064_drop_question_rich_text.sql';
let db: DatabaseSync | null = null;

afterEach(() => {
    db?.close();
    db = null;
});

describe('0064 question rich text migration', () => {
    it('adds an additive non-null rich-text column with a safe legacy default', () => {
        db = new DatabaseSync(':memory:');
        db.exec(`
            CREATE TABLE questions (
                id TEXT PRIMARY KEY,
                question TEXT DEFAULT ''
            );
            INSERT INTO questions (id, question) VALUES ('legacy-q', 'Dòng 1');
        `);

        db.exec(readFileSync(migrationPath, 'utf8'));

        const columns = db.prepare('PRAGMA table_info(questions)').all() as Array<{
            name: string;
            notnull: number;
            dflt_value: string | null;
        }>;
        const richColumn = columns.find((column) => column.name === 'question_rich_text');
        expect(richColumn).toMatchObject({ notnull: 1, dflt_value: "''" });
        expect(db.prepare("SELECT question_rich_text FROM questions WHERE id = 'legacy-q'").get())
            .toEqual({ question_rich_text: '' });
    });

    it('keeps the destructive rollback separate from normal application rollback', () => {
        db = new DatabaseSync(':memory:');
        db.exec(`CREATE TABLE questions (id TEXT PRIMARY KEY, question TEXT DEFAULT '');`);
        db.exec(readFileSync(migrationPath, 'utf8'));
        db.exec(readFileSync(rollbackPath, 'utf8'));

        const names = (db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>)
            .map((column) => column.name);
        expect(names).not.toContain('question_rich_text');
        expect(names).toContain('question');
    });
});
