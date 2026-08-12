import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DragDropRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/DragDropRenderer';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/utils/SmartText', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));

const question = {
  id: 'personification-categorization',
  type: 'CATEGORIZATION',
  question: 'Phân loại cách nhân hoá',
  categories: [
    { id: 'call', name: 'Dùng từ gọi người để gọi vật' },
    { id: 'action', name: 'Dùng từ tả hoạt động/đặc điểm của người để tả vật' },
    { id: 'talk', name: 'Trò chuyện với vật như với người' },
  ],
  items: [
    { id: 'i1', content: 'Ông em rất thích đọc báo.', categoryId: 'call' },
    { id: 'i2', content: 'Trời tối, bác thợ rèn trở về trong ngôi nhà.', categoryId: 'action' },
  ],
} as any;

const renderRenderer = (
  answers: Record<string, unknown> = {},
  onAnswerChange = vi.fn(),
) => render(
  <DragDropRenderer
    question={question}
    index={0}
    answers={answers}
    onAnswerChange={onAnswerChange}
  />,
);

describe('DragDropRenderer responsive categorization UI', () => {
  it('keeps every item in one readable card list and shows progress', () => {
    renderRenderer();

    expect(screen.getByText('Đã làm 0/2')).toBeInTheDocument();
    expect(screen.getByText('Ông em rất thích đọc báo.')).toBeInTheDocument();
    expect(screen.getByText('Trời tối, bác thợ rèn trở về trong ngôi nhà.')).toBeInTheDocument();
    expect(screen.queryByText(/Danh sách chưa phân loại/)).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa có mục nào')).not.toBeInTheDocument();

    const firstItemCard = screen.getByText('Ông em rất thích đọc báo.').closest('article');
    expect(firstItemCard).not.toBeNull();
    expect(within(firstItemCard!).getAllByRole('button')).toHaveLength(3);
  });

  it('keeps an assigned item in place and collapses it to a selected badge', () => {
    renderRenderer({ 'personification-categorization': { i1: 'call' } });

    expect(screen.getByText('Đã làm 1/2')).toBeInTheDocument();
    expect(screen.getByText('Ông em rất thích đọc báo.')).toBeInTheDocument();
    const selectedBadge = screen.getByLabelText('Đã chọn nhóm Dùng từ gọi người để gọi vật');
    expect(selectedBadge).toHaveTextContent('✓');
    expect(selectedBadge).toHaveTextContent('Dùng từ gọi người để gọi vật');
    expect(screen.getByRole('button', { name: 'Đổi nhóm cho Ông em rất thích đọc báo.' })).toBeInTheDocument();

    const firstItemCard = screen.getByText('Ông em rất thích đọc báo.').closest('article');
    expect(firstItemCard).not.toBeNull();
    expect(within(firstItemCard!).getAllByRole('button')).toHaveLength(1);
  });

  it('emits the existing assignment map when the student changes a category', () => {
    const onAnswerChange = vi.fn();
    renderRenderer(
      { 'personification-categorization': { i1: 'call' } },
      onAnswerChange,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đổi nhóm cho Ông em rất thích đọc báo.' }));
    fireEvent.click(screen.getByRole('button', {
      name: 'Chọn nhóm Trò chuyện với vật như với người cho Ông em rất thích đọc báo.',
    }));

    expect(onAnswerChange).toHaveBeenCalledWith('personification-categorization', {
      i1: 'talk',
    });
  });

  it('shows completion copy when all items are assigned', () => {
    renderRenderer({
      'personification-categorization': {
        i1: 'call',
        i2: 'action',
      },
    });

    expect(screen.getByText('Đã làm 2/2')).toBeInTheDocument();
    expect(screen.getByText('Đã phân loại xong tất cả.')).toBeInTheDocument();
  });
});
