import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GeneralInfoSection from '../src/features/quiz-generator/components/GeneralInfoSection';

const renderSection = (quizTitle: string) => {
  const onApplyAiCategory = vi.fn();
  const onApplyAiTitle = vi.fn();
  const onAddTag = vi.fn();

  render(
    <GeneralInfoSection
      topic="Phân số"
      setTopic={vi.fn()}
      quizTitle={quizTitle}
      setQuizTitle={vi.fn()}
      classLevel="4"
      setClassLevel={vi.fn()}
      manualTimeLimit={15}
      setManualTimeLimit={vi.fn()}
      category="toan"
      setCategory={vi.fn()}
      tags={[]}
      setTags={vi.fn()}
      tagInput=""
      setTagInput={vi.fn()}
      isOpen
      onToggle={vi.fn()}
      isClassLocked={false}
      isPdfMode={false}
      aiSuggestions={{
        category: 'tieng-viet',
        lesson: 'Luyện tập câu kể',
        tags: ['cau_ke', 'luyen_tap', 'cau_ke'],
      }}
      onApplyAiCategory={onApplyAiCategory}
      onApplyAiTitle={onApplyAiTitle}
      onAddTag={onAddTag}
    />,
  );

  return { onApplyAiCategory, onApplyAiTitle, onAddTag };
};

describe('GeneralInfoSection AI suggestions', () => {
  it('applies category and unique tags but preserves a teacher title', () => {
    const handlers = renderSection('Tên do giáo viên nhập');

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng tất cả' }));

    expect(handlers.onApplyAiCategory).toHaveBeenCalledOnce();
    expect(handlers.onApplyAiTitle).not.toHaveBeenCalled();
    expect(handlers.onAddTag.mock.calls.map(([tag]) => tag)).toEqual(['cau_ke', 'luyen_tap']);
  });

  it('applies the AI title when the teacher title is empty', () => {
    const handlers = renderSection('');

    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng tất cả' }));

    expect(handlers.onApplyAiTitle).toHaveBeenCalledOnce();
  });

  it('allows applying an individual suggested tag', () => {
    const handlers = renderSection('Tên hiện tại');

    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhãn cau_ke' }));
    expect(handlers.onAddTag).toHaveBeenCalledWith('cau_ke');
  });
});
