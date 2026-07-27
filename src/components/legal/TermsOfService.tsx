import React from 'react';
import {
    AlertTriangle,
    Bot,
    CheckCircle2,
    ClipboardCheck,
    Copyright,
    FileText,
    GraduationCap,
    HeartHandshake,
    KeyRound,
    Link2Off,
    LockKeyhole,
    LogOut,
    Mail,
    Scale,
    ShieldCheck,
    UserCog,
    UsersRound,
    WifiOff,
} from 'lucide-react';
import LegalPageScaffold, { LegalBulletList, LegalSection } from './LegalPageScaffold';

interface Props {
    onBack: () => void;
}

const navigation = [
    { id: 'terms-scope', label: 'Phạm vi và chấp thuận' },
    { id: 'terms-accounts', label: 'Tài khoản và phân quyền' },
    { id: 'terms-rules', label: 'Quy tắc sử dụng' },
    { id: 'terms-integrity', label: 'Thi cử và tính trung thực' },
    { id: 'terms-content', label: 'Nội dung và sở hữu trí tuệ' },
    { id: 'terms-ai', label: 'Công cụ AI' },
    { id: 'terms-security', label: 'An toàn thông tin' },
    { id: 'terms-availability', label: 'Gián đoạn dịch vụ' },
    { id: 'terms-enforcement', label: 'Xử lý vi phạm' },
    { id: 'terms-changes', label: 'Thay đổi và liên hệ' },
];

const safetyActions = [
    { icon: KeyRound, title: 'Dùng mật khẩu đủ mạnh', description: 'Không chia sẻ mật khẩu, mã truy cập hoặc mã xác thực cho bạn bè và người lạ.' },
    { icon: AlertTriangle, title: 'Báo cáo đăng nhập lạ', description: 'Đổi mật khẩu và báo giáo viên hoặc quản trị viên khi thấy hoạt động không phải của mình.' },
    { icon: Link2Off, title: 'Tránh liên kết đáng ngờ', description: 'Không mở tệp, đường dẫn hoặc tiện ích mở rộng không rõ nguồn gốc.' },
    { icon: LogOut, title: 'Đăng xuất thiết bị dùng chung', description: 'Không lưu mật khẩu trên máy tính phòng học, thư viện hoặc thiết bị mượn.' },
];

