import { useCallback, useEffect, useRef, type RefObject } from 'react';

type KeyboardEventLike = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>;

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface UseModalFocusTrapOptions {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  triggerRef?: RefObject<HTMLElement | null>;
  onEscape: () => boolean;
}

const getFocusableElements = (dialog: HTMLElement): HTMLElement[] => Array.from(
  dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
).filter((element) => !element.hasAttribute('aria-hidden'));

export const useModalFocusTrap = ({
  open,
  dialogRef,
  initialFocusRef,
  triggerRef,
  onEscape,
}: UseModalFocusTrapOptions) => {
  const restoreTargetRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  const restoreFocus = useCallback(() => {
    restoreTargetRef.current?.focus();
  }, []);

  const closeDialog = useCallback(() => {
    if (onEscapeRef.current()) restoreFocus();
  }, [restoreFocus]);

  const handleKeyDown = useCallback((event: KeyboardEventLike) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;

    const currentFocusableElements = getFocusableElements(dialog);
    if (currentFocusableElements.length === 0) {
      event.preventDefault();
      return;
    }
    const first = currentFocusableElements[0];
    const last = currentFocusableElements[currentFocusableElements.length - 1];
    const activeElement = document.activeElement;
    if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }, [closeDialog, dialogRef]);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    restoreTargetRef.current = triggerRef?.current
      || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const focusableElements = getFocusableElements(dialog);
    const initialFocus = initialFocusRef?.current && dialog.contains(initialFocusRef.current)
      ? initialFocusRef.current
      : focusableElements[0];
    initialFocus?.focus();

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof Node && dialog.contains(event.target)) return;
      handleKeyDown(event);
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [dialogRef, handleKeyDown, initialFocusRef, open, triggerRef]);

  return { closeDialog, handleKeyDown, restoreFocus };
};
