import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SafeFormattedText from '../src/components/common/SafeFormattedText';

vi.mock('better-react-mathjax', () => ({
  MathJax: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SafeFormattedText', () => {
  it('renders the explicit inline formatting allowlist as React nodes', () => {
    render(<SafeFormattedText content={'<u>under</u> <strong>bold</strong> <em>italic</em>'} />);
    expect(screen.getByText('under').tagName).toBe('U');
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
  });

  it('keeps formatting active when a strong range contains inline math segments', () => {
    const { container } = render(
      <SafeFormattedText content={'<strong>Có $48$ lít dầu rót đều vào $6$ can.</strong>'} />,
    );

    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong).toHaveTextContent('Có $48$ lít dầu rót đều vào $6$ can.');
    expect(container).not.toHaveTextContent('<strong>');
    expect(container).not.toHaveTextContent('</strong>');
  });

  it('keeps TeX underscores protected inside a strong range', () => {
    const { container } = render(<SafeFormattedText content={'<strong>$a_b_c$</strong> and _word_'} />);
    expect(container.querySelector('strong')).toHaveTextContent('$a_b_c$');
    expect(container.querySelectorAll('u')).toHaveLength(1);
    expect(container.querySelector('u')).toHaveTextContent('word');
  });
  it('keeps unknown or attributed HTML visible as harmless text', () => {
    const { container } = render(
      <SafeFormattedText content={'<script>alert(1)</script><u onclick="evil()">unsafe</u>'} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    expect(container.textContent).toContain('<u onclick="evil()">unsafe</u>');
  });

  it('does not interpret TeX subscripts as underline notation', () => {
    const { container } = render(<SafeFormattedText content={'$a_b_c$ and _word_'} />);
    expect(container.textContent).toContain('$a_b_c$');
    expect(container.querySelector('u')).toHaveTextContent('word');
  });

  it('supports markdown emphasis only when explicitly enabled', () => {
    const { rerender } = render(<SafeFormattedText content={'**bold** and *italic*'} />);
    expect(screen.queryByText('bold')).toBeNull();
    rerender(<SafeFormattedText content={'**bold** and *italic*'} enableMarkdown />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
  });
});
