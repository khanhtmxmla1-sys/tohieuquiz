import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, LogOut, MonitorCog } from 'lucide-react';
import { callApi } from '../../services/apiAdapter';
import { showConfirm, showError, showSuccess } from '../../utils/toast';
import { useAuthStore } from '../../../stores/authStore';
import PasswordChangeDialog from '../common/PasswordChangeDialog';
import { SecuritySessionsPanel } from '../../features/security/SecuritySessionsPanel';

interface Profile {
    username: string;
    fullName: string;
    role: string;
    status: string;
    lastLoginAt: string | null;
    classes: Array<{ id: string; name: string }>;
}

const PersonalSettingsTab: React.FC = () => {
    const authStore = useAuthStore();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [compact, setCompact] = useState(() => localStorage.getItem('tohieuquiz_compact_dashboard') === 'true');

    const load = async () => {
        setLoading(true); setError('');
        try {
            const response = await callApi<{ data: Profile }>('get_account_profile');
            setProfile(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải hồ sơ.');
        } finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, []);

    const toggleCompact = (value: boolean) => {
        setCompact(value);
        localStorage.setItem('tohieuquiz_compact_dashboard', String(value));
        window.dispatchEvent(new CustomEvent('tohieuquiz:dashboard-preference', { detail: { compact: value } }));
    };

    const logoutAll = () => showConfirm({
        message: 'Đăng xuất tài khoản khỏi tất cả thiết bị? Bạn sẽ cần đăng nhập lại.',
        confirmLabel: 'Đăng xuất tất cả', destructive: true,
        onConfirm: async () => {
            try {
                await callApi('logout_all');
                authStore.logout();
                showSuccess('Đã thu hồi tất cả phiên đăng nhập.');
            } catch (err) { showError(err instanceof Error ? err.message : 'Không thể thu hồi phiên.'); }
        },
    });

    if (loading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>;
    if (error || !profile) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error || 'Không có dữ liệu.'} <button onClick={() => void load()} className="font-bold underline">Thử lại</button></div>;

    return <div className="mx-auto max-w-3xl space-y-5">
        <div><h2 className="text-2xl font-bold text-slate-900">Cài đặt cá nhân</h2><p className="text-sm text-slate-500">Hồ sơ chính thức do quản trị viên quản lý.</p></div>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="text-xs font-bold uppercase text-slate-400">Họ tên</dt><dd className="mt-1 font-semibold">{profile.fullName}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Username</dt><dd className="mt-1 font-mono">{profile.username}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Vai trò</dt><dd className="mt-1">{profile.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Đăng nhập cuối</dt><dd className="mt-1">{profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString('vi-VN') : 'Chưa có'}</dd></div>
            </dl>
            <div className="mt-5"><div className="text-xs font-bold uppercase text-blue-900">Lớp đang phụ trách</div><div className="mt-2 flex flex-wrap gap-2">{profile.classes.length ? profile.classes.map((item) => <span key={item.id} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{item.name}</span>) : <span className="text-sm text-blue-900">Chưa có lớp</span>}</div></div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Bảo mật</h3><div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => setShowPassword(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white"><KeyRound className="h-4 w-4" />Đổi mật khẩu</button>
                <button onClick={logoutAll} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 font-semibold text-red-700"><LogOut className="h-4 w-4" />Đăng xuất mọi thiết bị</button>
            </div>
        </section>
        <SecuritySessionsPanel />
        <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><div className="flex gap-3"><MonitorCog className="h-5 w-5 text-slate-500" /><div><h3 className="font-bold">Giao diện gọn</h3><p className="text-sm text-slate-500">Giảm khoảng cách hiển thị trên thiết bị này.</p></div></div><input type="checkbox" checked={compact} onChange={(event) => toggleCompact(event.target.checked)} className="h-5 w-5" aria-label="Bật giao diện gọn" /></div></section>
        {showPassword && <PasswordChangeDialog onCancel={() => setShowPassword(false)} onComplete={() => { authStore.loginSuccess(profile.username, profile.fullName, profile.role === 'admin', authStore.teacherClass); setShowPassword(false); }} />}
    </div>;
};

export default PersonalSettingsTab;
