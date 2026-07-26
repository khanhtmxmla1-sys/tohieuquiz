import React, { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Check, AlertCircle, Upload, Loader2 } from 'lucide-react';
import { Button } from '../../../../../components/common';
import { CreateStudentPayload } from '../../../types';
import { downloadStudentCredentials, downloadStudentTemplate, parseStudentExcel, StudentCredential } from '../../../utils/excelParser';
import type { BatchStudentResult } from '../../../../../services/classroomService';

interface ExcelTabProps {
    classId: string;
    onClose: () => void;
    onSubmit: (payload: CreateStudentPayload[]) => Promise<BatchStudentResult | null>;
    isLoading: boolean;
}

export const ExcelTab: React.FC<ExcelTabProps> = ({ classId, onClose, onSubmit, isLoading }) => {
    const [parsedData, setParsedData] = useState<CreateStudentPayload[] | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [importResult, setImportResult] = useState<BatchStudentResult | null>(null);
    const [credentials, setCredentials] = useState<StudentCredential[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setParseError(null);
        setParsedData(null);
        setImportResult(null);
        setCredentials([]);

        try {
            const students = await parseStudentExcel(file, classId);
            setParsedData(students);
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            setParseError(normalizedError.message || 'Lỗi không xác định.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFormSubmit = async () => {
        if (!parsedData || parsedData.length === 0) return;
        const result = await onSubmit(parsedData);
        if (!result) return;
        const successfulUsernames = new Set(result.successes.map((student) => student.username));
        setCredentials(parsedData.filter((student) => successfulUsernames.has(student.username)).map(({ fullName, username, password }) => ({ fullName, username, password })));
        setImportResult(result);
    };

    return (
        <div className="space-y-6">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-orange-900 text-sm">Tải file mẫu</h3>
                    <p className="text-orange-700 text-xs mt-1">Sử dụng định dạng chuẩn để tránh lỗi</p>
                </div>
                <Button variant="secondary" onClick={() => void downloadStudentTemplate()} icon={<Download className="w-4 h-4" />} className="bg-white">
                    Tải xuống
                </Button>
            </div>

            <div>
                <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                
                {!parsedData ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${parseError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50'}`}
                    >
                        {isUploading ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
                                <p className="text-gray-600 font-medium">Đang đọc file...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <FileSpreadsheet className={`w-8 h-8 mb-3 ${parseError ? 'text-red-400' : 'text-gray-400'}`} />
                                <p className="text-gray-700 font-medium mb-1">Chọn file Excel tải lên</p>
                                <p className="text-gray-400 text-sm">Hỗ trợ .xlsx</p>
                            </div>
                        )}
                    </div>
                ) : importResult ? (
                    <div className="border border-green-200 bg-green-50 rounded-xl p-5">
                        <h3 className="font-bold text-green-800">Đã thêm {importResult.successCount} học sinh</h3>
                        {importResult.errorCount > 0 && (
                            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                                <p className="font-semibold">{importResult.errorCount} dòng chưa được thêm:</p>
                                <ul className="mt-1 list-disc pl-5 max-h-28 overflow-auto">
                                    {importResult.errors.map((item, index) => <li key={`${item.username}-${index}`}>{item.fullName || item.username || `Dòng ${index + 1}`}: {item.reason}</li>)}
                                </ul>
                            </div>
                        )}
                        {credentials.length > 0 && (
                            <Button className="mt-4 w-full" variant="primary" onClick={() => void downloadStudentCredentials(credentials)} icon={<Download className="w-4 h-4" />}>
                                Tải tài khoản và mật khẩu ({credentials.length})
                            </Button>
                        )}
                        <p className="text-xs text-green-700 mt-2">Hãy tải và lưu file trước khi đóng. Mật khẩu không thể xem lại sau đó.</p>
                    </div>
                ) : (
                    <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Check className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-green-800 mb-1">
                            Đã tìm thấy {parsedData.length} học sinh
                        </h3>
                        <p className="text-green-600 text-sm mb-4">
                            Dữ liệu hợp lệ, sẵn sàng để tải lên hệ thống.
                        </p>
                        <Button variant="secondary" onClick={() => setParsedData(null)} className="text-sm bg-white">
                            Chọn file khác
                        </Button>
                        <div className="mt-4 max-h-44 overflow-auto rounded-lg border border-green-200 bg-white text-left">
                            {parsedData.slice(0, 10).map((student, index) => (
                                <div key={`${student.username}-${index}`} className="px-3 py-2 border-b last:border-b-0 text-xs">
                                    <span className="font-semibold">{student.fullName}</span> · <code>{student.username}</code>
                                </div>
                            ))}
                            {parsedData.length > 10 && <div className="px-3 py-2 text-xs text-gray-500">Và {parsedData.length - 10} học sinh khác…</div>}
                        </div>
                    </div>
                )}
                
                {parseError && (
                    <div className="flex items-center gap-2 mt-3 text-red-500 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>{parseError}</span>
                    </div>
                )}
            </div>

            <div className="flex gap-3 pt-2">
                <Button onClick={onClose} variant="secondary" className="flex-1">
                    Hủy
                </Button>
                <Button
                    onClick={handleFormSubmit}
                    variant="primary"
                    className="flex-1"
                    disabled={!parsedData || isLoading || Boolean(importResult)}
                    icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                >
                    {importResult ? 'Đã hoàn tất' : isLoading ? 'Đang thêm...' : 'Xác nhận thêm'}
                </Button>
            </div>
        </div>
    );
};
