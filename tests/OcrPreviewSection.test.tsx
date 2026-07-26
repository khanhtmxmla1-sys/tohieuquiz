import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OcrPreviewSection from '../src/features/quiz-generator/components/OcrPreviewSection';
import type { OcrDocument } from '../src/services/ai/schemas/ocrDocumentSchema';

const document: OcrDocument = {
  pages: [
    { pageNumber: 1, text: 'Nội dung trang một' },
    { pageNumber: 2, text: 'Nội dung trang hai' },
    { pageNumber: 3, text: 'Nội dung trang ba' },
  ],
  warnings: [],
  wasTruncated: false,
};

const Harness = ({ onChange = vi.fn() }: { onChange?: (pages: number[]) => void }) => {
  const [selectedPages, setSelectedPages] = useState([1, 2, 3]);
  return (
    <OcrPreviewSection
      document={document}
      selectedPageNumbers={selectedPages}
      onChange={(next) => {
        setSelectedPages(next);
        onChange(next);
      }}
    />
  );
};

describe('OcrPreviewSection', () => {
  it('generates content from selected pages only', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Trang 2'));
    expect(onChange).toHaveBeenLastCalledWith([1, 3]);
  });

  it('requires at least one selected page', () => {
    render(<Harness />);

    fireEvent.click(screen.getByLabelText('Trang 1'));
    fireEvent.click(screen.getByLabelText('Trang 2'));
    fireEvent.click(screen.getByLabelText('Trang 3'));

    expect(screen.getByText('Cần chọn ít nhất một trang.')).toBeInTheDocument();
  });

  it('shows the truncation warning', () => {
    render(
      <OcrPreviewSection
        document={{ ...document, wasTruncated: true }}
        selectedPageNumbers={[1, 2, 3]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Tài liệu đã bị cắt bớt')).toBeInTheDocument();
  });
});
