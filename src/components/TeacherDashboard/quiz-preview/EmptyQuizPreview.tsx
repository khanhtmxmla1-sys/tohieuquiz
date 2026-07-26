import React from 'react';
import { PlusCircle } from 'lucide-react';

const EmptyQuizPreview: React.FC<{ onStartManual?: () => void }> = ({ onStartManual }) => (
    <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
            <PlusCircle className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có dữ liệu đề thi</h3>
        <p className="text-slate-500 max-w-xs mx-auto mb-6">
            Nhập thông tin cơ bản bên trái, sau đó mở phòng soạn toàn màn hình để tạo câu hỏi thủ công.
        </p>
        {onStartManual && (
            <div className="flex flex-col gap-3">
                <button
                    onClick={onStartManual}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95 text-sm"
                >
                    Mở phòng soạn đề thủ công
                </button>
            </div>
        )}
    </div>
);

export default EmptyQuizPreview;
