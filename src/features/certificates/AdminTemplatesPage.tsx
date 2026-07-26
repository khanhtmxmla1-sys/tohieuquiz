import React, { useState, useCallback } from 'react';
import { LayoutTemplate, Plus, RefreshCw, AlertCircle, Inbox, ToggleLeft, ToggleRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminTemplates } from './useAdminTemplates';
import type { AdminTemplate } from './useAdminTemplates';
import TemplateFieldEditor from './TemplateFieldEditor';
import type { FieldConfig } from './certificates.types';
import { showSuccess, showError } from '../../utils/toast';

const AdminTemplatesPage: React.FC = () => {
    const { templates, isLoading, error, refetch, createTemplate, updateTemplate, parseFields } = useAdminTemplates();

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newBgKey, setNewBgKey] = useState('');
    const [newFields, setNewFields] = useState<FieldConfig[]>([]);
    const [isCreating, setIsCreating] = useState(false);

    // Edit inline
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editFields, setEditFields] = useState<FieldConfig[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const handleCreate = useCallback(async () => {
        if (!newName.trim()) { showError('Nhập tên mẫu'); return; }
        if (!newBgKey.trim()) { showError('Nhập R2 key ảnh nền'); return; }
        setIsCreating(true);
        try {
            await createTemplate({
                name: newName.trim(),
                bg_image_r2_key: newBgKey.trim(),
                fields_config: JSON.stringify(newFields),
            });
            showSuccess('Tạo mẫu thành công!');
            setShowCreate(false);
            setNewName(''); setNewBgKey(''); setNewFields([]);
            refetch();
        } catch (e: unknown) {
            showError(e instanceof Error ? e.message : 'Tạo thất bại');
        } finally {
            setIsCreating(false);
        }
    }, [newName, newBgKey, newFields, createTemplate, refetch]);

    const startEdit = useCallback((t: AdminTemplate) => {
        setEditId(t.id);
        setEditName(t.name);
        setEditFields(parseFields(t.fields_config));
    }, [parseFields]);

    const handleSaveEdit = useCallback(async () => {
        if (!editId) return;
        setIsSaving(true);
        try {
            await updateTemplate(editId, {
                name: editName.trim(),
                fields_config: JSON.stringify(editFields),
            });
            showSuccess('Đã lưu!');
            setEditId(null);
            refetch();
        } catch (e: unknown) {
            showError(e instanceof Error ? e.message : 'Lưu thất bại');
        } finally {
            setIsSaving(false);
        }
    }, [editId, editName, editFields, updateTemplate, refetch]);

    const toggleActive = useCallback(async (t: AdminTemplate) => {
        try {
            await updateTemplate(t.id, { is_active: t.is_active ? 0 : 1 });
            refetch();
        } catch (e: unknown) {
            showError(e instanceof Error ? e.message : 'Cập nhật thất bại');
        }
    }, [updateTemplate, refetch]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow">
                        <LayoutTemplate size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Mẫu Chứng nhận</h2>
                        <p className="text-xs text-slate-500">Quản lý template cho toàn trường</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={refetch} disabled={isLoading}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-50">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setShowCreate((v) => !v)}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                    >
                        <Plus size={15} /> Tạo mẫu
                    </button>
                </div>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-cyan-900">Tạo mẫu mới</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên mẫu</label>
                            <input value={newName} onChange={(e) => setNewName(e.target.value)}
                                placeholder="Vd: Mẫu Toán Hè 2026"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">R2 Key ảnh nền</label>
                            <input value={newBgKey} onChange={(e) => setNewBgKey(e.target.value)}
                                placeholder="cert-backgrounds/template1.png"
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">Vị trí các trường văn bản</label>
                        <TemplateFieldEditor value={newFields} onChange={setNewFields} />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowCreate(false)}
                            className="px-4 py-2 text-sm text-slate-600 hover:bg-white rounded-xl border border-slate-200">
                            Huỷ
                        </button>
                        <button onClick={handleCreate} disabled={isCreating}
                            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
                            {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Tạo mẫu
                        </button>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-700">Không thể tải dữ liệu</p>
                        <p className="text-xs text-red-500 mt-0.5">{error}</p>
                        <button onClick={refetch} className="mt-2 text-xs text-red-600 underline">Thử lại</button>
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && (
                <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                            <div className="h-4 bg-slate-200 rounded w-40 mb-2" />
                            <div className="h-3 bg-slate-100 rounded w-24" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty */}
            {!isLoading && !error && templates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mb-4">
                        <Inbox size={36} className="text-violet-300" />
                    </div>
                    <h3 className="text-base font-bold text-slate-700 mb-1">Chưa có mẫu nào</h3>
                    <p className="text-sm text-slate-400 max-w-xs">Tạo mẫu chứng nhận đầu tiên để giáo viên có thể cấp phát cho học sinh.</p>
                </div>
            )}

            {/* Template list */}
            {!isLoading && templates.length > 0 && (
                <div className="space-y-3">
                    {templates.map((t) => (
                        <div key={t.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        {editId === t.id ? (
                                            <input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="text-sm font-semibold border-b border-violet-300 bg-transparent focus:outline-none w-full mb-1"
                                            />
                                        ) : (
                                            <h3 className="font-semibold text-slate-800 text-sm">{t.name}</h3>
                                        )}
                                        <p className="text-xs text-slate-400 mt-0.5 truncate">{t.bg_image_r2_key}</p>
                                        <p className="text-xs text-slate-400">
                                            {parseFields(t.fields_config).length} trường · {new Date(t.created_at).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Toggle active */}
                                        <button onClick={() => toggleActive(t)} title={t.is_active ? 'Đang bật' : 'Đang tắt'}
                                            className={`transition-colors ${t.is_active ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}>
                                            {t.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                        </button>
                                        {/* Edit toggle */}
                                        <button
                                            onClick={() => editId === t.id ? setEditId(null) : startEdit(t)}
                                            className="text-xs font-medium text-violet-600 hover:text-cyan-800 flex items-center gap-1"
                                        >
                                            {editId === t.id ? <><ChevronUp size={13} /> Đóng</> : <><ChevronDown size={13} /> Sửa</>}
                                        </button>
                                    </div>
                                </div>

                                {/* Inline edit fields */}
                                {editId === t.id && (
                                    <div className="mt-4 space-y-3">
                                        <label className="block text-xs font-semibold text-slate-700">Vị trí các trường văn bản</label>
                                        <TemplateFieldEditor value={editFields} onChange={setEditFields} />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditId(null)}
                                                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200">Huỷ</button>
                                            <button onClick={handleSaveEdit} disabled={isSaving}
                                                className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-60">
                                                {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                                                Lưu thay đổi
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminTemplatesPage;
