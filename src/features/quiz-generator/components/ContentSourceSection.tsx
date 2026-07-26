import React from 'react';
import { FileText, Upload, FileCheck, X } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

interface ContentSourceSectionProps {
    content: string;
    setContent: (v: string) => void;
    uploadedFile: File | null;
    setUploadedFile: (v: File | null) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    customPrompt: string;
    setCustomPrompt: (v: string) => void;
    isOpen: boolean;
    onToggle: (id: string) => void;
}

const ContentSourceSection: React.FC<ContentSourceSectionProps> = ({
    content, setContent, uploadedFile, setUploadedFile, fileInputRef,
    customPrompt, setCustomPrompt, isOpen, onToggle
}) => {
    return (
        <CollapsibleSection
            id="content"
            icon={<FileText className="w-4 h-4" />}
            title="Nội dung bổ sung"
            subtitle="Tài liệu PDF, yêu cầu đặc biệt"
            isOpen={isOpen}
            onToggle={onToggle}
        >
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nội dung tham khảo</label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Nhập nội dung bài học hoặc để trống để AI tự tạo..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/40"
                    />
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-xl p-4">
                    <label className="block text-sm font-bold text-blue-800 mb-2">📄 Tải tài liệu bài học (PDF/Ảnh)</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setUploadedFile(file);
                        }}
                        className="hidden"
                    />
                    {uploadedFile ? (
                        <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                    <FileCheck className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800 text-sm truncate max-w-[200px]">{uploadedFile.name}</p>
                                    <p className="text-xs text-gray-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setUploadedFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="p-2 hover:bg-red-100 rounded-full text-red-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex flex-col items-center justify-center py-4 hover:bg-blue-100/50 rounded-lg transition-colors cursor-pointer"
                        >
                            <Upload className="w-6 h-6 text-blue-500 mb-1" />
                            <span className="font-medium text-blue-700 text-sm">Nhấn để tải file</span>
                        </button>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">✨ Yêu cầu đặc biệt cho AI</label>
                    <textarea
                        value={customPrompt}
                        onChange={e => setCustomPrompt(e.target.value)}
                        placeholder="VD: Tập trung vào phép cộng có nhớ..."
                        rows={2}
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/40 bg-purple-50/50"
                    />
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default ContentSourceSection;
