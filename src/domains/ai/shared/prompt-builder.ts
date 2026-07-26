/**
 * Prompt Builder
 * 
 * Builds AI prompts for quiz generation.
 * Follows Single Responsibility - only handles prompt construction.
 */

import type { QuizGenerationOptions, ImageLibraryItem } from '../ai.types';

/**
 * Map of question type to Vietnamese description for AI
 */
const TYPE_DESCRIPTIONS: Record<string, string> = {
    'MCQ': 'MCQ (Trắc nghiệm chọn 1 đáp án đúng trong 4 lựa chọn A, B, C, D)',
    'TRUE_FALSE': 'TRUE_FALSE (Cho một câu hỏi chính và nhiều phát biểu, học sinh chọn Đúng hoặc Sai cho mỗi phát biểu)',
    'SHORT_ANSWER': 'SHORT_ANSWER (Điền đáp án ngắn, thường là 1-4 ký tự hoặc số)',
    'MATCHING': 'MATCHING (Nối các ý ở cột A với cột B sao cho phù hợp, có 3-4 cặp)',
    'MULTIPLE_SELECT': 'MULTIPLE_SELECT (Chọn TẤT CẢ các đáp án đúng, có thể 2-3 đáp án đúng trong 4 lựa chọn, correctAnswers là mảng như ["A", "C"])',
    'DRAG_DROP': 'DRAG_DROP (Điền từ vào chỗ trống. Text chứa các từ cần điền trong ngoặc vuông, ví dụ: "Con mèo [trèo] cây cau". Blanks là mảng các từ trong ngoặc ["trèo"]. Distractors là mảng các từ gây nhiễu ["bơi", "bay"])'
};

/**
 * Build difficulty level instructions
 */
const buildDifficultyInstructions = (levels: { level1: number; level2: number; level3: number }): string => {
    return `
    PHAN BO CAU HOI THEO MUC DO:
    - Muc 1 (Nhan biet): ${levels.level1} cau - De, quen thuoc
    - Muc 2 (Thong hieu): ${levels.level2} cau - Trung binh
    - Muc 3 (Van dung cao): ${levels.level3} cau - Kho, thuc tien
    
    TONG CONG: ${levels.level1 + levels.level2 + levels.level3} cau
    
    ⚠️ YEU CAU BAT BUOC VE MUC DO:
    Moi cau hoi PHAI co truong "difficulty" voi gia tri la 1, 2 hoac 3 tuong ung voi muc do.
    Vi du: { "type": "MCQ", "question": "...", "difficulty": 2, ... }`;
};

/**
 * Build image library instructions
 */
const buildImageInstructions = (images: ImageLibraryItem[]): string => {
    if (!images || images.length === 0) return '';

    const imageList = images.map((img, idx) => `${idx + 1}. "${img.name}" (ID: ${img.id})`).join('\n    ');

    return `
    
    THU VIEN HINH ANH DA UPLOAD (co the gan vao cau hoi):
    ${imageList}
    
    ⚠️ YEU CAU BAT BUOC VE HINH ANH:
    1. UU TIEN TUYET DOI viec su dung cac hinh anh tren de tao cau hoi.
    2. Hay doc ten hinh anh de hieu noi dung va tao cau hoi phu hop voi hinh do.
    3. Khi su dung hinh, BAT BUOC phai them truong "image" voi gia tri la ID cua hinh (vi du: "image": "img-123...").
    4. Noi dung cau hoi phai lien quan truc tiep den hinh anh (vi du: "Dua vao hinh ben...", "Hinh anh nay mo ta...", "Ket qua cua phep tinh trong hinh la...").
    5. Neu khong co hinh phu hop, moi tu tao cau hoi khong hinh hoac dung URL ngoai.`;
};

/**
 * Build the complete prompt for quiz generation
 * 
 * @param topic - Quiz topic
 * @param classLevel - Class level (1-5)
 * @param content - Reference content
 * @param options - Generation options
 * @returns Complete prompt string
 */
