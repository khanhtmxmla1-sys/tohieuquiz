import React, { useState } from 'react';
import { X, FileDown, Loader2, FileText, LayoutGrid, Minus, BookOpen } from 'lucide-react';
import type { Quiz } from '../../types';
import {
    exportWorksheet,
    type WorksheetFormat,
    type WorksheetPaperStyle,
    type WorksheetAnswerKey,
} from '../../services/worksheetExportService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorksheetExportModalProps {
    quiz: Quiz;
    onClose: () => void;
}

// ─── Option Sets ──────────────────────────────────────────────────────────────

const FORMAT_OPTIONS: { value: WorksheetFormat; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'pdf', label: 'PDF', desc: 'Tải về & in ngay', icon: <FileText className="w-4 h-4" /> },
    { value: 'docx', label: 'Word (.docx)', desc: 'Có thể chỉnh trước khi in', icon: <BookOpen className="w-4 h-4" /> },
];

const PAPER_OPTIONS: { value: WorksheetPaperStyle; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'grid-5mm', label: 'Ô ly 5mm', desc: 'Vuông 5×5mm chuẩn', icon: <LayoutGrid className="w-4 h-4" /> },
    { value: 'lined-wide', label: 'Kẻ ngang', desc: 'Dòng kẻ rộng', icon: <Minus className="w-4 h-4" /> },
    { value: 'blank', label: 'Trắng', desc: 'Không có dòng kẻ', icon: <FileDown className="w-4 h-4" /> },
];

const ANSWER_OPTIONS: { value: WorksheetAnswerKey; label: string; desc: string }[] = [
    { value: 'none', label: 'Không kèm đáp án', desc: 'Học sinh không được biết đáp án' },
    { value: 'separate', label: 'Kèm trang đáp án', desc: 'In riêng trang đáp án ở cuối file' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const WorksheetExportModal: React.FC<WorksheetExportModalProps> = ({ quiz, onClose }) => {
    const [format, setFormat] = useState<WorksheetFormat>('pdf');
    const [paperStyle, setPaperStyle] = useState<WorksheetPaperStyle>('grid-5mm');
    const [answerKey, setAnswerKey] = useState<WorksheetAnswerKey>('none');
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        setIsExporting(true);
        setError(null);
        try {
            await exportWorksheet({
                quiz,
                format,
                paperStyle,
                answerKey,
                schoolName: 'TôHiệuQuiz',
            });
            onClose();
        } catch (err) {
            console.error('Worksheet export failed:', err);
            setError('Xuất file thất bại. Vui lòng thử lại.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <FileDown className="w-5 h-5" />
                            Xuất Vở Bài Tập
                        </h3>
                        <p className="text-emerald-100 text-sm mt-0.5 truncate max-w-[300px]">{quiz.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Format */}
                    <fieldset>
                        <legend className="block text-sm font-semibold text-gray-700 mb-2">📄 Định dạng file</legend>
                        <div className="grid grid-cols-2 gap-2">
                            {FORMAT_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setFormat(opt.value)}
                                    className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                                        format === opt.value
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <span className={`mt-0.5 ${format === opt.value ? 'text-emerald-600' : 'text-gray-500'}`}>
                                        {opt.icon}
                                    </span>
                                    <span>
                                        <span className={`block text-sm font-semibold ${format === opt.value ? 'text-emerald-700' : 'text-gray-700'}`}>
                                            {opt.label}
                                        </span>
                                        <span className="block text-xs text-gray-500">{opt.desc}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    {/* Paper style — only relevant for PDF */}
                    {format === 'pdf' && (
                        <fieldset>
                            <legend className="block text-sm font-semibold text-gray-700 mb-2">📝 Kiểu giấy (nền trang)</legend>
                            <div className="grid grid-cols-3 gap-2">
                                {PAPER_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPaperStyle(opt.value)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                                            paperStyle === opt.value
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <span className={`${paperStyle === opt.value ? 'text-emerald-600' : 'text-gray-500'}`}>
                                            {opt.icon}
                                        </span>
                                        <span className={`block text-xs font-semibold ${paperStyle === opt.value ? 'text-emerald-700' : 'text-gray-700'}`}>
                                            {opt.label}
                                        </span>
                                        <span className="block text-xs text-gray-400">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    )}

                    {/* Answer key */}
                    <fieldset>
                        <legend className="block text-sm font-semibold text-gray-700 mb-2">🗝️ Đáp án</legend>
                        <div className="space-y-2">
                            {ANSWER_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                        answerKey === opt.value
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="answerKey"
                                        value={opt.value}
                                        checked={answerKey === opt.value}
                                        onChange={() => setAnswerKey(opt.value)}
                                        className="mt-0.5 accent-emerald-600"
                                    />
                                    <span>
                                        <span className={`block text-sm font-semibold ${answerKey === opt.value ? 'text-emerald-700' : 'text-gray-700'}`}>
                                            {opt.label}
                                        </span>
                                        <span className="block text-xs text-gray-500">{opt.desc}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* Error */}
                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isExporting}
                            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={isExporting}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang tạo file...
                                </>
                            ) : (
                                <>
                                    <FileDown className="w-4 h-4" />
                                    Tải xuống
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorksheetExportModal;
