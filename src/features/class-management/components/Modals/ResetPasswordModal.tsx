import React, { useMemo, useRef, useState } from 'react';
import { KeyRound, RefreshCw, X } from 'lucide-react';
import { Button } from '../../../../components/common';
import type { Student } from '../../types';
import { generateTemporaryStudentPassword } from '../../utils/studentCredentials';
import { useDialogFocus } from '../../../../hooks/useDialogFocus';

interface ResetPasswordModalProps {
    student: Student;
    isSaving: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (password: string) => Promise<void>;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ student, isSaving, error, onClose, onSubmit }) => {
    const initialPassword = useMemo(() => generateTemporaryStudentPassword(10), []);
    const [password, setPassword] = useState(initialPassword);
    const dialogRef = useRef<HTMLDivElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const requestClose = () => {
        if (!isSaving) onClose();
    };

    useDialogFocus({
        isOpen: true,
        dialogRef,
        initialFocusRef: passwordInputRef,
        onClose: requestClose,
    });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reset-password-title"
                tabIndex={-1}
                className="bg-white w-full md:max-w-md h-dvh md:h-auto p-5 md:p-6 md:rounded-2xl shadow-xl"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id="reset-password-title" className="text-xl font-bold text-gray-800">Đặt lại mật khẩu</h2>
                        <p className="text-sm text-gray-500 mt-1">Học sinh: {student.fullName}</p>
                    </div>
                    <button type="button" onClick={requestClose} disabled={isSaving} className="p-2 rounded-full hover:bg-gray-100" aria-label="Đóng"><X className="w-5 h-5" /></button>
                </div>
                {error && <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}
                <label className="block text-sm font-medium text-gray-700 mt-5 mb-1" htmlFor="temporary-password">Mật khẩu tạm thời</label>
                <div className="flex gap-2">
                    <input ref={passwordInputRef} id="temporary-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-w-0 flex-1 px-4 py-3 border rounded-xl font-mono" minLength={6} maxLength={64} />
                    <button type="button" onClick={() => setPassword(generateTemporaryStudentPassword(10))} className="h-12 w-12 inline-flex items-center justify-center rounded-xl bg-gray-100 text-gray-600" aria-label="Sinh mật khẩu khác"><RefreshCw className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-amber-700 mt-2">Hãy sao chép và gửi riêng cho học sinh. Không dùng mật khẩu mặc định chung.</p>
                <div className="flex gap-3 mt-6">
                    <Button variant="secondary" className="flex-1" onClick={requestClose} disabled={isSaving}>Hủy</Button>
                    <Button variant="primary" className="flex-1" onClick={() => onSubmit(password.trim())} disabled={isSaving || password.trim().length < 6} icon={<KeyRound className="w-4 h-4" />}>Xác nhận</Button>
                </div>
            </div>
        </div>
    );
};
