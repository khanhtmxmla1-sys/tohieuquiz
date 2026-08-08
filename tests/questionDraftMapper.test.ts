import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { plainTextToRichText } from '../shared/question-rich-text.contract';
import { draftToQuestion, questionToDraft } from '../src/features/quiz-editor/utils/questionDraftMapper';

describe('questionToDraft authoring normalization', () => {
    it('maps persisted drag-drop blank objects to editable answer strings', () => {
        const draft = questionToDraft({
            id: 'drag-canonical',
            type: QuestionType.DRAG_DROP,
            question: 'Điền đại từ sở hữu.',
            text: 'It is [1]. They are [2].',
            blanks: [
                { id: 'blank-0', correctAnswer: 'ours' },
                { id: 'blank-1', correctAnswer: 'hers' },
            ],
            distractors: ['mine', 'yours'],
        } as any);

        expect(draft).toMatchObject({
            type: QuestionType.DRAG_DROP,
            blanks: ['ours', 'hers'],
            distractors: ['mine', 'yours'],
        });
        expect(draft.blanks).not.toContain('[object Object]');
    });

    it('keeps legacy drag-drop string answers editable', () => {
        const draft = questionToDraft({
            id: 'drag-legacy',
            type: QuestionType.DRAG_DROP,
            question: 'Điền màu sắc.',
            text: 'The sky is [1].',
            blanks: ['blue'],
            distractors: ['green'],
        } as any);

        expect(draft).toMatchObject({
            type: QuestionType.DRAG_DROP,
            blanks: ['blue'],
        });
    });

    it('hydrates a legacy plain question into rich text without losing newlines or TeX', () => {
        const source = 'Dòng 1\nTính $\\frac{1}{2}$';
        const draft = questionToDraft({
            id: 'legacy-rich-fallback',
            type: QuestionType.MCQ,
            question: source,
            options: ['A', 'B'],
            correctAnswer: 'A',
        } as any);

        expect(draft.question).toBe(source);
        expect(draft.questionRichText).toEqual(plainTextToRichText(source));
    });

    it('uses mainQuestion as the rich-text fallback for legacy true-false questions', () => {
        const draft = questionToDraft({
            id: 'true-false-rich-fallback',
            type: QuestionType.TRUE_FALSE,
            question: 'Legacy stale prompt',
            mainQuestion: 'Mệnh đề chính\nDòng hai',
            items: [],
        } as any);

        expect(draft.type).toBe(QuestionType.TRUE_FALSE);
        if (draft.type !== QuestionType.TRUE_FALSE) throw new Error('Expected TRUE_FALSE draft');
        expect(draft.mainQuestion).toBe('Mệnh đề chính\nDòng hai');
        expect(draft.questionRichText).toEqual(plainTextToRichText('Mệnh đề chính\nDòng hai'));
    });

    it('round-trips rich presentation while preserving legacy question fields', () => {
        const rich = plainTextToRichText('Câu 1\nCâu 2');
        rich.doc.content[0] = {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{ type: 'text', text: 'Câu 1', marks: [{ type: 'bold' }] }],
        };
        const original = {
            id: 'rich-round-trip',
            type: QuestionType.MCQ,
            question: 'Câu 1\nCâu 2',
            questionRichText: rich,
            image: 'https://example.com/question.png',
            imageAlt: 'Hình minh họa',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'B',
            difficulty: 2,
        } as any;

        const draft = questionToDraft(original);
        const saved = draftToQuestion(draft, original) as any;

        expect(draft.questionRichText).toEqual(rich);
        expect(saved).toMatchObject({
            question: 'Câu 1\nCâu 2',
            questionRichText: rich,
            image: 'https://example.com/question.png',
            imageAlt: 'Hình minh họa',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'B',
            difficulty: 2,
        });
    });
});
