import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SafeSvgDiagram from '../src/components/common/SafeSvgDiagram';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="25" /></svg>';

describe('SafeSvgDiagram', () => {
  it('renders sanitized SVG through an image data URL with accessible alt text', () => {
    const { container } = render(<SafeSvgDiagram svgContent={svg} alt="Đường tròn tâm O" />);
    const image = screen.getByRole('img', { name: 'Đường tròn tâm O' });

    expect(image).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/));
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveClass('w-full');
    expect(image).toHaveStyle({ aspectRatio: '100 / 100' });
    expect(container.querySelector('figure')).toHaveClass('w-full');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows a non-blocking fallback when the image cannot render', () => {
    render(<SafeSvgDiagram svgContent={svg} alt="Hình minh họa" />);
    fireEvent.error(screen.getByRole('img', { name: 'Hình minh họa' }));

    expect(screen.getByText('Không thể hiển thị hình minh họa.')).toBeInTheDocument();
  });
});
