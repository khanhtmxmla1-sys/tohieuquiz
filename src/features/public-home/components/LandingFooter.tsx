import React from 'react';
import { ArrowUp, Mail } from 'lucide-react';
import { Link } from 'react-router';
import SchoolLogo from '../../../components/common/SchoolLogo';
import { getSystemDateParts } from '../../../utils/dateTime';
import { landingContent } from '../publicHomeLanding.content';

const LandingFooter: React.FC = () => (
    <footer className="public-home__footer">
        <div className="public-home__container public-home__footer-grid">
            <div className="public-home__footer-brand">
                <a className="public-home__brand" href="#top" aria-label="TôHiệuQuiz — về đầu trang">
                    <span className="public-home__brand-mark"><SchoolLogo size={36} decorative /></span>
                    <span>
                        <span className="public-home__brand-name">TôHiệu<span>Quiz</span></span>
                        <span className="public-home__brand-subline">{landingContent.brandSubline}</span>
                    </span>
                </a>
                <p>Nền tảng học và kiểm tra trực tuyến cho học sinh lớp 1–5 — mỗi ngày một tiến bộ, mỗi bài học thêm tự tin.</p>
            </div>
            <div>
                <h2>Khám phá</h2>
                <nav aria-label="Liên kết nội dung landing">
                    <a href="#doi-tuong">Dành cho ai</a>
                    <a href="#tinh-nang">Tính năng</a>
                    <a href="#loi-ich">Lợi ích</a>
                    <a href="#trang-nguyen">Trạng Nguyên Nhí</a>
                </nav>
            </div>
            <div>
                <h2>Thông tin</h2>
                <nav aria-label="Liên kết thông tin công khai">
                    <Link to="/truong-tieu-hoc-to-hieu-son-la">Nhà trường</Link>
                    <Link to="/about">Giới thiệu</Link>
                    <Link to="/contact">Liên hệ</Link>
                    <Link to="/privacy">Chính sách bảo mật</Link>
                    <Link to="/tos">Điều khoản sử dụng</Link>
                </nav>
            </div>
            <div>
                <h2>Hỗ trợ</h2>
                <p className="public-home__footer-note">Cần hỗ trợ khi sử dụng? Hãy liên hệ với nhà trường để được hướng dẫn.</p>
                <a className="public-home__footer-mail" href="mailto:tongminhkhanh@gmail.com"><Mail aria-hidden="true" />Gửi email hỗ trợ</a>
            </div>
        </div>
        <div className="public-home__container public-home__footer-bottom">
            <span>© {getSystemDateParts().year} TôHiệuQuiz. Bảo lưu mọi quyền.</span>
            <a href="#top">Về đầu trang <ArrowUp aria-hidden="true" /></a>
        </div>
    </footer>
);

export default LandingFooter;
