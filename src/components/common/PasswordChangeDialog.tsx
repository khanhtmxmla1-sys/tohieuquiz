import React, { useState } from 'react';
import { KeyRound, Loader2, Lock } from 'lucide-react';
import { callApi } from '../../services/apiAdapter';
import { showError, showSuccess } from '../../utils/toast';

interface PasswordChangeDialogProps {
    forced?: boolean;
    requireCurrentPassword?: boolean;
    onComplete: () => void;
    onCancel?: () => void;
}

const PasswordChangeDialog: React.FC<PasswordChangeDialogProps> = ({
    forced = false,
    requireCurrentPassword,
    onComplete,
    onCancel,
}) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const asksForCurrentPassword = requireCurrentPassword ?? !forced;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (newPassword.length < 10) return showError('Mật khẩu mới phải có ít nhất 10 ký tự.');
        if (newPassword !== confirmPassword) return showError('Hai lần nhập mật khẩu chưa khớp.');
        setSaving(true);
        try {
            const response = await callApi<{ status: string }>('change_password', {
                currentPassword: asksForCurrentPassword ? currentPassword : undefined,
                newPassword,
            });
            if (response.status !== 'success') throw new Error('Máy chủ không tạo được phiên đăng nhập mới.');
            showSuccess('Đổi mật khẩu thành công.');
            onComplete();
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="password-change-title">
            <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start gap-3">
                    <div className="rounded-2xl bg-blue-100 p-3 text-blue-700"><KeyRound className="h-6 w-6" /></div>
                    <div>
                        <h2 id="password-change-title" className="text-xl font-bold text-slate-900">
                            {forced ? 'Bạn cần đổi mật khẩu' : 'Đổi mật khẩu'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {forced ? 'Mật khẩu hiện tại là mật khẩu tạm hoặc thuộc định dạng cũ. Hãy đặt mật khẩu mới để tiếp tục.' : 'Mật khẩu mới sẽ đăng xuất các phiên cũ của tài khoản.'}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {asksForCurrentPassword && (
                        <label className="block text-sm font-semibold text-slate-700">
                            Mật khẩu hiện tại
                            <input type="password" autoComplete="current-password" required value={currentPassword}
                                onChange={(event) => setCurrentPassword(event.target.value)}
                                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        </label>
                    )}
                    <label className="block text-sm font-semibold text-slate-700">
                        Mật khẩu mới
                        <div className="relative mt-1">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                            <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-300 pl-10 pr-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                        </div>
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                        Nhập lại mật khẩu mới
                        <input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </label>
                </div>

                <div className="mt-6 flex gap-3">
                    {onCancel && <button type="button" onClick={onCancel} className="h-11 flex-1 rounded-xl border border-slate-300 font-semibold text-slate-700">Hủy</button>}
                    <button type="submit" disabled={saving} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-60">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Lưu mật khẩu
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PasswordChangeDialog;
