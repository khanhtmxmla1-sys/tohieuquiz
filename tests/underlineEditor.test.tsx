import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import UnderlineEditor from '../src/features/quiz-editor/components/QuestionEditorModal/editors/UnderlineEditor';
import UnderlineRenderer from '../src/features/quiz-editor/components/QuestionCard/renderers/UnderlineRenderer';
import { QuestionType, type UnderlineQuestion } from '../src/types';
import type { UnderlineEditorDraft } from '../src/features/quiz-editor/types/quiz-editor.types';

const createDraft = (overrides: Partial<UnderlineEditorDraft> = {}): UnderlineEditorDraft => ({
  id: 'underline-1',
  type: QuestionType.UNDERLINE,
  question: 'Chọn từ đúng.',
  sentence: 'Chọn từ đúng.',
  words: ['Chọn', 'từ', 'đúng.'],
  correctWordIndexes: [],
  ...overrides,
});

function ControlledUnderlineEditor({
  initialDraft,
  onChange,
}: {
  initialDraft: UnderlineEditorDraft;
  onChange?: (next: UnderlineEditorDraft) => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  return (
    <UnderlineEditor
      draft={draft}
      onChange={(next) => {
        onChange?.(next);
        setDraft(next);
      }}
    />
  );
}

describe('UnderlineEditor', () => {
  it('derives words from the sentence while preserving the editor contract', () => {
    let nextDraft: UnderlineEditorDraft | undefined;
    render(
      <UnderlineEditor
        draft={createDraft({ sentence: '', words: [], correctWordIndexes: [] })}
        onChange={(next) => {
          nextDraft = next;
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Nhập câu hoàn chỉnh...'), {
      target: { value: 'Mùa hè nóng bức.' },
    });

    expect(nextDraft?.words).toEqual(['Mùa', 'hè', 'nóng', 'bức.']);
  });

  it('toggles the inline word index when a teacher selects it twice', () => {
    const changes: UnderlineEditorDraft[] = [];

    render(
      <ControlledUnderlineEditor
        initialDraft={createDraft({
          sentence: 'Mùa hè nóng bức.',
          words: ['Mùa', 'hè', 'nóng', 'bức.'],
        })}
        onChange={(next) => changes.push(next)}
      />,
    );

    const word = screen.getByRole('button', { name: 'nóng' });
    fireEvent.click(word);
    expect(changes.at(-1)?.correctWordIndexes).toEqual([2]);
    expect(word).toHaveAttribute('aria-pressed', 'true');
    expect(word).toHaveClass('underline');

    fireEvent.click(word);
    expect(changes.at(-1)?.correctWordIndexes).toEqual([]);
    expect(changes.map((change) => change.correctWordIndexes)).toEqual([[2], []]);
    expect(word).toHaveAttribute('aria-pressed', 'false');
    expect(word).not.toHaveClass('underline', 'decoration-emerald-600');
  });

  it('keeps punctuation outside the underlined core and does not render token chips', () => {
    const { container } = render(
      <ControlledUnderlineEditor
        initialDraft={createDraft({
          sentence: 'Mùa hè nóng, bức.',
          words: ['Mùa', 'hè', 'nóng,', 'bức.'],
        })}
      />,
    );

    const word = screen.getByRole('button', { name: 'nóng' });
    expect(word).toHaveTextContent('nóng');
    expect(word.textContent).not.toContain(',');
    expect(container.querySelector('.flex.flex-wrap.gap-2')).toBeNull();
    expect(word).not.toHaveClass('px-2', 'bg-gray-100', 'border');
    expect(container.textContent).toContain('Mùa hè nóng,');
    expect(container.textContent).toContain('bức.');
  });

  it('prunes indexes that become out of range when the sentence is shortened', () => {
    let nextDraft: UnderlineEditorDraft | undefined;
    render(
      <UnderlineEditor
        draft={createDraft({
          sentence: 'Mùa hè nóng bức.',
          words: ['Mùa', 'hè', 'nóng', 'bức.'],
          correctWordIndexes: [1, 3, 99],
        })}
        onChange={(next) => {
          nextDraft = next;
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Nhập câu hoàn chỉnh...'), {
      target: { value: 'Mùa hè.' },
    });

    expect(nextDraft?.words).toEqual(['Mùa', 'hè.']);
    expect(nextDraft?.correctWordIndexes).toEqual([1]);
  });
});

describe('QuestionCard underline preview', () => {
  it('uses the natural sentence renderer without green chips or check markers', () => {
    const question: UnderlineQuestion = {
      id: 'underline-card-1',
      type: QuestionType.UNDERLINE,
      question: 'Chọn từ đúng.',
      sentence: 'Mùa hè nóng, bức.',
      words: ['Mùa', 'hè', 'nóng,', 'bức.'],
      correctWordIndexes: [2],
    };

    const { container } = render(<UnderlineRenderer question={question} />);

    expect(container.textContent).toContain('Mùa hè nóng,');
    expect(container.textContent).toContain('bức.');
    expect(container.querySelector('.flex.flex-wrap.gap-2')).toBeNull();
    expect(container.querySelector('[data-underline-state="correct"]')).toHaveTextContent('nóng');
    expect(container.querySelector('[data-underline-state="correct"]')?.textContent).not.toContain(',');
    expect(container.textContent).not.toContain('✓');
    expect(container.querySelector('[data-underline-state="correct"]')).not.toHaveClass('bg-green-100');
  });
});
