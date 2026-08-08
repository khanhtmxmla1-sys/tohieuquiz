import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const assetDir = path.join(root, 'assets', 'certificate-backgrounds', 'tohieuquiz-2026');
const migrationPath = path.join(root, 'workers', 'migrations', '0036_seed_tohieuquiz_certificate_templates.sql');
const layoutMigrationPath = path.join(root, 'workers', 'migrations', '0041_certificate_layout_and_name_fonts.sql');
const pngMigrationPath = path.join(root, 'workers', 'migrations', '0055_certificate_render_backgrounds_png.sql');
const pngRollbackPath = path.join(root, 'workers', 'rollbacks', '0055_drop_certificate_render_backgrounds_png.sql');
const generatedMigrationPath = path.join(root, 'workers', 'migrations', '0056_add_generated_certificate_templates.sql');
const generatedRollbackPath = path.join(root, 'workers', 'rollbacks', '0056_drop_generated_certificate_templates.sql');
const footerMigrationPath = path.join(root, 'workers', 'migrations', '0063_certificate_footer_safe_zone.sql');
const defaultsPath = path.join(root, 'workers', 'seeds', 'defaults.sql');

const templates = [
  { id: 'tohieuquiz-classic-red-navy-2026', file: 'classic-red-navy' },
  { id: 'tohieuquiz-modern-color-2026', file: 'modern-color' },
  { id: 'tohieuquiz-formal-blue-2026', file: 'formal-blue' },
  { id: 'tohieuquiz-kids-learning-2026', file: 'kids-learning' },
  { id: 'tohieuquiz-geometric-navy-orange-2026', file: 'geometric-navy-orange' },
] as const;

const generatedTemplates = [
  { id: 'tohieuquiz-generated-01-ornate-red-navy-2026', file: '01-ornate-red-navy.png' },
  { id: 'tohieuquiz-generated-02-geometric-blue-gold-2026', file: '02-geometric-blue-gold.png' },
  { id: 'tohieuquiz-generated-03-formal-blue-administrative-2026', file: '03-formal-blue-administrative.png' },
  { id: 'tohieuquiz-generated-04-cheerful-school-2026', file: '04-cheerful-school.png' },
  { id: 'tohieuquiz-generated-05-geometric-navy-orange-2026', file: '05-geometric-navy-orange.png' },
  { id: 'tohieuquiz-generated-06-botanical-green-gold-2026', file: '06-botanical-green-gold.png' },
  { id: 'tohieuquiz-generated-07-purple-gold-ornate-2026', file: '07-purple-gold-ornate.png' },
  { id: 'tohieuquiz-generated-08-soft-pastel-learning-2026', file: '08-soft-pastel-learning.png' },
  { id: 'tohieuquiz-generated-09-premium-gold-cream-2026', file: '09-premium-gold-cream.png' },
  { id: 'tohieuquiz-generated-10-festive-academic-blue-gold-2026', file: '10-festive-academic-blue-gold.png' },
] as const;

