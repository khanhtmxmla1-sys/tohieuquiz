import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const files = [
  'src/features/quiz-generator/components/GeneralInfoSection.tsx',
  'src/features/quiz-generator/components/PedagogicalProfileSection.tsx',
  'src/services/teacherAiQuotaService.ts',
  'src/services/ai/extractTextFromPdf.ts',
  'src/services/ai/workerAiClient.ts',
  'src/features/quiz-generator/hooks/useQuizFormState.ts',
];

const forbidden = [
  'Kh?ng',
  'Vui l?ng',
  'T?I LI?U',
  'N?i dung',
  'Y?u c?u',
  'B?n l?',
  'tr? v?',
  'Dinh huong ra de',
  'Bam Thong tu 27',
  'AI Suggestions:',
  '>Apply ',
  'B?i ki?m tra',
];

const documentationFiles = [
  'README.md',
  'docs/deployment/NEW_SYSTEM_SETUP.md',
];

const mojibakeTokens = ['Ã', 'Ä', 'á»', 'áº', 'â€', 'Æ°'];
const requiredGeneralInfoLabels = [
  'Gợi ý từ AI',
  'Áp dụng môn học',
  'Dùng tên bài này',
  'Thêm nhãn',
  'Áp dụng tất cả',
];

describe('AI quiz UTF-8 source guard', () => {
  it.each(files)('does not contain known corrupted copy in %s', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    for (const token of forbidden) {
      expect(source, `${file} contains ${token}`).not.toContain(token);
    }
  });

  it.each(documentationFiles)('keeps AI documentation in valid Vietnamese UTF-8: %s', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    for (const token of mojibakeTokens) {
      expect(source, `${file} contains mojibake token ${token}`).not.toContain(token);
    }
  });

  it('keeps all required Vietnamese AI suggestion labels', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), files[0]),
      'utf8',
    );
    for (const label of requiredGeneralInfoLabels) {
      expect(source).toContain(label);
    }
  });
});
