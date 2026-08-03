import React from 'react';
import { AlertCircle } from 'lucide-react';

interface SubmitConfirmModalProps {
    isOpen: boolean;
    emptyCount: number;
    partialCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
    isOpen,
    emptyCount,
    partialCount,
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    const hasIncompleteQuestions = emptyCount > 0 || partialCount > 0;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Nộp bài ngay?</h3>

                    {hasIncompleteQuestions ? (
                        <div className="space-y-1 text-gray-600">
                            {emptyCount > 0 ? (
                                <p><span className="font-bold text-orange-700">{emptyCount} câu chưa bắt đầu</span></p>
                            ) : null}
                            {partialCount > 0 ? (
                                <p><span className="font-bold text-amber-700">{partialCount} câu đang làm dở</span></p>
                            ) : null}
                            <p className="pt-1">Bạn có chắc chắn muốn nộp bài không?</p>
                        </div>
                    ) : (
                        <p className="text-gray-600">
                            Bạn đã hoàn thành tất cả câu hỏi.
                            <br />Xác nhận nộp bài để xem kết quả?
                        </p>
                    )}
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                    >
                        Quay lại
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg transition-colors"
                    >
                        Đồng ý nộp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubmitConfirmModal;
