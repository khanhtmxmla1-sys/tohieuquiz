// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateQuestion } from '../schemas/quiz.schema';
import { hashQuestionData } from '../workers/src/services/questionBankContent';
import { generateMath5Semester1Dataset } from '../scripts/question-bank/generate-math5-dataset';
import { loadCommittedMath5Dataset, validateMath5Dataset } from '../scripts/question-bank/validate-math5-dataset';

const byLesson = <T extends { metadata: { lessonCode: string } }>(items: T[]) => {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.metadata.lessonCode, [...(map.get(item.metadata.lessonCode) || []), item]);
  return map;
};

describe('Math 5 semester 1 question dataset', () => {
  it('generates exactly 350 DRAFT questions across 35 lessons', () => {
    const dataset = generateMath5Semester1Dataset();
    expect(dataset.items).toHaveLength(350);
    expect(dataset.topics.map((topic) => topic.items.length)).toEqual([50, 50, 60, 60, 70, 60]);

    const lessons = byLesson(dataset.items);
    expect(lessons.size).toBe(35);
    for (const [lessonCode, items] of lessons) {
      expect(items, lessonCode).toHaveLength(10);
      expect(items.map((item) => item.id)).toEqual(Array.from(
        { length: 10 },
        (_, index) => `qb-${lessonCode.toLowerCase()}-q${String(index + 1).padStart(2, '0')}`,
      ));
      expect(items.every((item) => item.scope === 'SYSTEM' && item.status === 'DRAFT')).toBe(true);
    }
  });

  it('keeps the approved slot and difficulty distribution for every lesson', () => {
    const lessons = byLesson(generateMath5Semester1Dataset().items);
    for (const [lessonCode, items] of lessons) {
      const difficulties = items.reduce((counts, item) => {
        counts[item.questionData.difficulty as 1 | 2 | 3] += 1;
        return counts;
      }, { 1: 0, 2: 0, 3: 0 });
      expect(difficulties, lessonCode).toEqual({ 1: 4, 2: 4, 3: 2 });

      const roles = items.map((item) => item.metadata.tags.find((tag) => tag.startsWith('Vai trò:')));
      expect(roles.filter((role) => role === 'Vai trò: MCQ cơ bản'), lessonCode).toHaveLength(4);
      expect(roles.filter((role) => role === 'Vai trò: Trả lời ngắn'), lessonCode).toHaveLength(2);
      expect(roles.filter((role) => role === 'Vai trò: Đúng sai'), lessonCode).toHaveLength(1);
      expect(roles.filter((role) => role === 'Vai trò: Tương tác'), lessonCode).toHaveLength(1);
      expect(roles.filter((role) => role === 'Vai trò: Vận dụng'), lessonCode).toHaveLength(2);
    }
  });

  it('passes the saved Question schema and contains complete metadata without AI explanations', () => {
    const dataset = generateMath5Semester1Dataset();
    for (const item of dataset.items) {
      expect(validateQuestion(item.questionData).success, item.id).toBe(true);
      expect(item.questionData).not.toHaveProperty('explanation');
      expect(item.questionData).not.toHaveProperty('image');
      expect(item.metadata).toMatchObject({
        grade: 5,
        subject: 'MATH',
        semester: 1,
        source: 'CURATED_ORIGINAL',
      });
      expect(item.metadata.topicCode).toMatch(/^M5-S1-T0[1-6]$/);
      expect(item.metadata.lessonCode).toMatch(/^M5-S1-L\d{2}$/);
      expect(item.metadata.tags).toContain('Toán');
      expect(item.metadata.tags).toContain('Lớp 5');
      expect(item.metadata.tags).toContain('Học kì 1');
    }
  });

  it('keeps committed topic JSON exactly reproducible from the generator', () => {
    const generated = generateMath5Semester1Dataset().items;
    const committed = loadCommittedMath5Dataset().items;
    expect(committed).toEqual(generated);
  });

  it('passes the independent committed-file validator', async () => {
    const result = await validateMath5Dataset();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.counts).toEqual({ topics: 6, lessons: 35, items: 350, validItems: 350, duplicateHashes: 0 });
  });

  it('has no duplicate canonical content hash', async () => {
    const items = generateMath5Semester1Dataset().items;
    const hashes = await Promise.all(items.map((item) => hashQuestionData(item.questionData)));
    const groups = new Map<string, typeof items>();
    hashes.forEach((hash, index) => groups.set(hash, [...(groups.get(hash) || []), items[index]]));
    const duplicates = [...groups.values()]
      .filter((group) => group.length > 1)
      .map((group) => group.map((item) => ({
        id: item.id,
        lessonCode: item.metadata.lessonCode,
        type: item.questionData.type,
        text: 'question' in item.questionData
          ? item.questionData.question
          : 'mainQuestion' in item.questionData
            ? item.questionData.mainQuestion
            : '',
      })));
    if (duplicates.length > 0) {
      fs.mkdirSync('.tmp', { recursive: true });
      fs.writeFileSync('.tmp/math5-duplicate-content.json', JSON.stringify(duplicates, null, 2));
    }
    expect(duplicates).toEqual([]);
  });
});
