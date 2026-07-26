import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const assetDir = path.join(root, 'assets', 'certificate-backgrounds', 'tohieuquiz-2026');
const migrationPath = path.join(root, 'workers', 'migrations', '0036_seed_tohieuquiz_certificate_templates.sql');
const layoutMigrationPath = path.join(root, 'workers', 'migrations', '0041_certificate_layout_and_name_fonts.sql');

const templates = [
  { id: 'tohieuquiz-classic-red-navy-2026', file: 'classic-red-navy' },
  { id: 'tohieuquiz-modern-color-2026', file: 'modern-color' },
  { id: 'tohieuquiz-formal-blue-2026', file: 'formal-blue' },
  { id: 'tohieuquiz-kids-learning-2026', file: 'kids-learning' },
  { id: 'tohieuquiz-geometric-navy-orange-2026', file: 'geometric-navy-orange' },
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

      const webpPath = path.join(assetDir, `${template.file}.webp`);
      const bytes = await readFile(webpPath);
      const metadata = await stat(webpPath);
      expect(metadata.size).toBeGreaterThan(5_000);
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
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