export const buildPrompt = (
    topic: string,
    classLevel: string,
    content: string,
    options?: QuizGenerationOptions
): string => {
    const title = options?.title || `Kiểm tra: ${topic}`;
    const count = options?.questionCount || 10;
    const types = options?.questionTypes || [];
    const levels = options?.difficultyLevels;
    const images = options?.imageLibrary || [];

    const typesDescription = types.map(t => TYPE_DESCRIPTIONS[t] || t).join('\n    - ');
    const typesList = types.join(', ');

    const difficultyInstructions = levels ? buildDifficultyInstructions(levels) : '';
    const imageInstructions = buildImageInstructions(images);

    return `
    🔍 BƯỚC 1: TÌM KIẾM TÀI LIỆU (ƯU TIÊN TRƯỚC KHI TỰ TẠO)
    Trước khi tạo câu hỏi, hãy tìm kiếm trên internet:
    - Đề thi, bài kiểm tra mẫu Lớp ${classLevel} từ các trường tiểu học Việt Nam về chủ đề "${topic}"
    - Bài tập sách giáo khoa, sách bài tập Lớp ${classLevel}
    - Ngân hàng đề thi từ violympic, hoc247, vndoc, loigiaihay
    - Đề thi học kỳ của Bộ GD&ĐT
    
    📚 HƯỚNG DẪN THEO MÔN HỌC:
    
    🧮 MÔN TOÁN:
    - TÌM KIẾM các dạng bài toán từ: VyOlimpic (violympic.vn), VioEdu (vioedu.vn)
    - Ưu tiên dạng bài: Tính nhanh, tìm x, điền số, so sánh, hình học cơ bản
    - Tham khảo: Toán tư duy, Toán logic, Toán Olympic cấp Tiểu học
    - Format: Rõ ràng, có hình minh họa nếu cần, đáp án ngắn gọn
    
    📖 MÔN TIẾNG VIỆT:
    - TÌM KIẾM dạng câu hỏi từ: Trạng nguyên Tiếng Việt (trangnguyen.edu.vn)
    - Ưu tiên dạng bài: Điền từ, chính tả, ngữ pháp, đọc hiểu, thành ngữ tục ngữ
    - Tham khảo: Bài tập Luyện từ và câu, Tập làm văn, Chính tả
    - Đảm bảo ngữ liệu chính xác theo chuẩn tiếng Việt
    
    → Lấy ý tưởng từ các câu hỏi thực tế, điều chỉnh cho phù hợp với yêu cầu bên dưới.
    
    Tao de kiem tra cho hoc sinh Lop ${classLevel}.
    
    THONG TIN CAU HINH:
    - Tieu de bai kiem tra: "${title}"
    - Chu de: "${topic}"
    - Tong so luong cau hoi can tao: CHINH XAC ${count} cau.
    ${difficultyInstructions}
    ${imageInstructions}
    
    ⚠️ CHỈ ĐƯỢC PHÉP SỬ DỤNG CÁC DẠNG CÂU HỎI SAU (KHÔNG ĐƯỢC DÙNG DẠNG KHÁC):
    - ${typesDescription}
    
    NỘI DUNG THAM KHẢO:
    ${content ? `"${content}"` : "Không có nội dung cụ thể. Hãy tự động sinh câu hỏi dựa trên kiến thức chuẩn của sách giáo khoa Tiểu học Việt Nam phù hợp với Chủ đề và Lớp học đã nêu trên."}

    ⛔ QUY TẮC BẮT BUỘC:
    1. CHỈ tạo câu hỏi thuộc dạng: ${typesList}. TUYỆT ĐỐI KHÔNG tạo dạng câu hỏi nào khác.
    2. Phân bổ đều ${count} câu cho các dạng đã chọn.
    3. Nếu chỉ chọn 1 dạng (ví dụ: MULTIPLE_SELECT), thì TẤT CẢ ${count} câu đều phải là dạng đó.
    4. Với MULTIPLE_SELECT: correctAnswers phải là mảng có ít nhất 2 đáp án đúng, ví dụ: ["A", "C"] hoặc ["B", "C", "D"].
    5. Ngôn ngữ: Tiếng Việt, phù hợp với học sinh tiểu học.
    6. Đảm bảo đầu ra đúng định dạng JSON.
    7. QUY TẮC VIẾT PHÉP TÍNH:
       - Phân số: Viết liền không cách (ví dụ: 1/2, 3/4).
       - Phép chia: Viết có khoảng cách (ví dụ: 10 / 2, 15 / 3).
       - Phép nhân: Viết có khoảng cách (ví dụ: 5 * 3).
  `;
};

/**
 * Build file attachment prompt prefix
 */
export const buildFileAttachmentPrompt = (): string => {
    return `⚠️ TÀI LIỆU ĐÍNH KÈM (Attached File) - ƯU TIÊN CAO NHẤT:
Đây là tài liệu bài học/nội dung do giáo viên tải lên.

🔴 YÊU CẦU BẮT BUỘC:
1. ĐỌC KỸ VÀ HIỂU nội dung trong tài liệu này.
2. TẠO CÂU HỎI DỰA TRÊN NỘI DUNG TRONG TÀI LIỆU NÀY LÀ CHÍNH.
3. Tất cả câu hỏi phải liên quan trực tiếp đến kiến thức trong tài liệu.
4. Không tự bịa nội dung ngoài tài liệu trừ khi cần bổ sung.
5. Nếu là ảnh chụp bài học, hãy đọc văn bản trong ảnh và tạo câu hỏi từ đó.
6. Nếu là PDF, hãy phân tích và trích xuất nội dung để tạo câu hỏi.

Tài liệu đính kèm:`;
};
