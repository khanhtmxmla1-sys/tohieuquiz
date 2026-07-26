import React from 'react';
import { FileText, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

interface Props {
    onBack: () => void;
}

const TermsOfService: React.FC<Props> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-8 text-white relative">
                    <button
                        onClick={onBack}
                        className="absolute top-6 left-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-white/20 rounded-2xl">
                            <FileText className="w-8 h-8" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-center">Điều khoản Sử dụng</h1>
                    <p className="text-slate-300 text-center mt-2">Cập nhật lần cuối: 13/03/2026</p>
                </div>

                {/* Content */}
                <div className="p-8 prose prose-slate max-w-none">
                    <div className="bg-amber-50 border-l-2 border-amber-400 p-4 mb-8">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertCircle className="h-5 w-5 text-amber-400" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-amber-700">
                                    Việc bạn truy cập và sử dụng TôHiệuQuiz đồng nghĩa với việc bạn chấp thuận các điều khoản bên dưới.
                                </p>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" /> 1. Chấp thuận Điều khoản
                    </h2>
                    <p className="text-slate-600 mb-6">
                        TôHiệuQuiz là nền tảng luyện thi trực tuyến được quản lý bởi TôHiệuQuiz. Bằng việc sử dụng hệ thống, học sinh và giáo viên cam kết tuân thủ các quy định về học tập và bảo mật thông tin.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" /> 2. Trách nhiệm người dùng
                    </h2>
                    <ul className="list-disc pl-6 space-y-3 text-slate-600 mb-6">
                        <li><strong>Trung thực:</strong> Tuyệt đối không gian lận, sử dụng công cụ can thiệp vào kết quả bài thi.</li>
                        <li><strong>Bảo mật:</strong> Không chia sẻ tài khoản hoặc mã làm bài (access code) cho người ngoài tổ chức.</li>
                        <li><strong>Văn hóa:</strong> Không đăng tải nội dung không phù hợp, ngôn từ thiếu chuẩn mực trong các phần phản hồi.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" /> 3. Quyền sở hữu trí tuệ
                    </h2>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        Mọi nội dung đề thi, hình ảnh, âm thanh và mã nguồn của TôHiệuQuiz đều thuộc quyền sở hữu của TôHiệuQuiz hoặc các đối tác cung cấp dịch vụ. Người dùng chỉ được phép sử dụng cho mục đích học tập cá nhân, không được phép sao chép thương mại.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" /> 4. Giới hạn trách nhiệm
                    </h2>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        Hệ thống cố gắng đảm bảo tính ổn định tối đa, tuy nhiên chúng tôi không chịu trách nhiệm cho các lỗi do đường truyền Internet phía người dùng hoặc sự cố phần cứng cá nhân khi thực hiện bài thi.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" /> 5. Thay đổi điều khoản
                    </h2>
                    <p className="text-slate-600 leading-relaxed mb-6">
                        Ban Quản trị có quyền thay đổi điều khoản này bất cứ lúc nào để phù hợp với quy định giáo dục. Các thay đổi sẽ có hiệu lực ngay khi được cập nhật lên trang web.
                    </p>

                    <div className="mt-12 pt-8 border-t border-slate-100">
                        <button
                            onClick={onBack}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all"
                        >
                            Tôi đã hiểu và Đồng ý
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
