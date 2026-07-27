import React from 'react';
import {
    Activity,
    Baby,
    Ban,
    Clock3,
    Database,
    Eye,
    KeyRound,
    Mail,
    Minimize2,
    RefreshCcw,
    Server,
    Share2,
    ShieldCheck,
    Target,
    UserRoundCheck,
    Users,
} from 'lucide-react';
import LegalPageScaffold, { LegalBulletList, LegalSection } from './LegalPageScaffold';

interface Props {
    onBack: () => void;
}

const navigation = [
    { id: 'privacy-scope', label: 'Phạm vi áp dụng' },
    { id: 'privacy-data', label: 'Dữ liệu được xử lý' },
    { id: 'privacy-purpose', label: 'Mục đích sử dụng' },
    { id: 'privacy-children', label: 'Dữ liệu trẻ em' },
    { id: 'privacy-sharing', label: 'Chia sẻ và nhà cung cấp' },
    { id: 'privacy-retention', label: 'Lưu trữ và xóa' },
    { id: 'privacy-security', label: 'Bảo mật và ứng phó sự cố' },
    { id: 'privacy-rights', label: 'Quyền của người dùng' },
    { id: 'privacy-contact', label: 'Liên hệ' },
];

const securityLayers = [
    { icon: KeyRound, title: 'Kiểm soát truy cập', description: 'Phân quyền theo vai trò học sinh, giáo viên, phụ huynh và quản trị viên.' },
    { icon: ShieldCheck, title: 'Bảo vệ truyền tải', description: 'Sử dụng kết nối bảo mật và bảo vệ thông tin xác thực trong quá trình truy cập.' },
    { icon: Activity, title: 'Nhật ký & phát hiện bất thường', description: 'Ghi nhận sự kiện cần thiết để điều tra đăng nhập lạ, gian lận hoặc hành vi gây rủi ro.' },
    { icon: RefreshCcw, title: 'Khôi phục & ứng phó', description: 'Duy trì phương án sao lưu, khôi phục và phối hợp xử lý khi phát hiện sự cố.' },
];

