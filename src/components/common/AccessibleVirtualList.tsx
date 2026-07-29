import React, { useMemo, useState } from 'react';

interface AccessibleVirtualListProps<T> {
  items: T[];
  getKey: (item: T) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  ariaLabel: string;
  itemHeight?: number;
  viewportHeight?: number;
  threshold?: number;
  className?: string;
}

export function AccessibleVirtualList<T>({
  items,
  getKey,
  renderItem,
  ariaLabel,
  itemHeight = 220,
  viewportHeight = 720,
  threshold = 100,
  className = '',
}: AccessibleVirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const virtualized = items.length > threshold;
  const overscan = 3;
  const range = useMemo(() => {
    if (!virtualized) return { start: 0, end: items.length };
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
    return { start, end: Math.min(items.length, start + visibleCount) };
  }, [itemHeight, items.length, scrollTop, viewportHeight, virtualized]);
  const visibleItems = items.slice(range.start, range.end);

  if (!virtualized) {
    return (
      <div role="list" aria-label={ariaLabel} className={className}>
        {items.map((item, index) => (
          <div
            role="listitem"
            aria-posinset={index + 1}
            aria-setsize={items.length}
            key={getKey(item)}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      aria-rowcount={items.length}
      tabIndex={0}
      className={`overflow-y-auto ${className}`}
      style={{ maxHeight: viewportHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div aria-hidden="true" style={{ height: range.start * itemHeight }} />
      {visibleItems.map((item, offset) => {
        const index = range.start + offset;
        return (
          <div
            role="listitem"
            aria-posinset={index + 1}
            aria-setsize={items.length}
            key={getKey(item)}
            style={{ minHeight: itemHeight }}
          >
            {renderItem(item, index)}
          </div>
        );
      })}
      <div aria-hidden="true" style={{ height: (items.length - range.end) * itemHeight }} />
      <p className="sr-only" aria-live="polite">
        Đang hiển thị mục {range.start + 1} đến {range.end} trong tổng số {items.length} mục.
      </p>
    </div>
  );
}
