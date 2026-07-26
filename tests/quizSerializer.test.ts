import { describe, expect, it } from 'vitest';
import { serializeQuizForSave } from '../src/domain/quiz/quizSerializer';
import { createQuizSerializationFixture } from './fixtures/quizSerializerFixture';

describe('quiz save serialization contract', () => {
    it('maps every legacy backend field without mutating the source quiz', () => {
        const quiz = createQuizSerializationFixture();
        const original = structuredClone(quiz);

        const serialized = serializeQuizForSave(quiz) as any;
        const byId = Object.fromEntries(serialized.questions.map((question: any) => [question.id, question]));

        expect(serialized).not.toBe(quiz);
        expect(serialized.questions[0]).not.toBe(quiz.questions[0]);
        expect(quiz).toEqual(original);

        expect(byId.tf.question).toBe('Đánh dấu đúng sai');
        expect(byId.matching.items).toEqual([{ left: 'A', right: '1' }]);
        expect(byId.multiple.correctAnswer).toBe('["A","C"]');
        expect(byId.ordering.correctAnswer).toBe('[1,0]');
        expect(byId.underline.items).toEqual(['Em', 'đi', 'học']);
        expect(byId.underline.correctAnswer).toBe('[1]');
        expect(byId.riddle.items).toEqual(['Dòng một', 'Dòng hai']);
        expect(byId.riddle.text).toBe('Từ cần tìm');
        expect(byId.riddle.sentence).toBe('Gợi ý');
        expect(byId.image.distractors).toEqual(['a.png', 'b.png']);
        expect(byId.scramble.items).toEqual(['H', 'Ọ', 'C']);
        expect(byId.scramble.correctAnswer).toBe('HỌC');
        expect(byId.scramble.text).toBe('Việc ở trường');
        expect(byId.correction.text).toBe('Em nge giảng');
        expect(byId.correction.distractors).toBe('nge');
        expect(byId.correction.correctAnswer).toBe('nghe');
        expect(byId.categorization.distractors).toEqual([{ id: 'cat-1', name: 'Danh từ' }]);
        expect(byId.categorization.difficulty).toBeUndefined();
    });
});
