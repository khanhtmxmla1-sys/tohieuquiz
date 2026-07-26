import {
  CERTIFICATE_NAME_FONTS,
  type CertificateNameFont,
} from '../../../../shared/certificates.contract';

const FONT_LABELS: Record<CertificateNameFont, string> = {
  'Great Vibes': 'Great Vibes · Trang trọng',
  'Dancing Script': 'Dancing Script · Thân thiện',
  'Playwrite VN': 'Playwrite Việt Nam · Rõ dấu',
  Allura: 'Allura · Thanh lịch',
  'Alex Brush': 'Alex Brush · Bay bổng',
};

interface CertificateContentFieldsProps {
  achievementPrefix: string;
  setAchievementPrefix: (value: string) => void;
  dateLine: string;
  setDateLine: (value: string) => void;
  studentNameFont: CertificateNameFont;
  setStudentNameFont: (value: CertificateNameFont) => void;
}

export const CertificateContentFields = (props: CertificateContentFieldsProps) => (
  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-3">
    <p className="text-sm font-semibold text-amber-900">Nội dung in trên chứng nhận</p>
    <fieldset>
      <legend className="block text-xs font-semibold text-slate-700 mb-2">
        Kiểu chữ tên học sinh
      </legend>
      <div
        role="radiogroup"
        aria-label="Kiểu chữ tên học sinh"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {CERTIFICATE_NAME_FONTS.map(font => {
          const selected = props.studentNameFont === font;
          return (
            <label
              key={font}
              className={`cursor-pointer rounded-xl border bg-white px-3 py-2 transition ${
                selected
                  ? 'border-amber-500 ring-2 ring-amber-200'
                  : 'border-amber-200 hover:border-amber-400'
              }`}
            >
              <input
                type="radio"
                name="student-name-font"
                value={font}
                checked={selected}
                onChange={() => props.setStudentNameFont(font)}
                className="sr-only"
              />
              <span className="block text-[11px] font-semibold text-slate-600">
                {FONT_LABELS[font]}
              </span>
              <span
                className="mt-1 block truncate text-2xl leading-8 text-slate-900"
                style={{ fontFamily: `"${font}", cursive` }}
              >
                Lê Văn Tuấn
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Xem trước dùng đúng font sẽ xuất trên chứng nhận gửi cho học sinh.
      </p>
    </fieldset>
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">Mở đầu thành tích</label>
      <input
        type="text"
        value={props.achievementPrefix}
        maxLength={160}
        onChange={event => props.setAchievementPrefix(event.target.value)}
        placeholder="Đã hoàn thành xuất sắc"
        className="w-full border border-amber-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      <p className="mt-1 text-xs text-slate-500">Tên bài thi sẽ được tự động nối phía sau.</p>
    </div>
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">Dòng ngày cấp</label>
      <input
        type="text"
        value={props.dateLine}
        maxLength={200}
        onChange={event => props.setDateLine(event.target.value)}
        placeholder="Mường La, ngày 15 tháng 7 năm 2026"
        className="w-full border border-amber-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  </div>
);