const TermsOfService: React.FC<Props> = ({ onBack }) => (
    <LegalPageScaffold
        activePage="tos"
        eyebrow="Quy tắc sử dụng có trách nhiệm"
        title="Điều khoản sử dụng"
        description="Quy tắc chung để học tập công bằng, an toàn và có trách nhiệm trong môi trường số của nhà trường."
        effectiveDate="27/07/2026"
        heroIcon={Scale}
        onBack={onBack}
        navigation={navigation}
        highlights={[
            { icon: GraduationCap, title: 'Dành cho học tập', description: 'Tài khoản và tính năng được sử dụng cho hoạt động giáo dục được nhà trường cho phép.', accent: 'bg-blue-50 text-blue-700' },
            { icon: HeartHandshake, title: 'Tôn trọng cộng đồng', description: 'Giao tiếp lịch sự, không bắt nạt, xúc phạm hoặc phát tán nội dung gây hại.', accent: 'bg-amber-50 text-amber-700' },
            { icon: LockKeyhole, title: 'Bảo vệ tài khoản', description: 'Mỗi người giữ bí mật thông tin đăng nhập và báo sớm khi có dấu hiệu bất thường.', accent: 'bg-emerald-50 text-emerald-700' },
        ]}
        backButtonLabel="Tôi đã hiểu và Đồng ý"
        ctaTitle="Bạn cần làm rõ một quy định hoặc báo cáo hành vi không an toàn?"
        ctaDescription="Hãy trao đổi với giáo viên, Ban Quản trị nhà trường hoặc kênh hỗ trợ TôHiệuQuiz để được xác minh và xử lý phù hợp."
    >
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950 sm:p-6 sm:text-base">
            <strong>Đối với học sinh chưa đủ tuổi tự quyết định,</strong> phụ huynh/người giám hộ và nhà trường cùng hướng dẫn việc sử dụng phù hợp, giải thích các quy tắc bằng ngôn ngữ dễ hiểu và ưu tiên lợi ích tốt nhất của trẻ em.
        </div>

        <LegalSection id="terms-scope" number="01" title="Phạm vi và chấp thuận" icon={FileText}>
            <p>Điều khoản áp dụng cho học sinh, giáo viên, cán bộ quản lý, phụ huynh và người giám hộ khi sử dụng website, cổng phụ huynh hoặc tính năng liên quan của TôHiệuQuiz.</p>
            <p>Việc sử dụng hệ thống cần phù hợp với quy định của nhà trường, hướng dẫn của giáo viên và pháp luật áp dụng. Khi một quy định nội bộ của trường nghiêm ngặt hơn điều khoản này, người dùng cần tuân thủ quy định của đơn vị.</p>
        </LegalSection>

        <LegalSection id="terms-accounts" number="02" title="Tài khoản, vai trò và phân quyền" icon={UserCog}>
            <LegalBulletList items={[
                <>Tài khoản học sinh thường do nhà trường hoặc giáo viên tạo, cấp và quản lý theo lớp.</>,
                <>Không cho mượn tài khoản, không đăng nhập thay người khác và không sử dụng vai trò không được cấp.</>,
                <>Giáo viên, quản trị viên chỉ truy cập dữ liệu cần thiết cho nhiệm vụ được giao.</>,
                <>Phụ huynh hỗ trợ trẻ bảo vệ thông tin đăng nhập và không dùng tài khoản của trẻ để thực hiện bài thay.</>,
                <>Thông tin hồ sơ cần chính xác, phù hợp môi trường học đường và không giả mạo người khác.</>,
            ]} />
        </LegalSection>

        <LegalSection id="terms-rules" number="03" title="Quy tắc sử dụng an toàn và tôn trọng" icon={UsersRound}>
            <p>Người dùng không được sử dụng TôHiệuQuiz để thực hiện hoặc hỗ trợ các hành vi sau:</p>
            <LegalBulletList items={[
                <>Bắt nạt, xúc phạm, đe dọa, quấy rối hoặc tiết lộ thông tin riêng tư của người khác.</>,
                <>Đăng nội dung bạo lực, phản cảm, phân biệt đối xử hoặc không phù hợp với lứa tuổi học sinh.</>,
                <>Phát tán mã độc, liên kết lừa đảo, tệp nguy hiểm hoặc hướng dẫn vượt qua biện pháp bảo vệ.</>,
                <>Thu thập trái phép dữ liệu, dò quét hệ thống, thử mật khẩu, chiếm quyền tài khoản hoặc gây gián đoạn dịch vụ.</>,
                <>Dùng công cụ tự động tạo tải bất thường, sao chép dữ liệu hàng loạt hoặc khai thác lỗi để trục lợi.</>,
            ]} />
        </LegalSection>

        <LegalSection id="terms-integrity" number="04" title="Thi cử và tính trung thực học tập" icon={ClipboardCheck} tone="blue">
            <p>Học sinh cần tự thực hiện bài theo hướng dẫn, thời gian và tài liệu được phép. Không sử dụng công cụ, tài khoản hoặc sự trợ giúp không được giáo viên chấp thuận.</p>
            <LegalBulletList items={[
                <>Không can thiệp điểm số, thời gian làm bài, trạng thái nộp bài hoặc mã truy cập.</>,
                <>Không chia sẻ đáp án, chụp phát tán đề hoặc làm bài thay khi chưa được phép.</>,
                <>Nhật ký hệ thống có thể được giáo viên dùng để xác minh sự cố hoặc dấu hiệu bất thường.</>,
                <>Kết quả kỹ thuật cần được xem xét cùng hoàn cảnh thực tế; không nên tự động kết luận vi phạm chỉ từ một tín hiệu.</>,
            ]} />
        </LegalSection>

        <LegalSection id="terms-content" number="05" title="Nội dung và quyền sở hữu trí tuệ" icon={Copyright}>
            <p>Người tải đề, hình ảnh, âm thanh hoặc tệp lên hệ thống phải có quyền sử dụng nội dung đó hoặc được chủ sở hữu cho phép. Không sao chép thương mại, xóa thông tin tác giả hoặc phát tán tài liệu giới hạn của nhà trường.</p>
            <p>Bài làm và sản phẩm học tập của học sinh chỉ được sử dụng cho mục đích giáo dục, đánh giá, phản hồi hoặc trưng bày trong phạm vi đã được cho phép. Việc công khai ra ngoài trường cần xem xét quyền riêng tư và sự đồng ý phù hợp.</p>
        </LegalSection>

        <LegalSection id="terms-ai" number="06" title="Sử dụng công cụ trí tuệ nhân tạo" icon={Bot} tone="amber">
            <p>Công cụ AI chỉ hỗ trợ gợi ý câu hỏi, nội dung hoặc cách trình bày. Kết quả có thể thiếu chính xác, thiên lệch hoặc không phù hợp chương trình học; giáo viên phải kiểm duyệt trước khi sử dụng với học sinh.</p>
            <LegalBulletList items={[
                <>Không nhập dữ liệu cá nhân nhạy cảm của học sinh, bí mật nhà trường, mật khẩu hoặc đề thi chưa công bố vào công cụ AI.</>,
                <>Không coi kết quả AI là quyết định cuối cùng về điểm số, kỷ luật hoặc năng lực của học sinh.</>,
                <>Cần kiểm tra nguồn, bản quyền, độ chính xác và mức độ phù hợp lứa tuổi.</>,
                <>Học sinh phải nói rõ khi bài tập yêu cầu khai báo việc có sử dụng AI hỗ trợ.</>,
            ]} />
        </LegalSection>

        <LegalSection id="terms-security" number="07" title="An toàn thông tin là trách nhiệm chung" icon={ShieldCheck} tone="green">
            <div className="relative space-y-4 before:absolute before:bottom-6 before:left-[23px] before:top-6 before:w-px before:bg-emerald-200">
                {safetyActions.map((action, index) => (
                    <div key={action.title} className="relative flex gap-4 rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5">
                        <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                            <action.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-700">Bước {index + 1}</p>
                            <h3 className="mt-1 font-extrabold text-slate-900">{action.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </LegalSection>

        <LegalSection id="terms-availability" number="08" title="Bảo trì và gián đoạn dịch vụ" icon={WifiOff}>
            <p>TôHiệuQuiz cố gắng duy trì hệ thống ổn định nhưng không thể cam kết dịch vụ luôn không có lỗi. Việc truy cập có thể bị ảnh hưởng bởi bảo trì, đường truyền, thiết bị người dùng, nhà cung cấp hạ tầng, tấn công mạng hoặc sự kiện bất khả kháng.</p>
            <p>Khi có sự cố, đội ngũ vận hành ưu tiên bảo vệ người dùng, cô lập rủi ro, khôi phục chức năng và bảo toàn dữ liệu trong khả năng hợp lý. Nhà trường nên có phương án dự phòng cho hoạt động kiểm tra quan trọng.</p>
        </LegalSection>

        <LegalSection id="terms-enforcement" number="09" title="Xử lý hành vi vi phạm" icon={Scale}>
            <p>Khi có dấu hiệu vi phạm, hệ thống có thể tạm thời giới hạn tính năng, yêu cầu đổi mật khẩu, khóa phiên đăng nhập hoặc bảo toàn nhật ký để ngăn rủi ro tiếp diễn.</p>
            <p>Việc xử lý ưu tiên xác minh, thông báo và phối hợp với nhà trường, giáo viên, phụ huynh hoặc người giám hộ. Biện pháp áp dụng cần tương xứng với mức độ rủi ro, bảo vệ học sinh và tạo cơ hội khắc phục. Trường hợp nghiêm trọng có thể được chuyển cho cơ quan có thẩm quyền theo quy định.</p>
        </LegalSection>

        <LegalSection id="terms-changes" number="10" title="Thay đổi điều khoản và liên hệ" icon={Mail}>
            <p>Điều khoản có thể được cập nhật khi tính năng, quy trình nhà trường hoặc yêu cầu pháp lý thay đổi. Phiên bản mới sẽ ghi rõ ngày áp dụng; thay đổi quan trọng nên được thông báo qua kênh phù hợp trước khi triển khai.</p>
            <p>Gửi câu hỏi hoặc báo cáo hành vi không an toàn đến <a href="mailto:support@thtohieu.com" className="font-extrabold text-blue-700 underline decoration-blue-200 underline-offset-4">support@thtohieu.com</a>, giáo viên chủ nhiệm hoặc Ban Quản trị nhà trường. Khi báo cáo, không gửi mật khẩu hay dữ liệu nhạy cảm không cần thiết.</p>
            <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-blue-700" />
                <span>Việc tiếp tục sử dụng sau ngày áp dụng thể hiện sự đồng ý trong phạm vi người dùng có thẩm quyền; đối với học sinh, việc hướng dẫn và chấp thuận của nhà trường/phụ huynh được thực hiện theo quy định liên quan.</span>
            </div>
        </LegalSection>
    </LegalPageScaffold>
);

export default TermsOfService;
