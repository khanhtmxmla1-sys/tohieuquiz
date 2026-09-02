import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompetitionMarkdown from '../src/features/competition/portal/public/CompetitionMarkdown';

const renderMarkdown = (source: string) => render(
  React.createElement(CompetitionMarkdown, { source }),
);

describe('Competition Markdown security contract', () => {
  it('renders the approved Markdown subset with safe links and images', () => {
    renderMarkdown([
      '# Public heading',
      '',
      'A paragraph with *emphasis* and **strong** text.',
      '',
      '- first item',
      '- second item',
      '',
      '1. ordered first',
      '2. ordered second',
      '',
      '[External](https://example.edu/rules) [Relative](/rules) ![Cover](./cover.jpg)',
    ].join('\n'));

    expect(screen.getByRole('heading', { level: 1, name: 'Public heading' })).toBeInTheDocument();
    expect(screen.getByText('emphasis').tagName).toBe('EM');
    expect(screen.getByText('strong').tagName).toBe('STRONG');
    expect(screen.getByRole('list', { name: /unordered/i })).toBeInTheDocument();
    const orderedList = screen.getByRole('list', { name: 'ordered list' });
    expect(orderedList).toBeInTheDocument();
    expect(orderedList.getAttribute('aria-hidden')).toBeNull();

    const external = screen.getByRole('link', { name: 'External' });
    expect(external).toHaveAttribute('href', 'https://example.edu/rules');
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    const relative = screen.getByRole('link', { name: 'Relative' });
    expect(relative).toHaveAttribute('href', '/rules');
    expect(relative).not.toHaveAttribute('target');
    expect(relative).not.toHaveAttribute('rel');
    expect(screen.getByRole('img', { name: 'Cover' })).toHaveAttribute('src', './cover.jpg');
  });

  it('renders raw HTML and executable embeds as escaped text, never as DOM elements', () => {
    renderMarkdown([
      '<script>alert(1)</script>',
      '<img src="x" onerror="alert(1)">',
      '<iframe src="https://evil.example"></iframe>',
      '<object data="https://evil.example"></object>',
      '<embed src="https://evil.example">',
      '<svg onload="alert(1)"></svg>',
    ].join('\n'));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/frame/i)).not.toBeInTheDocument();
    expect(document.querySelector('script, iframe, object, embed, svg')).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByText(/<img src="x" onerror="alert\(1\)">/)).toBeInTheDocument();
  });

  it('neutralizes unsafe, unknown, and protocol-relative URLs', () => {
    renderMarkdown([
      '[javascript](javascript:alert(1))',
      '![data](data:image/svg+xml;base64,abc)',
      '[vbscript](vbscript:msgbox(1))',
      '[protocol-relative](//evil.example/path)',
      '[unknown](ftp://example.edu/file)',
      '![safe parent](../images/cover.jpg)',
    ].join('\n'));

    expect(screen.queryByRole('link', { name: 'javascript' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'vbscript' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'protocol-relative' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'unknown' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'data' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'safe parent' })).toHaveAttribute('src', '../images/cover.jpg');
    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('protocol-relative')).toBeInTheDocument();
  });

  it('does not decode entity text into markup', () => {
    renderMarkdown('&lt;script&gt;alert(1)&lt;/script&gt;');

    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBeInTheDocument();
  });
});
