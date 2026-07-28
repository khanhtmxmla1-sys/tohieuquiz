import React from 'react';
import { FlaskConical } from 'lucide-react';

const TrialPreviewNotice: React.FC = () => (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Bản tạo thử">
        <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
                <h4 className="font-bold text-blue-950">Bản tạo thử 3 câu</h4>
                <p className="mt-1 text-sm text-blue-800">
                    Hãy kiểm tra chất lượng, sinh lại câu chưa phù hợp hoặc hoàn tác thay đổi. Bản thử không thể lưu; cần tạo đề đầy đủ sau khi duyệt.
                </p>
            </div>
        </div>
    </section>
);

export default TrialPreviewNotice;
