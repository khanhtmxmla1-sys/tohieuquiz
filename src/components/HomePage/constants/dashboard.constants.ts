// --- Fluent Emoji CDN Base ---
export const FLUENT_CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

// --- Coming Soon Categories ---
export const COMING_SOON_CATEGORIES = ['science', 'history'];

// --- Grade Colors ---
export const GRADE_COLORS: Record<string, string> = {
    '1': '#00B894', 
    '2': '#0984E3', 
    '3': '#6C5CE7', 
    '4': '#E17055', 
    '5': '#F39C12',
};

// --- Subject Config (Sticker Land) ---
export interface SubjectConfigItem {
    label: string;
    title: string;
    desc: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    btnColor: string;
    btnBorder: string;
    btnText: string;
    btnLabel: string;
    highlight?: boolean;
}

export const SUBJECT_CONFIG: Record<string, SubjectConfigItem> = {
    'all': {
        label: 'Tất Cả',
        title: 'Thư Viện Đề Thi',
        desc: 'Khám phá tất cả bài tập.',
        icon: `${FLUENT_CDN}/Open%20book/3D/open_book_3d.png`,
        color: '#6366F1', // Indigo
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        btnColor: 'bg-indigo-500 hover:bg-indigo-400',
        btnBorder: 'border-indigo-700',
        btnText: 'text-white',
        btnLabel: 'Khám phá ngay',
    },
    'class': {
        label: 'Bài Tập',
        title: 'Bài Tập Lớp',
        desc: 'Bài tập được giao từ thầy cô.',
        icon: `${FLUENT_CDN}/Books/3D/books_3d.png`,
        color: '#3B82F6',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        btnColor: 'bg-blue-500 hover:bg-blue-400',
        btnBorder: 'border-blue-700',
        btnText: 'text-white',
        btnLabel: 'Bắt đầu',
    },
    'vioedu': {
        label: 'Toán Học',
        title: 'Toán Thông Minh',
        desc: 'Cộng trừ nhân chia thật dễ!',
        icon: `${FLUENT_CDN}/Abacus/3D/abacus_3d.png`,
        color: '#3B82F6',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        btnColor: 'bg-blue-500 hover:bg-blue-400',
        btnBorder: 'border-blue-700',
        btnText: 'text-white',
        btnLabel: 'Bắt đầu',
    },
    'trang-nguyen': {
        label: 'Tiếng Việt',
        title: 'Vua Tiếng Việt',
        desc: 'Ghép chữ, đoán từ, kể chuyện.',
        icon: `${FLUENT_CDN}/Pencil/3D/pencil_3d.png`,
        color: '#EC4899',
        bgColor: 'bg-pink-50',
        borderColor: 'border-pink-200',
        btnColor: 'bg-pink-500 hover:bg-pink-400',
        btnBorder: 'border-pink-700',
        btnText: 'text-white',
        btnLabel: 'Bắt đầu',
        highlight: true,
    },
    'on-tap': {
        label: 'Ôn Tập',
        title: 'Ôn Tập Chung',
        desc: 'Ôn tập theo từng chủ đề bài học.',
        icon: `${FLUENT_CDN}/Notebook/3D/notebook_3d.png`,
        color: '#8B5CF6',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        btnColor: 'bg-purple-500 hover:bg-purple-400',
        btnBorder: 'border-purple-700',
        btnText: 'text-white',
        btnLabel: 'Bắt đầu',
    },
    'science': {
        label: 'Khoa Học',
        title: 'Nhà Khoa Học',
        desc: 'Thí nghiệm và khám phá.',
        icon: `${FLUENT_CDN}/Test%20tube/3D/test_tube_3d.png`,
        color: '#10B981',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        btnColor: 'bg-green-500 hover:bg-green-400',
        btnBorder: 'border-green-700',
        btnText: 'text-white',
        btnLabel: 'Bắt đầu',
    },
    'history': {
        label: 'Lịch Sử',
        title: 'Sử Việt Hào Hùng',
        desc: 'Danh nhân và sự kiện.',
        icon: `${FLUENT_CDN}/Scroll/3D/scroll_3d.png`,
        color: '#F97316',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        btnColor: 'bg-orange-500 hover:bg-orange-400',
        btnBorder: 'border-orange-700',
        btnText: 'text-white',
        btnLabel: 'Bắt đầu',
    },
};
