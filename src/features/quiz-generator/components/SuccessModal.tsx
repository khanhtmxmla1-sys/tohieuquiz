import React from 'react';
import { Check, Link2, Copy } from 'lucide-react';

interface SuccessModalProps {
    show: boolean;
    onClose: () => void;
    quizLink: string;
    isCopied: boolean;
    onCopy: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ 
    show, onClose, quizLink, isCopied, onCopy 
}) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Check className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">Lưu đề thành công!</h3>
                    <p className="text-gray-500 text-sm mt-1">Chia sẻ link bên dưới cho học sinh để làm bài</p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Link2 className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Link làm bài:</span>
                    </div>
                    <div className="bg-white border border-gray-300 rounded-lg p-3 font-mono text-sm text-blue-600 break-all">
                        {quizLink}
                    </div>
                </div>

                <button
                    onClick={onCopy}
                    className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${isCopied
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg'
                        }`}
                >
                    {isCopied ? (
                        <>
                            <Check className="w-5 h-5" />
                            Đã copy link!
                        </>
                    ) : (
                        <>
                            <Copy className="w-5 h-5" />
                            Copy link gửi học sinh
                        </>
                    )}
                </button>

                <button
                    onClick={onClose}
                    className="w-full mt-3 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                    Đóng
                </button>
            </div>
        </div>
    );
};

export default SuccessModal;
