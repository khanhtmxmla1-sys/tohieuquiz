import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { questionToDraft } from '../src/features/quiz-editor/utils/questionDraftMapper';

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
});
