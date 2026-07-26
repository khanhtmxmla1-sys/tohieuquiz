import React, { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import type { FieldConfig } from './certificates.types';

const FIELD_KEYS: FieldConfig['key'][] = [
    'student_name', 'score', 'quiz_title', 'date', 'teacher_name', 'custom_note', 'static_text',
];
const FIELD_LABELS: Record<FieldConfig['key'], string> = {
    student_name: 'Tên học sinh',
    score: 'Điểm số',
    quiz_title: 'Tên bài thi',
    date: 'Ngày cấp',
    teacher_name: 'Giáo viên',
    custom_note: 'Ghi chú',
    static_text: 'Văn bản cố định',
};

interface Props {
    value: FieldConfig[];
    onChange: (fields: FieldConfig[]) => void;
}

const defaultField = (): FieldConfig => ({
    key: 'student_name',
    x: 50,
    y: 50,
    fontSize: 24,
    fontWeight: 'normal',
    color: '#1e293b',
    align: 'center',
    maxWidth: 400,
});

const TemplateFieldEditor: React.FC<Props> = ({ value, onChange }) => {
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    const add = useCallback(() => {
        onChange([...value, defaultField()]);
        setOpenIdx(value.length);
    }, [value, onChange]);

    const remove = useCallback((idx: number) => {
        onChange(value.filter((_, i) => i !== idx));
        setOpenIdx(null);
    }, [value, onChange]);

    const update = useCallback((idx: number, patch: Partial<FieldConfig>) => {
        onChange(value.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    }, [value, onChange]);

    return (
        <div className="space-y-2">
            {value.map((field, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Row header */}
                    <div
                        className="flex items-center justify-between px-3 py-2 bg-slate-50 cursor-pointer hover:bg-slate-100"
                        onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">{FIELD_LABELS[field.key]}</span>
                            <span className="text-xs text-slate-400">({field.x},{field.y}) {field.fontSize}px</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); remove(idx); }}
                                className="p-1 text-red-400 hover:text-red-600"
                            >
                                <Trash2 size={13} />
                            </button>
                            <ChevronDown
                                size={14}
                                className={`text-slate-400 transition-transform ${openIdx === idx ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </div>

                    {/* Expanded editor */}
                    {openIdx === idx && (
                        <div className="p-3 grid grid-cols-2 gap-3 bg-white">
                            {/* Key */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Trường dữ liệu</label>
                                <select
                                    value={field.key}
                                    onChange={(e) => update(idx, { key: e.target.value as FieldConfig['key'] })}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                >
                                    {FIELD_KEYS.map((k) => (
                                        <option key={k} value={k}>{FIELD_LABELS[k]}</option>
                                    ))}
                                </select>
                            </div>
                            {/* X, Y */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">X (px)</label>
                                <input type="number" value={field.x} onChange={(e) => update(idx, { x: Number(e.target.value) })}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Y (px)</label>
                                <input type="number" value={field.y} onChange={(e) => update(idx, { y: Number(e.target.value) })}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            {/* FontSize, Color */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Cỡ chữ (px)</label>
                                <input type="number" value={field.fontSize} onChange={(e) => update(idx, { fontSize: Number(e.target.value) })}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Màu chữ</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={field.color ?? '#1e293b'} onChange={(e) => update(idx, { color: e.target.value })}
                                        className="h-8 w-10 border border-slate-200 rounded cursor-pointer" />
                                    <span className="text-xs text-slate-500">{field.color ?? '#1e293b'}</span>
                                </div>
                            </div>
                            {/* FontWeight, Align */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Đậm</label>
                                <select value={field.fontWeight ?? 'normal'} onChange={(e) => update(idx, { fontWeight: e.target.value as 'normal' | 'bold' })}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                                    <option value="normal">Normal</option>
                                    <option value="bold">Bold</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Căn lề</label>
                                <select value={field.align ?? 'center'} onChange={(e) => update(idx, { align: e.target.value as 'left' | 'center' | 'right' })}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                                    <option value="left">Trái</option>
                                    <option value="center">Giữa</option>
                                    <option value="right">Phải</option>
                                </select>
                            </div>
                            {/* MaxWidth */}
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Chiều rộng tối đa (px)</label>
                                <input type="number" value={field.maxWidth ?? 400} onChange={(e) => update(idx, { maxWidth: Number(e.target.value) })}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                        </div>
                    )}
                </div>
            ))}

            <button
                onClick={add}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 mt-1"
            >
                <Plus size={13} /> Thêm trường văn bản
            </button>
        </div>
    );
};

export default TemplateFieldEditor;
