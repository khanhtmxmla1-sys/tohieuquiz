import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, KeyRound, Loader2, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { callApi } from '../../services/apiAdapter';
import { showConfirm, showError, showSuccess } from '../../utils/toast';

type TeacherStatus = 'ACTIVE' | 'DISABLED';
interface TeacherRecord {
    username: string;
    fullName: string;
    full_name: string;
    role: 'admin' | 'teacher';
    class: string;
    status: TeacherStatus;
    classCount: number;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
}

interface TeacherListResponse {
    status: string;
    data: { items: TeacherRecord[]; page: number; pageSize: number; total: number };
}

interface TeacherForm { username: string; fullName: string; role: 'admin' | 'teacher'; teacherClass: string }
interface TemporaryCredential { username: string; fullName: string; temporaryPassword: string }
const EMPTY_FORM: TeacherForm = { username: '', fullName: '', role: 'teacher', teacherClass: '' };

const TeacherManagementTab: React.FC = () => {
    const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [editing, setEditing] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [temporaryPassword, setTemporaryPassword] = useState('');
    const [bulkCredentials, setBulkCredentials] = useState<TemporaryCredential[]>([]);
    const [disableTarget, setDisableTarget] = useState<TeacherRecord | null>(null);
    const [transferTo, setTransferTo] = useState('');
    const [disableReason, setDisableReason] = useState('');

    const fetchTeachers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await callApi<TeacherListResponse>('get_teachers', {
                search, role: roleFilter, status: statusFilter, page, pageSize: 25,
            });
            setTeachers(response.data?.items || []);
            setTotal(response.data?.total || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải danh sách giáo viên.');
        } finally {
            setLoading(false);
        }
    }, [page, roleFilter, search, statusFilter]);

    useEffect(() => { void fetchTeachers(); }, [fetchTeachers]);
    useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

    const activeRecipients = useMemo(
        () => teachers.filter((teacher) => teacher.status === 'ACTIVE' && teacher.username !== disableTarget?.username),
        [teachers, disableTarget],
    );

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEdit = (teacher: TeacherRecord) => {
        setEditing(teacher.username);
        setForm({ username: teacher.username, fullName: teacher.fullName || teacher.full_name, role: teacher.role, teacherClass: teacher.class || '' });
        setShowForm(true);
    };

    const saveTeacher = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.username.trim() || !form.fullName.trim()) return showError('Vui lòng nhập đủ tên và username.');
        setSaving(true);
        try {
            if (editing) {
                await callApi('update_teacher', { username: editing, fullName: form.fullName, role: form.role, teacherClass: form.teacherClass });
                showSuccess('Đã cập nhật giáo viên.');
            } else {
                const response = await callApi<{ data?: { temporaryPassword?: string } }>('create_teacher', form);
                setTemporaryPassword(response.data?.temporaryPassword || '');
                showSuccess('Đã tạo tài khoản.');
            }
            setShowForm(false);
            await fetchTeachers();
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Không thể lưu tài khoản.');
        } finally {
            setSaving(false);
        }
    };

    const resetPassword = (teacher: TeacherRecord) => showConfirm({
        message: `Tạo mật khẩu tạm mới cho ${teacher.fullName || teacher.full_name}? Tất cả phiên hiện tại sẽ bị đăng xuất.`,
        confirmLabel: 'Tạo mật khẩu tạm',
        onConfirm: async () => {
            try {
                const response = await callApi<{ data?: { temporaryPassword?: string } }>('reset_teacher_password', { username: teacher.username });
                setTemporaryPassword(response.data?.temporaryPassword || '');
                await fetchTeachers();
            } catch (err) {
                showError(err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu.');
            }
        },
    });

    const resetAllPasswords = () => showConfirm({
        message: 'Đặt lại mật khẩu của toàn bộ tài khoản giáo viên? Tất cả phiên hiện tại sẽ bị thu hồi. Admin không bị thay đổi.',
        confirmLabel: 'Reset toàn bộ giáo viên',
        onConfirm: async () => {
            setSaving(true);
            try {
                const response = await callApi<{ data?: { count?: number; credentials?: TemporaryCredential[] } }>('reset_all_teacher_passwords');
                const credentials = response.data?.credentials || [];
                if (credentials.length === 0) throw new Error('Máy chủ không trả về danh sách mật khẩu tạm.');
                setBulkCredentials(credentials);
                showSuccess(`Đã reset ${response.data?.count || credentials.length} tài khoản giáo viên.`);
                await fetchTeachers();
            } catch (err) {
                showError(err instanceof Error ? err.message : 'Không thể reset toàn bộ mật khẩu giáo viên.');
            } finally {
                setSaving(false);
            }
        },
    });

    const disableTeacher = async () => {
        if (!disableTarget) return;
        if (disableTarget.classCount > 0 && !transferTo) return showError('Vui lòng chọn giáo viên nhận lớp.');
        setSaving(true);
        try {
            await callApi('disable_teacher', {
                username: disableTarget.username,
                transferTo: transferTo || undefined,
                reason: disableReason,
            });
            setDisableTarget(null);
            setTransferTo('');
            setDisableReason('');
            showSuccess('Đã vô hiệu hóa tài khoản.');
            await fetchTeachers();
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Không thể vô hiệu hóa tài khoản.');
        } finally {
            setSaving(false);
        }
    };

    const enableTeacher = (teacher: TeacherRecord) => showConfirm({
        message: `Kích hoạt lại tài khoản ${teacher.username}? Các lớp đã chuyển sẽ không tự động chuyển lại.`,
        confirmLabel: 'Kích hoạt',
        onConfirm: async () => {
            try {
                await callApi('enable_teacher', { username: teacher.username });
                showSuccess('Đã kích hoạt tài khoản.');
                await fetchTeachers();
            } catch (err) {
                showError(err instanceof Error ? err.message : 'Không thể kích hoạt tài khoản.');
            }
        },
    });

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Quản lý giáo viên</h2>
                    <p className="text-sm text-slate-500">Quản lý quyền, trạng thái, lớp phụ trách và mật khẩu tạm.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button disabled={saving} onClick={resetAllPasswords} className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-sm font-semibold text-white disabled:opacity-50"><KeyRound className="h-4 w-4" />Reset toàn bộ mật khẩu</button>
                    <button onClick={() => void fetchTeachers()} className="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold"><RefreshCw className="h-4 w-4" />Làm mới</button>
                    <button onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Thêm giáo viên</button>
                </div>
            </div>

            <div className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[1fr_180px_180px]">
                <label className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm họ tên hoặc username" className="h-10 w-full rounded-xl border pl-10 pr-3" />
                </label>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-xl border px-3">
                    <option value="">Mọi vai trò</option><option value="teacher">Giáo viên</option><option value="admin">Quản trị viên</option>
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border px-3">
                    <option value="">Mọi trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Đã vô hiệu hóa</option>
                </select>
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <button onClick={() => void fetchTeachers()} className="ml-2 font-bold underline">Thử lại</button></div>}
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                {loading ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : teachers.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">Không có giáo viên phù hợp bộ lọc.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[900px] w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>
                                <th className="px-4 py-3">Giáo viên</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Lớp</th>
                                <th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Đăng nhập cuối</th><th className="px-4 py-3 text-right">Thao tác</th>
                            </tr></thead>
                            <tbody className="divide-y">
                                {teachers.map((teacher) => <tr key={teacher.username} className="align-top hover:bg-slate-50/60">
                                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{teacher.fullName || teacher.full_name}</div><div className="font-mono text-xs text-slate-500">{teacher.username}</div></td>
                                    <td className="px-4 py-3">{teacher.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}</td>
                                    <td className="px-4 py-3">{teacher.classCount} lớp</td>
                                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${teacher.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-emerald-900'}`}>{teacher.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span>{teacher.mustChangePassword && <div className="mt-1 text-xs text-amber-700">Cần đổi mật khẩu</div>}</td>
                                    <td className="px-4 py-3 text-slate-600">{teacher.lastLoginAt ? new Date(teacher.lastLoginAt).toLocaleString('vi-VN') : 'Chưa có'}</td>
                                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                                        <button onClick={() => openEdit(teacher)} title="Sửa" aria-label={`Sửa ${teacher.username}`} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button>
                                        <button onClick={() => resetPassword(teacher)} title="Đặt lại mật khẩu" aria-label={`Đặt lại mật khẩu ${teacher.username}`} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><KeyRound className="h-4 w-4" /></button>
                                        {teacher.status === 'ACTIVE' ? <button onClick={() => setDisableTarget(teacher)} title="Vô hiệu hóa" aria-label={`Vô hiệu hóa ${teacher.username}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Ban className="h-4 w-4" /></button>
                                            : <button onClick={() => enableTeacher(teacher)} title="Kích hoạt" aria-label={`Kích hoạt ${teacher.username}`} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>}
                                    </div></td>
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span>Tổng cộng {total} tài khoản</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border bg-white px-3 py-1 disabled:opacity-40">Trước</button><span className="px-2 py-1">Trang {page}</span><button disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)} className="rounded-lg border bg-white px-3 py-1 disabled:opacity-40">Sau</button></div>
                </div>
            </div>

            {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={saveTeacher} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{editing ? 'Sửa giáo viên' : 'Thêm giáo viên'}</h3><button type="button" onClick={() => setShowForm(false)} aria-label="Đóng"><X /></button></div>
                <label className="block text-sm font-semibold">Họ tên<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} className="mt-1 h-10 w-full rounded-xl border px-3" /></label>
                <label className="block text-sm font-semibold">Username<input required disabled={Boolean(editing)} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="mt-1 h-10 w-full rounded-xl border px-3 disabled:bg-slate-100" /></label>
                <label className="block text-sm font-semibold">Vai trò<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as 'teacher' | 'admin' })} className="mt-1 h-10 w-full rounded-xl border px-3"><option value="teacher">Giáo viên</option><option value="admin">Quản trị viên</option></select></label>
                <label className="block text-sm font-semibold">Lớp mô tả (dữ liệu cũ)<input value={form.teacherClass} onChange={(event) => setForm({ ...form, teacherClass: event.target.value })} className="mt-1 h-10 w-full rounded-xl border px-3" /></label>
                {!editing && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">Hệ thống sẽ tạo mật khẩu tạm và chỉ hiển thị một lần sau khi lưu.</p>}
                <button disabled={saving} className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu tài khoản'}</button>
            </form></div>}

            {temporaryPassword && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
                <KeyRound className="mx-auto h-10 w-10 text-amber-600" /><h3 className="mt-3 text-xl font-bold">Mật khẩu tạm — chỉ hiển thị một lần</h3>
                <div className="my-5 select-all rounded-xl bg-slate-900 p-4 font-mono text-lg font-bold tracking-wider text-white">{temporaryPassword}</div>
                <button onClick={async () => { await navigator.clipboard.writeText(temporaryPassword); showSuccess('Đã sao chép mật khẩu.'); }} className="mr-2 rounded-xl border px-4 py-2 font-semibold">Sao chép</button>
                <button onClick={() => setTemporaryPassword('')} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Tôi đã lưu lại</button>
            </div></div>}

            {bulkCredentials.length > 0 && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4"><div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold text-slate-900">Mật khẩu tạm — chỉ hiển thị một lần</h3>
                <p className="mt-1 text-sm text-red-600">Hãy sao chép và lưu an toàn trước khi đóng cửa sổ này.</p>
                <div className="mt-4 max-h-[55vh] overflow-auto rounded-xl border"><table className="w-full text-sm"><thead className="sticky top-0 bg-slate-100 text-left"><tr><th className="px-3 py-2">Giáo viên</th><th className="px-3 py-2">Username</th><th className="px-3 py-2">Mật khẩu tạm</th></tr></thead><tbody className="divide-y">
                    {bulkCredentials.map((credential) => <tr key={credential.username}><td className="px-3 py-2">{credential.fullName}</td><td className="px-3 py-2 font-mono">{credential.username}</td><td className="select-all px-3 py-2 font-mono font-bold">{credential.temporaryPassword}</td></tr>)}
                </tbody></table></div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button onClick={async () => { await navigator.clipboard.writeText(bulkCredentials.map((item) => `${item.username}\t${item.temporaryPassword}`).join('\n')); showSuccess('Đã sao chép toàn bộ danh sách.'); }} className="rounded-xl border px-4 py-2 font-semibold">Sao chép toàn bộ</button>
                    <button onClick={() => setBulkCredentials([])} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Tôi đã lưu danh sách</button>
                </div>
            </div></div>}

            {disableTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold">Vô hiệu hóa {disableTarget.fullName || disableTarget.full_name}</h3>
                <p className="text-sm text-slate-600">Tài khoản sẽ bị đăng xuất khỏi mọi thiết bị. Dữ liệu lịch sử được giữ nguyên.</p>
                {disableTarget.classCount > 0 && <label className="block text-sm font-semibold">Chuyển {disableTarget.classCount} lớp cho<select required value={transferTo} onChange={(event) => setTransferTo(event.target.value)} className="mt-1 h-10 w-full rounded-xl border px-3"><option value="">Chọn giáo viên nhận lớp</option>{activeRecipients.map((teacher) => <option key={teacher.username} value={teacher.username}>{teacher.fullName || teacher.full_name}</option>)}</select></label>}
                <label className="block text-sm font-semibold">Lý do<input value={disableReason} onChange={(event) => setDisableReason(event.target.value)} className="mt-1 h-10 w-full rounded-xl border px-3" /></label>
                <div className="flex gap-3"><button onClick={() => setDisableTarget(null)} className="h-10 flex-1 rounded-xl border">Hủy</button><button disabled={saving} onClick={() => void disableTeacher()} className="h-10 flex-1 rounded-xl bg-red-600 font-semibold text-white">Vô hiệu hóa</button></div>
            </div></div>}
        </div>
    );
};

export default TeacherManagementTab;
