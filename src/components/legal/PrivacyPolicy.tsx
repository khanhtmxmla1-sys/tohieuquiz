import React from 'react';
import { Shield, Lock, Eye, ArrowLeft } from 'lucide-react';

interface Props {
    onBack: () => void;
}

const PrivacyPolicy: React.FC<Props> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white relative">
                    <button
                        onClick={onBack}
                        className="absolute top-6 left-6 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-white/20 rounded-2xl">
                            <Shield className="w-8 h-8" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-center">Chính sách Bảo mật</h1>
                    <p className="text-blue-100 text-center mt-2">Cập nhật lần cuối: 13/03/2026</p>
                </div>

                {/* Content */}
                <div className="p-8 prose prose-slate max-w-none">
                    <p className="text-lg text-slate-600 leading-relaxed">
                        Chào mừng bạn đến với <strong>TôHiệuQuiz</strong>. Chúng tôi rất coi trọng quyền riêng tư của bạn và cam kết bảo vệ thông tin cá nhân của học sinh cũng như giáo viên.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-10">
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col items-center text-center">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg mb-3">
                                <Eye className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-blue-900 mb-1">Minh bạch</h3>
                            <p className="text-xs text-blue-700">Chúng tôi luôn nói rõ loại dữ liệu nào được thu thập.</p>
                        </div>
                        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex flex-col items-center text-center">
                            <div className="p-2 bg-indigo-100 text-blue-700 rounded-lg mb-3">
                                <Lock className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-blue-950 mb-1">An toàn</h3>
                            <p className="text-xs text-blue-800">Dữ liệu được mã hóa và bảo vệ nghiêm ngặt.</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex flex-col items-center text-center">
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg mb-3">
                                <Shield className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-green-900 mb-1">Kiểm soát</h3>
                            <p className="text-xs text-green-700">Bạn có quyền yêu cầu xóa dữ liệu bất cứ lúc nào.</p>
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">1. Thông tin chúng tôi thu thập</h2>
                    <ul className="list-disc pl-6 space-y-2 text-slate-600">
                        <li><strong>Học sinh:</strong> Tên, lớp, và kết quả các bài kiểm tra/luyện tập.</li>
                        <li><strong>Giáo viên:</strong> Tên, email công vụ, và các đề thi đã tạo.</li>
                        <li><strong>Dữ liệu kỹ thuật:</strong> Địa chỉ IP, loại trình duyệt để đảm bảo an toàn hệ thống.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">2. Cách chúng tôi sử dụng thông tin</h2>
                    <p className="text-slate-600 mb-4">
                        Thông tin được sử dụng cho các mục đích:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-600">
                        <li>Cung cấp bảng điểm và kết quả học tập cho giáo viên và phụ huynh.</li>
                        <li>Tạo bảng xếp hạng thi đua trong lớp/trường.</li>
                        <li>Cải thiện chất lượng đề thi thông qua AI gợi ý.</li>
                        <li>Ngăn chặn các hành vi gian lận trong thi cử.</li>
                    </ul>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">3. Chia sẻ thông tin</h2>
                    <p className="text-slate-600 leading-relaxed">
                        TôHiệuQuiz <strong>KHÔNG</strong> bán, trao đổi hoặc cho thuê thông tin cá nhân của người dùng cho bên thứ ba. Dữ liệu chỉ được chia sẻ trong phạm vi nội bộ TôHiệuQuiz giữa giáo viên và học sinh/phụ huynh có liên quan.
                    </p>

                    <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4">4. Quyền của bạn</h2>
                    <p className="text-slate-600 leading-relaxed italic">
                        Bạn có quyền yêu cầu xem, chỉnh sửa hoặc xóa thông tin cá nhân của mình khỏi hệ thống. Vui lòng liên hệ với Ban Quản trị nhà trường hoặc giáo viên chủ nhiệm để thực hiện các yêu cầu này.
                    </p>

                    <div className="mt-12 pt-8 border-t border-slate-100">
                        <button
                            onClick={onBack}
                            className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all"
                        >
                            Quay lại Trang chủ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
