import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0063_certificate_footer_safe_zone.sql';
const rollbackPath = 'workers/rollbacks/0063_drop_certificate_footer_safe_zone.sql';
let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

function createFixture(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE certificate_templates (
      id TEXT PRIMARY KEY,
      fields_config TEXT NOT NULL,
      canvas_width INTEGER NOT NULL,
      canvas_height INTEGER NOT NULL,
      updated_at TEXT
    );
  `);

  const fields = JSON.stringify([
    { key: 'score', x: 635, y: 509, fontSize: 30 },
    { key: 'date', x: 895, y: 575, fontSize: 16, align: 'right' },
    { key: 'static_text', text: 'GIÁO VIÊN CHỦ NHIỆM', x: 805, y: 614, fontSize: 17 },
    { key: 'teacher_name', x: 805, y: 657, fontSize: 18 },
    { key: 'custom_note', x: 635, y: 530, fontSize: 18 },
  ]);

  database.prepare(`
    INSERT INTO certificate_templates (id, fields_config, canvas_width, canvas_height)
    VALUES (?, ?, 1270, 698)
  `).run('tohieuquiz-kids-learning-2026', fields);
  database.prepare(`
    INSERT INTO certificate_templates (id, fields_config, canvas_width, canvas_height)
    VALUES (?, ?, 1270, 698)
  `).run('school-custom-template', fields);
  return database;
}

function fieldsFor(database: DatabaseSync, id: string): Array<Record<string, unknown>> {
  const row = database.prepare('SELECT fields_config FROM certificate_templates WHERE id = ?')
    .get(id) as { fields_config: string };
  return JSON.parse(row.fields_config) as Array<Record<string, unknown>>;
}

describe('certificate footer safe-zone migration', () => {
  it('moves built-in date/signature fields into a shared safe zone without touching custom templates', () => {
    db = createFixture();
    const beforeCustom = fieldsFor(db, 'school-custom-template');
    db.exec(readFileSync(migrationPath, 'utf8'));

    const fields = fieldsFor(db, 'tohieuquiz-kids-learning-2026');
    expect(fields.find((field) => field.key === 'date')).toMatchObject({
      y: 520,
      baseline: 'alphabetic',
      maxWidth: 450,
    });
    expect(fields.find((field) => field.key === 'static_text')).toMatchObject({
      text: 'GIÁO VIÊN CHỦ NHIỆM',
      y: 555,
      baseline: 'alphabetic',
    });
    expect(fields.find((field) => field.key === 'teacher_name')).toMatchObject({
      y: 610,
      baseline: 'alphabetic',
      maxWidth: 320,
    });
    expect(fields.find((field) => field.key === 'custom_note')).toMatchObject({ y: 530 });
    expect(fieldsFor(db, 'school-custom-template')).toEqual(beforeCustom);
  });

  it('restores the previous built-in coordinates through the rollback script', () => {
    db = createFixture();
    db.exec(readFileSync(migrationPath, 'utf8'));
    db.exec(readFileSync(rollbackPath, 'utf8'));

    const fields = fieldsFor(db, 'tohieuquiz-kids-learning-2026');
    expect(fields.find((field) => field.key === 'date')).toMatchObject({ y: 575 });
    expect(fields.find((field) => field.key === 'static_text')).toMatchObject({ y: 614 });
    expect(fields.find((field) => field.key === 'teacher_name')).toMatchObject({ y: 657 });
    expect(fields.find((field) => field.key === 'date')).not.toHaveProperty('baseline');
    expect(fields.find((field) => field.key === 'teacher_name')).not.toHaveProperty('maxWidth');
  });
});
