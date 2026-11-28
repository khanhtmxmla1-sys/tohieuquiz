export type LandingAudience = {
    eyebrow: string;
    title: string;
    description: string;
    icon: 'teacher' | 'student' | 'parent';
    bullets: string[];
};

export type LandingFeature = {
    eyebrow: string;
    title: string;
    description: string;
    image?: string;
    imageAlt?: string;
    bullets: string[];
    tone: 'blue' | 'amber' | 'green';
};

export type RoleBenefit = {
    id: 'teacher' | 'student' | 'parent';
    label: string;
    title: string;
    description: string;
    image?: string;
    imageSmall?: string;
    imageAlt?: string;
    bullets: string[];
};

export const landingContent = {
    brandSubline: 'Trường Tiểu học Tô Hiệu · Sơn La',
    eyebrow: 'Nền tảng học & kiểm tra trực tuyến',
    headline: 'Học và kiểm tra trực tuyến, vui như một trò chơi cho học sinh tiểu học',
    slogan: 'Mỗi ngày một tiến bộ, mỗi bài học thêm tự tin.',
    lead: 'TôHiệuQuiz kết nối giáo viên, học sinh và phụ huynh trong một vòng học tập rõ ràng: tạo đề, làm bài, phản hồi và khích lệ tiến bộ mỗi ngày.',
    heroPoints: ['Tạo đề và giao bài linh hoạt', 'Thi trực tiếp bằng mã tham gia', 'Theo dõi kết quả trong cùng một nơi'],
};

export const audiences: LandingAudience[] = [
    { eyebrow: 'Dành cho giáo viên & nhà trường', title: 'Tổ chức việc dạy học gọn gàng hơn', description: 'Từ ra đề đến báo cáo, các bước kiểm tra và đánh giá được gom về một không gian dễ theo dõi.', icon: 'teacher', bullets: ['Tạo đề bằng AI hoặc soạn thủ công', 'Giao bài theo lớp hoặc từng học sinh', 'Theo dõi kết quả và phân tích câu sai'] },
    { eyebrow: 'Dành cho học sinh lớp 1–5', title: 'Học như chơi, tiến bộ nhìn thấy được', description: 'Bài được giao, nhiệm vụ và thành tích xuất hiện trong trải nghiệm thân thiện với lứa tuổi tiểu học.', icon: 'student', bullets: ['Làm bài Toán, Tiếng Việt và các nội dung được giao', 'Nhận phản hồi sau mỗi lần hoàn thành', 'Tích lũy động lực qua nhiệm vụ và thành tích'] },
    { eyebrow: 'Dành cho phụ huynh', title: 'Đồng hành cùng con đúng lúc', description: 'Cổng phụ huynh giúp gia đình nắm được kết quả và thông báo do nhà trường gửi.', icon: 'parent', bullets: ['Theo dõi kết quả học tập của con', 'Nhận phiếu điểm và thông báo của lớp', 'Kết nối thông tin giữa gia đình và nhà trường'] },
];

export const features: LandingFeature[] = [
    { eyebrow: 'Ngân hàng đề', title: 'Tạo đề bằng AI và quản lý dễ dàng', description: 'Giáo viên có thể bắt đầu từ AI hoặc soạn thủ công, sau đó lưu, tìm kiếm và giao bài từ cùng một ngân hàng đề.', image: '/assets/landing/v1/quiz-management.png', imageAlt: 'Minh họa giao diện quản lý đề trên TôHiệuQuiz', bullets: ['Tìm kiếm và lọc theo môn, khối, trạng thái', 'Phân biệt đề cá nhân và đề dùng chung', 'Giao bài, đặt hạn nộp và giới hạn lượt làm'], tone: 'blue' },
    { eyebrow: 'Thi trực tiếp', title: 'Vào phiên thi bằng mã tham gia', description: 'Giáo viên mở phiên thi, học sinh nhập mã và cả lớp có thể bắt đầu trong vài thao tác đơn giản.', image: '/assets/landing/v1/live-exam.png', imageAlt: 'Minh họa giao diện phiên thi trực tiếp trên TôHiệuQuiz', bullets: ['Mã tham gia ngắn, dễ đọc trên lớp', 'Theo dõi phòng chờ và tiến độ theo thời gian thực'], tone: 'amber' },
    { eyebrow: 'Động lực học tập', title: 'Ghi nhận nỗ lực theo cách tích cực', description: 'Nhiệm vụ, xu thưởng và thành tích giúp học sinh có thêm động lực để duy trì thói quen học tập.', image: '/assets/landing/v1/gift-shop.png', imageAlt: 'Minh họa khu vực phần thưởng trên TôHiệuQuiz', bullets: ['Giáo viên ghi nhận nỗ lực kèm lý do rõ ràng', 'Học sinh theo dõi thành tích và mục tiêu của mình'], tone: 'green' },
];