describe('TôHiệuQuiz certificate template seed', () => {
  it('seeds five global 1270x698 templates with dynamic certificate fields', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const template of templates) {
      expect(sql).toContain(`'${template.id}'`);
      expect(sql).toContain(`'cert-backgrounds/tohieuquiz-2026/${template.file}.webp'`);
    }

    expect(sql.match(/1270, 698/g)).toHaveLength(5);
    for (const key of ['student_name', 'quiz_title', 'score', 'date', 'teacher_name']) {
      expect(sql.match(new RegExp(`\\"key\\":\\"${key}\\"`, 'g'))).toHaveLength(5);
    }
    expect(sql.match(/"fontFamily":"Great Vibes"/g)).toHaveLength(5);
    expect(sql.match(/NULL,\s*\n\s*'TôHiệuQuiz/g)).toHaveLength(5);
  });

  it('keeps all personalized and institutional text out of the background artwork', async () => {
    const forbiddenText = [
      '<text',
      'ỦY BAN NHÂN DÂN',
      'TRƯỜNG TIỂU HỌC',
      'CHỨNG NHẬN',
      'Họ và tên',
      'Điểm:',
      'GIÁO VIÊN CHỦ NHIỆM',
    ];

    for (const template of templates) {
      const svg = await readFile(path.join(assetDir, `${template.file}.svg`), 'utf8');
      expect(svg).toContain('width="1270" height="698"');
      for (const forbidden of forbiddenText) expect(svg).not.toContain(forbidden);

      const pngPath = path.join(assetDir, `${template.file}.png`);
      const pngBytes = await readFile(pngPath);
      const pngMetadata = await stat(pngPath);
      expect(pngMetadata.size).toBeGreaterThan(5_000);
      expect(Array.from(pngBytes.subarray(0, 8))).toEqual([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      const webpPath = path.join(assetDir, `${template.file}.webp`);
      const webpBytes = await readFile(webpPath);
      const webpMetadata = await stat(webpPath);
      expect(webpMetadata.size).toBeGreaterThan(5_000);
      expect(webpBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(webpBytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    }
  });

  it('migrates render backgrounds to PNG while retaining WebP thumbnails', async () => {
    const migration = await readFile(pngMigrationPath, 'utf8');
    const rollback = await readFile(pngRollbackPath, 'utf8');
    const defaults = await readFile(defaultsPath, 'utf8');

    for (const template of templates) {
      const pngKey = `cert-backgrounds/tohieuquiz-2026/${template.file}.png`;
      const webpKey = `cert-backgrounds/tohieuquiz-2026/${template.file}.webp`;
      expect(migration).toContain(`'${template.id}'`);
      expect(migration).toContain(`'${pngKey}'`);
      expect(rollback).toContain(`'${webpKey}'`);
      expect(defaults).toContain(`'${pngKey}'`);
      expect(defaults).toContain(`'${webpKey}'`);
    }
  });

  it('adds ten generated PNG templates with dynamic fields and safe rollback behavior', async () => {
    const migration = await readFile(generatedMigrationPath, 'utf8');
    const rollback = await readFile(generatedRollbackPath, 'utf8');
    const defaults = await readFile(defaultsPath, 'utf8');

    for (const template of generatedTemplates) {
      const key = `cert-backgrounds/tohieuquiz-2026/generated-10/${template.file}`;
      expect(migration).toContain(`'${template.id}'`);
      expect(migration).toContain(`'${key}'`);
      expect(defaults).toContain(`'${template.id}'`);
      expect(defaults).toContain(`'${key}'`);
      expect(rollback).toContain(`'${template.id}'`);
    }

    expect(migration.match(/1270, 698/g)).toHaveLength(10);
    for (const key of ['student_name', 'quiz_title', 'score', 'date', 'teacher_name']) {
      expect(migration.match(new RegExp(`\\\"key\\\":\\\"${key}\\\"`, 'g'))).toHaveLength(10);
    }
    expect(rollback).toContain('SET is_active = 0');
    expect(rollback).not.toContain('DELETE FROM certificate_templates');
  });

  it('keeps all built-in footers inside the shared safe zone', async () => {
    const migration = await readFile(footerMigrationPath, 'utf8');
    const defaults = await readFile(defaultsPath, 'utf8');

    for (const sql of [migration, defaults]) {
      expect(sql).toContain("'$.y', 520");
      expect(sql).toContain("'$.y', 555");
      expect(sql).toContain("'$.y', 610");
      expect(sql).toContain("'$.maxWidth', 450");
      expect(sql).toContain("'$.maxWidth', 320");
      expect(sql).toContain("'$.baseline', 'alphabetic'");
    }
    for (const template of [...templates, ...generatedTemplates]) {
      expect(migration).toContain(`'${template.id}'`);
    }
  });

  it('aligns names to guide lines and centers score text in each score frame', async () => {
    const sql = await readFile(layoutMigrationPath, 'utf8');

    expect(sql).toContain("'tohieuquiz-classic-red-navy-2026', 478");
    expect(sql).toContain("'tohieuquiz-modern-color-2026', 499");
    expect(sql).toContain("'tohieuquiz-formal-blue-2026', 503");
    expect(sql).toContain("'tohieuquiz-kids-learning-2026', 509");
    expect(sql).toContain("'tohieuquiz-geometric-navy-orange-2026', 497");
    expect(sql).toContain("'$.baseline', 'alphabetic'");
    expect(sql).toContain("'$.maxWidth', 680");
  });
});
