/**
 * Avatar Selector Modal
 *
 * Displays a grid of sticker avatars for students to choose from.
 * Calls API to persist the selection.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AVATAR_LIST, getAvatarUrl } from '../../config/avatars';
import { useClassroomStore } from '../../stores/useClassroomStore';
import { Check, Loader2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

interface AvatarSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAvatar?: string;
}

const AvatarSelectorModal: React.FC<AvatarSelectorModalProps> = ({ isOpen, onClose, currentAvatar }) => {
    const [selectedAvatar, setSelectedAvatar] = useState<string>(currentAvatar || 'girl_01');
    const [activeTab, setActiveTab] = useState<'all' | 'girl' | 'boy'>('all');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const prefersReducedMotion = useReducedMotion();

    const studentSession = useClassroomStore(s => s.studentSession);
    const updateAvatar = useClassroomStore(s => s.updateAvatar);

    const filteredAvatars = useMemo(() => {
        if (activeTab === 'all') return AVATAR_LIST;
        return AVATAR_LIST.filter(a => a.category === activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isSaving) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSaving, onClose]);

    useEffect(() => {
        if (isOpen) {
            setSelectedAvatar(currentAvatar || 'girl_01');
        }
    }, [currentAvatar, isOpen]);

    const handleSave = async () => {
        if (!studentSession) return;
        setIsSaving(true);

        const ok = await updateAvatar(studentSession.studentId, selectedAvatar);

        setIsSaving(false);
        if (ok) {
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                onClose();
            }, 1200);
        }
    };

    if (!isOpen) return null;

    const hasChanged = selectedAvatar !== (currentAvatar || 'girl_01');
    const transition = { duration: prefersReducedMotion ? 0.01 : 0.2, ease: 'easeOut' as const };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
                onClick={() => !isSaving && onClose()}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                aria-hidden="true"
            />

            <motion.div
                initial={{ scale: 0.98, opacity: 1, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0, y: 12 }}
                transition={transition}
                role="dialog"
                aria-modal="true"
                aria-labelledby="avatar-modal-title"
                aria-describedby="avatar-modal-description"
                className="avatar-modal"
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng hộp chọn avatar"
                    className="avatar-modal__close"
                >
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>

                <div className="avatar-modal__header">
                    <div className="avatar-modal__preview">
                        <img
                            src={getAvatarUrl(selectedAvatar)}
                            alt="Avatar đang chọn"
                            className="avatar-modal__preview-img"
                        />
                    </div>
                    <h2 id="avatar-modal-title" className="avatar-modal__title">Chọn Avatar của em!</h2>
                    <p id="avatar-modal-description" className="avatar-modal__subtitle">
                        Bấm vào hình yêu thích rồi nhấn Lưu nhé
                    </p>
                </div>

                <div className="avatar-modal__tabs" role="tablist" aria-label="Nhóm avatar">
                    {(['all', 'girl', 'boy'] as const).map(tab => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab}
                            onClick={() => setActiveTab(tab)}
                            className={`avatar-modal__tab ${activeTab === tab ? 'avatar-modal__tab--active' : ''}`}
                        >
                            {tab === 'all' ? '✨ Tất Cả' : tab === 'girl' ? '👧 Bé Gái' : '👦 Bé Trai'}
                        </button>
                    ))}
                </div>

                <div className="avatar-modal__grid" aria-label="Danh sách avatar">
                    {filteredAvatars.map((avatar) => (
                        <button
                            key={avatar.id}
                            type="button"
                            onClick={() => setSelectedAvatar(avatar.id)}
                            aria-pressed={selectedAvatar === avatar.id}
                            className={`avatar-modal__item ${selectedAvatar === avatar.id ? 'avatar-modal__item--selected' : ''}`}
                            title={avatar.name}
                        >
                            <img
                                src={avatar.url}
                                alt={avatar.name}
                                className="avatar-modal__item-img"
                                loading="lazy"
                            />
                            {selectedAvatar === avatar.id && (
                                <span className="avatar-modal__item-check" aria-hidden="true">
                                    <Check className="w-3 h-3" />
                                </span>
                            )}
                            <span className="avatar-modal__item-name">{avatar.name}</span>
                        </button>
                    ))}
                </div>

                <div className="avatar-modal__footer">
                    {showSuccess ? (
                        <div className="avatar-modal__success" role="status">
                            🎉 Đã đổi avatar thành công!
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || !hasChanged}
                            className="avatar-modal__save-btn"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                                    Đang lưu...
                                </>
                            ) : (
                                'Lưu thay đổi'
                            )}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default AvatarSelectorModal;
