/**
 * Common Modal Component
 * 
 * Reusable modal dialog.
 */

import React from 'react';
import { X } from 'lucide-react';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    mobileMode?: 'sheet' | 'fullscreen' | 'auto';
}

const sizeStyles: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
    mobileMode = 'auto',
}) => {
    const { isMobile } = useResponsiveLayout();

    if (!isOpen) return null;

    const resolvedMobileMode = mobileMode === 'auto'
        ? (size === 'full' ? 'fullscreen' : 'sheet')
        : mobileMode;

    const isFullscreen = isMobile && resolvedMobileMode === 'fullscreen';
    const isSheet = isMobile && resolvedMobileMode === 'sheet';

    const panelClass = isFullscreen
        ? 'h-dvh max-h-dvh rounded-none'
        : isSheet
            ? 'max-h-[92dvh] rounded-t-3xl rounded-b-none'
            : 'rounded-2xl';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`flex min-h-full ${isSheet ? 'items-end' : 'items-center'} justify-center ${isFullscreen ? 'p-0' : 'p-4'}`}
            >
                <div
                    className={`relative w-full ${isMobile ? 'max-w-none' : sizeStyles[size]} bg-white ${panelClass} shadow-xl transform transition-all overflow-hidden`}
                >
                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            {title && <h2 className="text-xl font-semibold text-gray-800">{title}</h2>}
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div className={`${isFullscreen || isSheet ? 'px-5 py-4 overflow-y-auto max-h-[calc(100dvh-88px)]' : 'px-6 py-4'}`}>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Modal;