export const roleBenefits: RoleBenefit[] = [
    { id: 'teacher', label: 'Giáo viên', title: 'Nhẹ việc hành chính, nặng giá trị chuyên môn', description: 'Tạo, giao và xem lại bài trong một quy trình mạch lạc để thầy cô dành nhiều thời gian hơn cho học sinh.', image: '/assets/landing/v1/teacher-benefits-960.webp', imageSmall: '/assets/landing/v1/teacher-benefits-640.webp', imageAlt: 'Giáo viên sử dụng máy tính trong không gian lớp học', bullets: ['Tạo và giao đề theo lớp hoặc từng học sinh', 'Theo dõi trạng thái bài giao và kết quả', 'Quản lý lớp, thông báo và hoạt động học tập tập trung'] },
    { id: 'student', label: 'Học sinh', title: 'Mỗi bài làm là một bước tiến bộ', description: 'Bảng điều khiển học sinh gom bài được giao, nhiệm vụ và thành tích vào trải nghiệm rõ ràng, vui vẻ.', image: '/assets/landing/v1/student-benefits-960.webp', imageSmall: '/assets/landing/v1/student-benefits-640.webp', imageAlt: 'Học sinh tiểu học học tập vui vẻ cùng máy tính bảng', bullets: ['Biết mình cần làm gì trong ngày', 'Nhìn thấy phản hồi và thành tích của bản thân', 'Đặt mục tiêu học tập theo từng bước nhỏ'] },
    { id: 'parent', label: 'Phụ huynh & nhà trường', title: 'Minh bạch, kịp thời và cùng một hướng', description: 'Thông tin học tập được chia sẻ đúng nơi để gia đình và nhà trường cùng đồng hành với học sinh.', bullets: ['Cổng phụ huynh riêng cho kết quả và thông báo', 'Phiếu điểm do giáo viên gửi sau đợt kiểm tra', 'Thông tin rõ ràng, tránh bỏ lỡ điều quan trọng'] },
];

export const competitionRounds = [
    { title: 'Khởi động', description: 'Làm quen với nhịp thi và những câu hỏi nền tảng.' },
    { title: 'Thử thách', description: 'Rèn tư duy, sự tập trung và khả năng vận dụng.' },
    { title: 'Tăng tốc', description: 'Cân bằng tốc độ với độ chính xác trong từng câu hỏi.' },
    { title: 'Về đích', description: 'Ghi nhận nỗ lực và lan tỏa tinh thần học tập tích cực.' },
];

export const facts = [
    { value: 'Lớp 1–5', label: 'Nội dung phù hợp các khối tiểu học' },
    { value: '3 vai trò', label: 'Giáo viên, học sinh và phụ huynh cùng kết nối' },
    { value: '2 hình thức', label: 'Luyện tập và kiểm tra trực tiếp trên trình duyệt' },
    { value: 'Một nơi', label: 'Tạo đề, giao bài, làm bài và xem kết quả' },
];

export const gettingStartedSteps = [
    { number: '01', title: 'Chọn vai trò', description: 'Chọn học sinh, giáo viên hoặc phụ huynh để đi đúng vào khu vực của mình.' },
    { number: '02', title: 'Bắt đầu học tập', description: 'Giáo viên tạo và giao bài; học sinh mở bài được giao; phụ huynh kết nối với tài khoản của con.' },
    { number: '03', title: 'Theo dõi tiến bộ', description: 'Cùng nhìn lại kết quả, ghi nhận nỗ lực và chọn bước tiếp theo phù hợp.' },
];
