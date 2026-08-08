import React, { createRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { plainTextToRichText, type QuestionRichTextEnvelopeV1 } from '../shared/question-rich-text.contract';
import RichQuestionEditor from '../src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor';
import {
    MathComposerProvider,
    useMathComposer,
    useMathComposerField,
} from '../src/features/manual-quiz-workspace/math-composer/useMathComposer';

beforeAll(() => {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
    }) as DOMRect;
});

const ComposerProbe = () => {
    const composer = useMathComposer();
    return (
        <>
            <button type="button" onClick={() => composer.insertTemplate('multiply')}>Chèn phép nhân</button>
            <output data-testid="active-math-target">{composer.activeFieldLabel ?? ''}</output>
        </>
    );
};

const RichTargetHarness = () => {
    const [value, setValue] = useState<QuestionRichTextEnvelopeV1>(() => plainTextToRichText(''));
    return (
        <MathComposerProvider>
            <RichQuestionEditor
                value={value}
                onChange={(next) => setValue(next)}
            />
            <ComposerProbe />
        </MathComposerProvider>
    );
};

const NativeField = () => {
    const [value, setValue] = useState('A');
    const ref = createRef<HTMLTextAreaElement>();
    const field = useMathComposerField(ref, setValue, 'Ô native');
    return (
        <textarea
            ref={ref}
            aria-label="Ô native"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={field.activate}
            onSelect={field.capture}
            onClick={field.capture}
            onKeyUp={field.capture}
        />
    );
};

const NativeTargetHarness = () => (
    <MathComposerProvider>
        <NativeField />
        <ComposerProbe />
    </MathComposerProvider>
);

describe('Math Composer targets', () => {
    it('inserts a template at the rich-editor target and returns focus to it', async () => {
        render(<RichTargetHarness />);
        const editor = await screen.findByTestId('question-rich-editor');

        fireEvent.focus(editor);
        expect(screen.getByTestId('active-math-target')).toHaveTextContent('Nội dung câu hỏi');
        fireEvent.click(screen.getByRole('button', { name: 'Chèn phép nhân' }));

        await waitFor(() => expect(editor).toHaveTextContent('$\\times$'));
        await waitFor(() => expect(document.activeElement).toBe(editor));
    });

    it('preserves the existing native input/textarea insertion path', async () => {
        render(<NativeTargetHarness />);
        const field = screen.getByRole('textbox', { name: 'Ô native' });

        fireEvent.focus(field);
        (field as HTMLTextAreaElement).setSelectionRange(1, 1);
        fireEvent.select(field);
        fireEvent.click(screen.getByRole('button', { name: 'Chèn phép nhân' }));

        await waitFor(() => expect(field).toHaveValue('A$\\times$'));
        expect(screen.getByTestId('active-math-target')).toHaveTextContent('Ô native');
    });
});
