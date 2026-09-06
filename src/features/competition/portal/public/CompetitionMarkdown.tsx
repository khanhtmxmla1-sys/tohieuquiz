import type { ReactNode } from 'react';
import {
  containsRawHtmlLikeTag,
  isExternalCompetitionUrl,
  isSafeCompetitionUrl,
} from './safeCompetitionMarkdown';

interface CompetitionMarkdownProps {
  source: string;
  headingLevelOffset?: number;
}

type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'unordered'; items: string[] }
  | { kind: 'ordered'; items: string[] }
  | { kind: 'raw'; text: string };

const headingPattern = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/;
const unorderedItemPattern = /^\s{0,3}-\s+(.+)$/;
const orderedItemPattern = /^\s{0,3}\d+\.\s+(.+)$/;

const parseBlocks = (source: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraphLines: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ kind: 'paragraph', text: paragraphLines.join(' ') });
    paragraphLines = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      flushParagraph();
      index += 1;
      continue;
    }

    if (containsRawHtmlLikeTag(line)) {
      flushParagraph();
      blocks.push({ kind: 'raw', text: line });
      index += 1;
      continue;
    }

    const headingMatch = line.match(headingPattern);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    const unorderedMatch = line.match(unorderedItemPattern);
    if (unorderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(unorderedItemPattern);
        if (!itemMatch || containsRawHtmlLikeTag(lines[index])) break;
        items.push(itemMatch[1]);
        index += 1;
      }
      blocks.push({ kind: 'unordered', items });
      continue;
    }

    const orderedMatch = line.match(orderedItemPattern);
    if (orderedMatch) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(orderedItemPattern);
        if (!itemMatch || containsRawHtmlLikeTag(lines[index])) break;
        items.push(itemMatch[1]);
        index += 1;
      }
      blocks.push({ kind: 'ordered', items });
      continue;
    }

    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
};

const renderInline = (source: string, wrapPlainText = true): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const key = `text-${tokenIndex}`;
    tokenIndex += 1;
    nodes.push(wrapPlainText ? <span key={key}>{text}</span> : text);
  };

  const pushInline = (node: ReactNode) => {
    nodes.push(node);
    tokenIndex += 1;
  };

  let index = 0;
  while (index < source.length) {
    const imageStart = source.startsWith('![', index) ? index : -1;
    const linkStart = imageStart === -1 && source[index] === '[' ? index : -1;

    if (imageStart !== -1 || linkStart !== -1) {
      const labelStart = (imageStart !== -1 ? imageStart : linkStart) + 1 + (imageStart !== -1 ? 1 : 0);
      const labelEnd = source.indexOf('](', labelStart);
      const urlEnd = labelEnd === -1 ? -1 : source.indexOf(')', labelEnd + 2);

      if (labelEnd !== -1 && urlEnd > labelEnd + 2) {
        pushText(source.slice(cursor, index));
        const label = source.slice(labelStart, labelEnd);
        const url = source.slice(labelEnd + 2, urlEnd).trim();
        const key = `token-${tokenIndex}`;
        const isImage = imageStart !== -1;

        if (isSafeCompetitionUrl(url)) {
          if (isImage) {
            pushInline(<img key={key} src={url} alt={label} />);
          } else {
            const external = isExternalCompetitionUrl(url);
            pushInline(
              <a
                key={key}
                href={url}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {label}
              </a>,
            );
          }
        } else {
          pushInline(<span key={key}>{label}</span>);
        }

        index = urlEnd + 1;
        cursor = index;
        continue;
      }
    }

    if (source.startsWith('**', index)) {
      const end = source.indexOf('**', index + 2);
      if (end > index + 2) {
        pushText(source.slice(cursor, index));
        pushInline(<strong key={`token-${tokenIndex}`}>{renderInline(source.slice(index + 2, end), false)}</strong>);
        index = end + 2;
        cursor = index;
        continue;
      }
    }

    if (source[index] === '*') {
      const end = source.indexOf('*', index + 1);
      if (end > index + 1) {
        pushText(source.slice(cursor, index));
        pushInline(<em key={`token-${tokenIndex}`}>{renderInline(source.slice(index + 1, end), false)}</em>);
        index = end + 1;
        cursor = index;
        continue;
      }
    }

    index += 1;
  }

  pushText(source.slice(cursor));
  return nodes;
};

const renderBlock = (block: MarkdownBlock, index: number, headingLevelOffset: number): ReactNode => {
  switch (block.kind) {
    case 'heading': {
      const content = renderInline(block.text);
      const level = Math.min(6, Math.max(1, block.level + headingLevelOffset));
      if (level === 1) return <h1 key={index}>{content}</h1>;
      if (level === 2) return <h2 key={index}>{content}</h2>;
      if (level === 3) return <h3 key={index}>{content}</h3>;
      if (level === 4) return <h4 key={index}>{content}</h4>;
      if (level === 5) return <h5 key={index}>{content}</h5>;
      return <h6 key={index}>{content}</h6>;
    }
    case 'unordered':
      return (
        <ul key={index} aria-label="unordered list">
          {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>
      );
    case 'ordered':
      return (
        <ol key={index} aria-label="ordered list">
          {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ol>
      );
    case 'raw':
      return <p key={index}>{block.text}</p>;
    case 'paragraph':
      return <p key={index}>{renderInline(block.text)}</p>;
  }
};

const CompetitionMarkdown = ({ source, headingLevelOffset = 0 }: CompetitionMarkdownProps) => (
  <div className="competition-markdown space-y-4">
    {parseBlocks(source).map((block, index) => renderBlock(block, index, headingLevelOffset))}
  </div>
);

export default CompetitionMarkdown;