const PrivacyPolicy: React.FC<Props> = ({ onBack }) => (
    <LegalPageScaffold
        activePage="privacy"
        eyebrow="Quyền riêng tư trong trường học"
        title="Chính sách bảo mật"
        description="Bảo vệ dữ liệu học sinh bằng nguyên tắc tối thiểu, minh bạch và an toàn; đồng thời giúp nhà trường, giáo viên và phụ huynh hiểu rõ cách thông tin được sử dụng."
        effectiveDate="27/07/2026"
        heroIcon={ShieldCheck}
        onBack={onBack}
        navigation={navigation}
        highlights={[
            { icon: Ban, title: 'Không bán dữ liệu', description: 'Thông tin người dùng không được bán hoặc dùng cho quảng cáo hành vi.', accent: 'bg-blue-50 text-blue-700' },
            { icon: Minimize2, title: 'Thu thập tối thiểu', description: 'Chỉ xử lý dữ liệu cần thiết cho hoạt động dạy, học và bảo vệ hệ thống.', accent: 'bg-amber-50 text-amber-700' },
            { icon: Users, title: 'Phụ huynh có quyền kiểm soát', description: 'Yêu cầu xem, sửa, hạn chế hoặc xóa dữ liệu của trẻ theo quy định áp dụng.', accent: 'bg-emerald-50 text-emerald-700' },
        ]}
        backButtonLabel="Quay lại Trang chủ"
        ctaTitle="Cần thực hiện quyền dữ liệu hoặc báo cáo sự cố?"
        ctaDescription="Hãy liên hệ qua kênh hỗ trợ chính thức. Không gửi mật khẩu, mã xác thực hoặc ảnh chụp chứa dữ liệu nhạy cảm qua kênh công khai."
    >
        <div className="rounded-3xl border border-blue-200 bg-blue-50/70 p-5 text-sm leading-7 text-blue-950 sm:p-6 sm:text-base">
            <strong>Khung tham chiếu:</strong> Chính sách này được xây dựng theo các nguyên tắc bảo vệ dữ liệu cá nhân, quyền trẻ em, an toàn thông tin và an ninh mạng hiện hành tại Việt Nam. Nhà trường có thể ban hành quy trình nội bộ chi tiết hơn phù hợp với hoạt động giáo dục của đơn vị.
        </div>

        <LegalSection id="privacy-scope" number="01" title="Phạm vi áp dụng" icon={Eye}>
            <p>Chính sách áp dụng khi học sinh, giáo viên, cán bộ quản lý, phụ huynh hoặc người giám hộ sử dụng TôHiệuQuiz trên website, cổng phụ huynh và các tính năng liên quan.</p>
            <p>Trong phạm vi triển khai của trường học, nhà trường quyết định mục đích giáo dục, tài khoản được cấp và người được phép truy cập. TôHiệuQuiz cung cấp công cụ kỹ thuật và xử lý dữ liệu theo cấu hình, phân quyền và yêu cầu hợp lệ của đơn vị.</p>
        </LegalSection>

        <LegalSection id="privacy-data" number="02" title="Dữ liệu được xử lý" icon={Database}>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-extrabold text-slate-900">Học sinh & phụ huynh</h3>
                    <LegalBulletList items={[
                        <>Họ tên, tên đăng nhập, lớp học, ảnh đại diện do người dùng lựa chọn.</>,
                        <>Bài làm, câu trả lời, điểm số, tiến độ, lượt tham gia và nhận xét học tập.</>,
                        <>Huy hiệu, xu, phần thưởng hoặc đơn đổi quà khi nhà trường bật các tính năng này.</>,
                        <>Thông tin liên kết phụ huynh và lịch sử truy cập cần thiết để bảo vệ tài khoản.</>,
                    ]} />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-extrabold text-slate-900">Giáo viên & dữ liệu kỹ thuật</h3>
                    <LegalBulletList items={[
                        <>Tên, tài khoản, vai trò, lớp phụ trách, đề thi, bài tập và thao tác quản lý.</>,
                        <>Địa chỉ IP, trình duyệt, thiết bị, thời điểm truy cập và nhật ký đăng nhập.</>,
                        <>Nhật ký hệ thống cần thiết để phát hiện lỗi, gian lận hoặc dấu hiệu tấn công.</>,
                        <>Nội dung người dùng chủ động gửi khi yêu cầu hỗ trợ kỹ thuật.</>,
                    ]} />
                </div>
            </div>
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><strong>TôHiệuQuiz không chủ động yêu cầu</strong> dữ liệu sức khỏe, sinh trắc học, căn cước, vị trí chính xác hoặc thông tin nhạy cảm khác nếu không có nhu cầu giáo dục cụ thể, căn cứ phù hợp và thông báo riêng.</p>
        </LegalSection>

        <LegalSection id="privacy-purpose" number="03" title="Mục đích sử dụng dữ liệu" icon={Target}>
            <LegalBulletList items={[
                <>Cấp và bảo vệ tài khoản; duy trì phiên đăng nhập và phân quyền đúng vai trò.</>,
                <>Tổ chức bài kiểm tra, luyện tập, giao bài, chấm điểm và theo dõi tiến bộ.</>,
                <>Cung cấp kết quả cho học sinh, giáo viên, nhà trường và phụ huynh có quyền truy cập.</>,
                <>Vận hành tính năng khuyến khích học tập như huy hiệu, xu và quà tặng khi được bật.</>,
                <>Phát hiện lỗi, phòng chống gian lận, lạm dụng tài khoản và sự cố an ninh mạng.</>,
                <>Cải thiện tính dễ dùng và hiệu quả học tập bằng dữ liệu tổng hợp hoặc đã giảm khả năng nhận diện khi phù hợp.</>,
            ]} />
            <p><strong>Không sử dụng dữ liệu học sinh cho quảng cáo hành vi.</strong> Bảng điểm, bảng xếp hạng hoặc thành tích chỉ hiển thị trong phạm vi giáo dục được nhà trường cho phép; không mặc định công khai ra Internet.</p>
        </LegalSection>

        <LegalSection id="privacy-children" number="04" title="Bảo vệ dữ liệu trẻ em" icon={Baby} tone="blue">
            <p>Lợi ích tốt nhất, sự an toàn và quyền riêng tư của trẻ em được ưu tiên khi thiết kế và vận hành tính năng. Học sinh cần được hướng dẫn bằng ngôn ngữ phù hợp lứa tuổi về dữ liệu được sử dụng và cách tự bảo vệ tài khoản.</p>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-blue-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 font-extrabold text-[#172554]"><Server className="h-5 w-5 text-blue-600" /> Nhà trường & giáo viên</h3>
                    <LegalBulletList items={[
                        <>Chỉ tạo và sử dụng tài khoản cho mục đích giáo dục hợp lệ.</>,
                        <>Phân quyền đúng lớp, đúng nhiệm vụ và rà soát quyền truy cập định kỳ.</>,
                        <>Không đăng công khai điểm, bài làm hoặc thông tin nhận diện khi chưa được phép.</>,
                        <>Tiếp nhận yêu cầu của phụ huynh và phối hợp xử lý dữ liệu của học sinh.</>,
                    ]} />
                </div>
                <div className="rounded-2xl border border-blue-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 font-extrabold text-[#172554]"><UserRoundCheck className="h-5 w-5 text-emerald-600" /> Phụ huynh/người giám hộ</h3>
                    <LegalBulletList items={[
                        <>Được biết cách dữ liệu của trẻ được thu thập và sử dụng.</>,
                        <>Có thể yêu cầu xem, sửa, hạn chế, rút lại sự đồng ý hoặc xóa theo quy định.</>,
                        <>Hỗ trợ trẻ giữ bí mật mật khẩu và nhận biết lừa đảo trên mạng.</>,
                        <>Báo ngay cho nhà trường khi phát hiện tài khoản hoặc dữ liệu có dấu hiệu bị lộ.</>,
                    ]} />
                </div>
            </div>
        </LegalSection>

        <LegalSection id="privacy-sharing" number="05" title="Chia sẻ dữ liệu và nhà cung cấp dịch vụ" icon={Share2}>
            <p>TôHiệuQuiz không bán, cho thuê hoặc trao đổi dữ liệu cá nhân. Dữ liệu chỉ được cung cấp trong phạm vi cần thiết cho:</p>
            <LegalBulletList items={[
                <>Học sinh, giáo viên, phụ huynh và cán bộ nhà trường đã được phân quyền.</>,
                <>Nhà cung cấp hạ tầng, lưu trữ, gửi thông báo hoặc bảo mật làm việc theo yêu cầu và biện pháp bảo vệ phù hợp.</>,
                <>Cơ quan có thẩm quyền khi có yêu cầu hợp pháp hoặc khi cần bảo vệ người dùng trước nguy cơ nghiêm trọng.</>,
                <>Đơn vị hỗ trợ điều tra, khắc phục sự cố với phạm vi dữ liệu tối thiểu cần thiết.</>,
            ]} />
        </LegalSection>

        <LegalSection id="privacy-retention" number="06" title="Thời hạn lưu trữ và xóa dữ liệu" icon={Clock3}>
            <p>Dữ liệu được lưu trong thời gian cần thiết để phục vụ năm học, yêu cầu quản lý của nhà trường, giải quyết khiếu nại, bảo vệ hệ thống và thực hiện nghĩa vụ áp dụng.</p>
            <LegalBulletList items={[
                <>Khi tài khoản hoặc lớp học kết thúc, dữ liệu có thể được xóa, ẩn danh hoặc lưu trữ hạn chế theo yêu cầu hợp lệ của nhà trường.</>,
                <>Bản sao lưu có thể còn tồn tại trong chu kỳ kỹ thuật giới hạn trước khi được ghi đè hoặc xóa an toàn.</>,
                <>Nhật ký an ninh có thể được giữ lâu hơn dữ liệu hoạt động thông thường khi cần điều tra sự cố hoặc ngăn hành vi lặp lại.</>,
            ]} />
        </LegalSection>

        <LegalSection id="privacy-security" number="07" title="Bảo mật và ứng phó sự cố an ninh mạng" icon={ShieldCheck} tone="green">
            <p>TôHiệuQuiz áp dụng các biện pháp kỹ thuật và tổ chức phù hợp với mức độ rủi ro. Không hệ thống nào có thể loại bỏ hoàn toàn mọi nguy cơ, vì vậy việc bảo vệ dữ liệu cần sự phối hợp của nền tảng, nhà trường, giáo viên, phụ huynh và học sinh.</p>
            <div className="grid gap-4 sm:grid-cols-2">
                {securityLayers.map((layer, index) => (
                    <div key={layer.title} className="relative rounded-2xl border border-emerald-200 bg-white p-5">
                        <span className="absolute right-4 top-4 text-3xl font-black text-emerald-100">0{index + 1}</span>
                        <layer.icon className="h-6 w-6 text-emerald-700" />
                        <h3 className="mt-4 font-extrabold text-slate-900">{layer.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{layer.description}</p>
                    </div>
                ))}
            </div>
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
                <strong>Cảnh báo bảo mật:</strong> TôHiệuQuiz không yêu cầu người dùng gửi mật khẩu, mã xác thực hoặc khóa truy cập qua email, biểu mẫu công khai hay tin nhắn. Khi báo lỗi, hãy che điểm số, tên học sinh và thông tin nhạy cảm không liên quan.
            </div>
        </LegalSection>

        <LegalSection id="privacy-rights" number="08" title="Quyền của người dùng" icon={UserRoundCheck}>
            <p>Trong phạm vi pháp luật và vai trò của từng bên, người dùng hoặc người đại diện hợp pháp có thể yêu cầu được biết, truy cập, chỉnh sửa, rút lại sự đồng ý, hạn chế xử lý, phản đối, xóa dữ liệu, khiếu nại hoặc đề nghị cung cấp thông tin về hoạt động xử lý.</p>
            <p>Yêu cầu liên quan đến học sinh nên được gửi qua giáo viên chủ nhiệm hoặc Ban Quản trị nhà trường để xác minh đúng người, đúng lớp và tránh việc dữ liệu bị cung cấp cho người không có thẩm quyền.</p>
        </LegalSection>

        <LegalSection id="privacy-contact" number="09" title="Liên hệ về quyền riêng tư" icon={Mail}>
            <p>Gửi yêu cầu đến <a href="mailto:support@thtohieu.com" className="font-extrabold text-blue-700 underline decoration-blue-200 underline-offset-4">support@thtohieu.com</a> hoặc sử dụng trang Liên hệ. Nội dung nên gồm vai trò của người yêu cầu, lớp/tài khoản liên quan, yêu cầu cụ thể và kênh để xác minh.</p>
            <p>TôHiệuQuiz có thể cần phối hợp với nhà trường trước khi truy cập, sửa hoặc xóa dữ liệu học sinh. Không gửi bản sao giấy tờ tùy thân qua email nếu chưa được hướng dẫn bằng kênh an toàn.</p>
        </LegalSection>
    </LegalPageScaffold>
);

export default PrivacyPolicy;
