import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useFocusTrap } from './useFocusTrap';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: React.ReactNode;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    mobileMode?: 'sheet' | 'fullscreen' | 'auto';
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
}

const sizeStyles = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', full: 'max-w-4xl' } as const;

export const Modal: React.FC<ModalProps> = ({
    isOpen, onClose, title, description, children, size = 'md', showCloseButton = true,
    mobileMode = 'auto', closeOnBackdrop = true, closeOnEscape = true, initialFocusRef,
}) => {
    const { isMobile } = useResponsiveLayout();
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    useBodyScrollLock(isOpen);
    useFocusTrap(panelRef, isOpen, initialFocusRef);

    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [closeOnEscape, isOpen, onClose]);

    if (!isOpen || typeof document === 'undefined') return null;

    const resolvedMobileMode = mobileMode === 'auto' ? (size === 'full' ? 'fullscreen' : 'sheet') : mobileMode;
    const isFullscreen = isMobile && resolvedMobileMode === 'fullscreen';
    const isSheet = isMobile && resolvedMobileMode === 'sheet';
    const panelClass = isFullscreen ? 'h-dvh max-h-dvh rounded-none' : isSheet ? 'max-h-[92dvh] rounded-t-3xl rounded-b-none' : 'rounded-2xl';

    return createPortal(
        <div
            className={`fixed inset-0 z-50 flex min-h-full justify-center overflow-y-auto bg-slate-950/45 backdrop-blur-sm ${isSheet ? 'items-end' : 'items-center'} ${isFullscreen ? 'p-0' : 'p-4'}`}
            onMouseDown={event => {
                if (closeOnBackdrop && event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-label={title ? undefined : 'Hộp thoại'}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={`relative w-full ${isMobile ? 'max-w-none' : sizeStyles[size]} overflow-hidden bg-white shadow-2xl outline-none ${panelClass}`}
            >
                {(title || description || showCloseButton) && (
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                        <div className="min-w-0">
                            {title && <h2 id={titleId} className="text-xl font-semibold text-slate-900">{title}</h2>}
                            {description && <div id={descriptionId} className="mt-1 text-sm text-slate-600">{description}</div>}
                        </div>
                        {showCloseButton && (
                            <button type="button" onClick={onClose} aria-label="Đóng" className="min-h-11 min-w-11 rounded-full p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                                <X aria-hidden="true" className="mx-auto h-5 w-5" />
                            </button>
                        )}
                    </div>
                )}
                <div className={`${isFullscreen || isSheet ? 'max-h-[calc(100dvh-88px)] overflow-y-auto px-5 py-4' : 'px-6 py-4'}`}>{children}</div>
            </div>
        </div>,
        document.body,
    );
};

export default Modal;
