import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import MathSpan from './MathSpan';
import { hasMathSyntax } from '../../../../../utils/mathText';

interface LatexDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
}

const VIEWPORT_PADDING = 8;
const MENU_GAP = 4;
const MAX_MENU_HEIGHT = 240;
const ESTIMATED_OPTION_HEIGHT = 44;

const LatexDropdown: React.FC<LatexDropdownProps> = React.memo(({
  options,
  value,
  onChange,
  placeholder = '-- Chọn --',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<DropdownPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasLatex = options.some(hasMathSyntax);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(
      MAX_MENU_HEIGHT,
      Math.max(
        ESTIMATED_OPTION_HEIGHT,
        (options.length + 1) * ESTIMATED_OPTION_HEIGHT,
      ),
    );
    const measuredHeight = menuRef.current?.scrollHeight || estimatedHeight;
    const measuredWidth = Math.max(
      rect.width,
      menuRef.current?.offsetWidth || rect.width,
    );
    const availableBelow = Math.max(
      0,
      window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_PADDING,
    );
    const availableAbove = Math.max(
      0,
      rect.top - MENU_GAP - VIEWPORT_PADDING,
    );
    const openAbove = availableBelow < Math.min(measuredHeight, 120)
      && availableAbove > availableBelow;
    const availableSpace = openAbove ? availableAbove : availableBelow;
    const maxHeight = Math.max(1, Math.min(MAX_MENU_HEIGHT, availableSpace));
    const renderedHeight = Math.min(measuredHeight, maxHeight);
    const maxWidth = Math.max(1, window.innerWidth - VIEWPORT_PADDING * 2);
    const clampedWidth = Math.min(measuredWidth, maxWidth);
    const maxLeft = Math.max(
      VIEWPORT_PADDING,
      window.innerWidth - clampedWidth - VIEWPORT_PADDING,
    );

    setMenuPosition({
      top: openAbove
        ? Math.max(VIEWPORT_PADDING, rect.top - MENU_GAP - renderedHeight)
        : Math.min(window.innerHeight - VIEWPORT_PADDING, rect.bottom + MENU_GAP),
      left: Math.min(Math.max(VIEWPORT_PADDING, rect.left), maxLeft),
      minWidth: Math.min(rect.width, maxWidth),
      maxWidth,
      maxHeight,
    });
  }, [options.length]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedTrigger && !clickedMenu) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return undefined;
    }

    updateMenuPosition();
    const frame = window.requestAnimationFrame(updateMenuPosition);
    const resizeObserver = typeof ResizeObserver !== 'undefined' && menuRef.current
      ? new ResizeObserver(updateMenuPosition)
      : null;
    if (resizeObserver && menuRef.current) resizeObserver.observe(menuRef.current);

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  if (!hasLatex) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mx-1 cursor-pointer rounded-[8px] border px-2 py-1 font-medium transition-colors ${
          value
            ? 'border-sky-500 bg-sky-50 text-sky-700'
            : 'border-slate-300 bg-white text-slate-600 hover:border-sky-300'
        } ${className}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option, index) => (
          <option key={index} value={option}>{option}</option>
        ))}
      </select>
    );
  }

  const menu = isOpen && typeof document !== 'undefined'
    ? createPortal(
      <div
        ref={menuRef}
        role="listbox"
        data-testid="latex-dropdown-menu"
        style={{
          position: 'fixed',
          top: menuPosition?.top ?? 0,
          left: menuPosition?.left ?? 0,
          minWidth: menuPosition?.minWidth,
          maxWidth: menuPosition?.maxWidth,
          maxHeight: menuPosition?.maxHeight,
          visibility: menuPosition ? 'visible' : 'hidden',
          zIndex: 1000,
        }}
        className="w-max overflow-y-auto rounded-[10px] border border-slate-200 bg-white py-1 shadow-lg"
      >
        <button
          type="button"
          onClick={() => {
            onChange('');
            setIsOpen(false);
          }}
          className="w-full px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-50"
        >
          {placeholder}
        </button>
        {options.map((option, index) => (
          <button
            key={index}
            type="button"
            role="option"
            aria-selected={option === value}
            onClick={() => {
              onChange(option);
              setIsOpen(false);
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
              option === value
                ? 'bg-sky-50 font-semibold text-sky-700'
                : 'text-slate-800 hover:bg-slate-50'
            }`}
          >
            <MathSpan content={option} className="flex-1 text-sm md:text-base" />
            {option === value ? <span className="text-xs">Đã chọn</span> : null}
          </button>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={triggerRef} className={`relative mx-1 inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`inline-flex min-w-[70px] cursor-pointer items-center gap-1.5 rounded-[8px] border px-2 py-1 font-medium transition-colors ${
          value
            ? 'border-sky-500 bg-sky-50 text-sky-700'
            : 'border-slate-300 bg-white text-slate-600 hover:border-sky-300'
        }`}
      >
        {value ? (
          <MathSpan content={value} className="flex-1 text-left" />
        ) : (
          <span className="flex-1 text-left text-slate-400">{placeholder}</span>
        )}
        <span aria-hidden="true" className="text-xs text-slate-400">⌄</span>
      </button>
      {menu}
    </div>
  );
});

export default LatexDropdown;
