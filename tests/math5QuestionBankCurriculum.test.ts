import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

interface CurriculumLesson {
  code: string;
  number: number;
  title: string;
  page: number | null;
  keywords: string[];
  interactionTypes: string[];
}

interface CurriculumTopic {
  code: string;
  order: number;
  title: string;
  lessons: CurriculumLesson[];
}

const curriculum = JSON.parse(fs.readFileSync(
  'data/question-bank/math5-semester1/curriculum.json',
  'utf8',
)) as { grade: number; subject: string; semester: number; topics: CurriculumTopic[] };

describe('Math 5 semester 1 curriculum', () => {
  it('contains the approved 6 topics and 35 sequential lessons', () => {
    expect(curriculum).toMatchObject({ grade: 5, subject: 'MATH', semester: 1 });
    expect(curriculum.topics).toHaveLength(6);
    expect(curriculum.topics.map((topic) => topic.lessons.length)).toEqual([5, 5, 6, 6, 7, 6]);

    const lessons = curriculum.topics.flatMap((topic) => topic.lessons);
    expect(lessons).toHaveLength(35);
    expect(lessons.map((lesson) => lesson.number)).toEqual(Array.from({ length: 35 }, (_, index) => index + 1));
    expect(lessons.map((lesson) => lesson.code)).toEqual(Array.from(
      { length: 35 },
      (_, index) => `M5-S1-L${String(index + 1).padStart(2, '0')}`,
    ));
    expect(new Set(lessons.map((lesson) => lesson.title)).size).toBeGreaterThan(25);
  });

  it('keeps the known lesson 6 title and complete classification metadata', () => {
    const lessons = curriculum.topics.flatMap((topic) => topic.lessons);
    expect(lessons[5].title).toBe('Cộng, trừ hai phân số khác mẫu số');
    for (const [topicIndex, topic] of curriculum.topics.entries()) {
      expect(topic.code).toBe(`M5-S1-T${String(topicIndex + 1).padStart(2, '0')}`);
      expect(topic.order).toBe(topicIndex + 1);
      expect(topic.title.trim()).not.toBe('');
      for (const lesson of topic.lessons) {
        expect(lesson.keywords.length).toBeGreaterThanOrEqual(2);
        expect(lesson.interactionTypes.length).toBeGreaterThan(0);
      }
    }
  });
});
