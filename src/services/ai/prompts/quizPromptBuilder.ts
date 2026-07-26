/**
 * @module quizPromptBuilder
 * Builds the full prompt sent to AI providers for quiz generation.
 */

import type { QuizGenerationOptions } from '../../geminiService';
import { buildPromptV3 as buildPromptV3Internal } from './slotPromptBuilder';
export { buildPromptV3 } from './slotPromptBuilder';

const SCIENTIFIC_GROUNDING_PROMPT = `
    [SCIENTIFIC RESEARCH PHASE]:
    Truoc khi tao mang cau hoi, hay thuc hien cac buoc tu duy sau:
    1. Xac dinh kien thuc cot loi va cac su that khoa hoc cua chu de.
    2. Phan tich cac loi sai pho bien ma hoc sinh lua tuoi nay thuong mac phai. Dung chung de tao phuong an nhieu co tinh thach thuc hop ly.
    3. Tim cac tinh huong doi thuong gan gui de long ghep vao cau hoi, giup bai thi khong bi kho khan.
`;

const PEDAGOGICAL_EXPLANATION_PROMPT = `
    [EXPLANATION GENERATOR RULE]:
    Truong "explanation" phai la mot bai giang mini 2-4 cau theo cau truc:
    - Khang dinh dap an dung va ly do chon.
    - Giai thich buoc di tu duy hoac quy tac ap dung.
    - Dua ra mot meo nho hoac lien he thuc te de hoc sinh nho lau hon.
    - Tuyet doi khong viet kieu "Dap an A la dung" mot cach don dieu.
`;

const THONG_TU_27_PROMPT = `
    [PEDAGOGICAL POLICY PROFILE - THONG TU 27]:
    - Bam yeu cau can dat cua chuong trinh tieu hoc va dung lua tuoi hoc sinh lop {CLASS_LEVEL}.
    - Ngon ngu ro rang, than thien, khong danh do meo, khong gay ap luc khong can thiet.
    - Danh gia vi su tien bo cua hoc sinh, uu tien cau hoi co y nghia hoc tap va boi canh gan gui.
    - Van cho phep phan hoa, nhung khong vuot khoi pham vi kien thuc tieu hoc Viet Nam.
`;

const GIFTED_LEARNER_PROMPT = `
    [LEARNER PROFILE - BOI DUONG HOC SINH GIOI]:
    - Nghieng ro sang boi duong hoc sinh kha gioi trong pham vi tieu hoc.
    - Tang cau hoi can suy luan, so sanh, ket noi kien thuc va van dung vao tinh huong moi.
    - Uu tien distractor gan dung hon, buoc hoc sinh phai phan tich ky thay vi doan meo.
    - Khuyen khich hoc sinh giai thich ly do, nhan ra quy luat va ap dung linh hoat.
    - Tuyet doi khong vuot khoi khung chuong trinh tieu hoc.
`;

const REMEDIAL_LEARNER_PROMPT = `
    [LEARNER PROFILE - PHU DAO HOC SINH YEU KEM]:
    - Uu tien cung co kien thuc cot loi va cac yeu cau can dat toi thieu.
    - Tang cau hoi nhan biet va thong hieu gan, cau ngan, ro, truc dien.
    - Giam distractor gay roi, tranh cach hoi vong vo, uu tien phan hoi giup sua loi sai pho bien.
    - Tao cam giac hoc duoc, lam duoc, xay dung tu tin hoc tap cho hoc sinh.
`;

const INTENT_PROMPTS = {
  EXAM: `
    [INTENT: EXAM]
    - Câu hỏi ngắn gọn, trung lập. Không đưa gợi ý trong nội dung câu hỏi.
    - Không lặp cùng một kỹ năng bằng cách đổi số đơn giản.
    - Phương án nhiễu phải hợp lý nhưng chỉ có đúng số đáp án theo schema.
    - explanation vẫn phải đầy đủ để giáo viên duyệt, nhưng không xuất hiện khi học sinh đang làm bài.`,
  PRACTICE: `
    [INTENT: PRACTICE]
    - Sắp xếp từ kiến thức cốt lõi đến vận dụng.
    - Lời giải phải hướng dẫn từng bước, nêu lỗi sai thường gặp và một mẹo nhớ ngắn.
    - Ngôn ngữ khuyến khích, không gây áp lực.`,
} as const;

const buildTypeDescriptions = (options?: QuizGenerationOptions): Record<string, string> => ({
  MCQ: 'MCQ (Trac nghiem chon 1 dap an dung. Format: {"type":"MCQ","question":"Noi dung cau hoi 1 dong","options":["A...","B...","C...","D..."],"correctAnswer":"A","explanation":"..."} )',
  TRUE_FALSE: 'TRUE_FALSE (Dung sai. Format: {"type":"TRUE_FALSE","mainQuestion":"Cau hoi chinh","items":[{"statement":"Y 1","isCorrect":true},{"statement":"Y 2","isCorrect":false}]})',
  SHORT_ANSWER: 'SHORT_ANSWER (Dien dap an ngan. Format: {"type":"SHORT_ANSWER","question":"Cau hoi","correctAnswer":"Dap an"} )',
  MATCHING: 'MATCHING (Noi cot. Format: {"type":"MATCHING","question":"Cau hoi","pairs":[{"left":"A","right":"1"},{"left":"B","right":"2"}]})',
  MULTIPLE_SELECT: 'MULTIPLE_SELECT (Chon tat ca dap an dung. Format: {"type":"MULTIPLE_SELECT","question":"Cau hoi","options":["A","B","C","D"],"correctAnswers":["A","C"]})',
  DRAG_DROP: 'DRAG_DROP (Dien tu vao cho trong. question chua de bai, text chua doan van voi tu dung trong [ngoac vuong], blanks la mang tu dung, distractors la mang tu nhieu.)',
  ORDERING: 'ORDERING (Sap xep thu tu cau. items la mang cau da xao tron, correctOrder la mang chi thu tu dung.)',
  IMAGE_QUESTION: `IMAGE_QUESTION (Trac nghiem co hinh anh. ${options?.imageLibrary?.length ? 'Co thu vien anh, uu tien dung ID anh da upload.' : 'Khong co hinh upload, dung "IMAGE_PROMPT: mo ta" de AI tu ve.'})`,
  DROPDOWN: [
    'DROPDOWN (Điền vào chỗ trống bằng danh sách chọn.)',
    'Format bắt buộc:',
    '{"type":"DROPDOWN","question":"Chọn đáp án đúng","text":"Thủ đô Việt Nam là [1].","blanks":[{"id":"1","options":["lựa chọn 1","lựa chọn 2"],"correctAnswer":"lựa chọn 1"}],"explanation":"Giải thích đầy đủ.","difficultyLevel":2}',
    'Mỗi [id] trong text phải có đúng một object cùng id trong blanks.',
    'correctAnswer phải thuộc options của chính blank đó.',
  ].join(' '),
  UNDERLINE: 'UNDERLINE (Gach chan tu/cum tu. Format: {"type":"UNDERLINE","question":"...","sentence":"...","words":[...],"correctWordIndexes":[1]})',
  CATEGORIZATION: [
    'CATEGORIZATION (Kéo thả từng mục vào nhóm.)',
    'Format bắt buộc:',
    '{"type":"CATEGORIZATION","question":"Phân loại các mục","categories":[{"id":"nhom-1","name":"Tên nhóm 1"},{"id":"nhom-2","name":"Tên nhóm 2"}],"items":[{"id":"item-1","content":"Nội dung cần phân loại","categoryId":"nhom-1"}],"explanation":"Giải thích đầy đủ.","difficultyLevel":2}',
    'Mỗi categories[].id và items[].id phải khác nhau, không được rỗng.',
    'Mỗi items[].categoryId phải trùng chính xác với một categories[].id đã khai báo.',
  ].join(' '),
  WORD_SCRAMBLE: 'WORD_SCRAMBLE (Sap xep chu cai thanh tu. Format: {"type":"WORD_SCRAMBLE","question":"...","letters":[...],"correctWord":"..."})',
  RIDDLE: 'RIDDLE (Cau do chu tieng Viet. Format: {"type":"RIDDLE","question":"...","riddleLines":[...],"correctAnswer":"1 tieng","answerType":"original|transformed","answerLabel":"...","hint":"..."})',
  ERROR_CORRECTION: 'ERROR_CORRECTION (Tim tu sai va sua lai. Format: {"type":"ERROR_CORRECTION","question":"...","passage":"...","wrongWord":"...","correctWord":"..."})',
});

const buildPromptProfileSections = (
  classLevel: string,
  options?: QuizGenerationOptions
): { pedagogicalPolicySection: string; learnerProfileSection: string } => {
  const promptProfile = options?.promptProfile;
  if (!promptProfile?.useThongTu27) {
    return { pedagogicalPolicySection: '', learnerProfileSection: '' };
  }

  let learnerProfileSection = '';
  if (promptProfile.learnerMode === 'gifted') {
    learnerProfileSection = GIFTED_LEARNER_PROMPT;
  } else if (promptProfile.learnerMode === 'remedial') {
    learnerProfileSection = REMEDIAL_LEARNER_PROMPT;
  }

  return {
    pedagogicalPolicySection: THONG_TU_27_PROMPT.replace('{CLASS_LEVEL}', classLevel),
    learnerProfileSection,
  };
};

export const buildPrompt = (
  topic: string,
  classLevel: string,
  content: string,
  options?: QuizGenerationOptions
): string => {
  if (options?.promptVersion === 'ai-blueprint-v3' && options.blueprintV3) {
    return buildPromptV3Internal({
      topic,
      classLevel,
      content,
      options: { ...options, blueprintV3: options.blueprintV3 },
    });
  }
  const blueprint = options?.blueprint;
  const title = options?.title || `Kiem tra: ${topic}`;
  const count = blueprint?.totalQuestions ?? options?.questionCount ?? 10;
  const types = blueprint
    ? blueprint.typeAllocations.filter(({ count: allocationCount }) => allocationCount > 0).map(({ type }) => type)
    : options?.questionTypes || [];
  const levels = blueprint?.difficultyLevels ?? options?.difficultyLevels;
  const customPrompt = options?.customPrompt?.trim();
  const images = options?.imageLibrary || [];
  const intentSection = blueprint ? INTENT_PROMPTS[blueprint.intent] : '';
  const typeAllocationSection = blueprint
    ? `
    TYPE ALLOCATION - BẮT BUỘC ĐÚNG CHÍNH XÁC:
    ${blueprint.typeAllocations.map(({ type, count: allocationCount }) => `${type}: ${allocationCount} câu`).join('\r\n    ')}
    Tổng các dòng trên phải bằng đúng ${blueprint.totalQuestions} câu.`
    : '';
  const isDocumentSource = blueprint?.sourceMode === 'DOCUMENT' || (!blueprint && options?.isPdfMode);

  const typeDescriptions = buildTypeDescriptions(options);
  const typesDescription = types.map((t) => typeDescriptions[t] || t).join('\n    - ');
  const typesList = types.join(', ');
  const { pedagogicalPolicySection, learnerProfileSection } = buildPromptProfileSections(classLevel, options);

  let difficultyInstructions = '';
  if (levels) {
    difficultyInstructions = `
    PHAN BO CAU HOI THEO MUC DO NHAN THUC:

    Muc 1 - NHAN BIET (${levels.level1} cau): Cau hoi don gian, quen thuoc, ap dung truc tiep.
    Muc 2 - THONG HIEU (${levels.level2} cau): Ket noi 2-3 kien thuc, tinh huong tuong tu.
    Muc 3 - VAN DUNG (${levels.level3} cau): Cau hoi phuc tap hon, gan voi tinh huong thuc te.

    TONG CONG: ${levels.level1 + levels.level2 + levels.level3} cau

    KHONG ghi nhan muc do vao noi dung cau hoi.
    BAT BUOC: Moi cau phai co truong "difficultyLevel": 1, 2 hoac 3.
    THU TU: Muc 1 dau de -> Muc 2 giua -> Muc 3 cuoi.`;
  }

  let imageInstructions = '';
  if (images.length > 0) {
    const imageList = images.map((img, idx) => `${idx + 1}. "${img.name}" (ID: ${img.id})`).join('\n    ');
    imageInstructions = `

    THU VIEN HINH ANH DA UPLOAD:
    ${imageList}

    Uu tien su dung cac hinh anh tren. Khi dung, them truong "image" voi gia tri la ID cua hinh.`;
  }

  let customPromptSection = '';
  if (customPrompt) {
    customPromptSection = `

    YEU CAU DAC BIET TU GIAO VIEN (UU TIEN CAO, NHUNG KHONG DUOC MAU THUAN VOI PEDAGOGICAL POLICY NEU DANG BAT):
    "${customPrompt}"`;
  }

  return `
    GIOI HAN SO LUONG - QUY TAC TUYET DOI
    SO CAU HOI: CHINH XAC ${count} CAU. Vi pham -> toan bo de bi huy.

    Tao de kiem tra cho hoc sinh Lop ${classLevel}.
    ${customPromptSection}

    ${SCIENTIFIC_GROUNDING_PROMPT}
    ${PEDAGOGICAL_EXPLANATION_PROMPT}
    ${intentSection}
    ${pedagogicalPolicySection}
    ${learnerProfileSection}

    THONG TIN CAU HINH:
    - Tieu de: "${title}"
    - Chu de: "${topic}"
    - SO CAU: ${count} (KHONG DUOC THAY DOI)

    METADATA AI BAT BUOC O CAP ROOT JSON:
    - detectedCategory: "toan" | "tieng-viet" | "tieng-anh" | "tu-nhien-xa-hoi" | "tin-hoc"
    - detectedLesson: Ten bai hoc tom tat gon
    - suggestedTags: Mang 3-5 hashtag (chu thuong, khong dau, dung "_")

    ${typeAllocationSection}
    ${difficultyInstructions}
    ${imageInstructions}

    CHI DUOC PHEP SU DUNG CAC DANG CAU HOI SAU:
    - ${typesDescription}

    ${isDocumentSource ? `
    [PDF MODE - OCR FIRST]
    - Dung noi dung OCR ben duoi la NGUON CHINH.
    OCR CONTENT FROM FILE:
    ${content ? `"${content}"` : '[ERROR: missing OCR content]'}
    ` : `
    NOI DUNG THAM KHAO:
    ${content || 'Khong co noi dung cu the. Hay tu dong sinh cau hoi dua tren kien thuc chuan cua sach giao khoa tieu hoc Viet Nam.'}
    `}

    QUY TAC BAT BUOC:
    1. TAO DUNG ${count} CAU - GIOI HAN CUNG.
    2. CHI dang: ${typesList}.
    3. Ngon ngu: Tieng Viet, phu hop tieu hoc.
    4. ROOT JSON: title, detectedCategory, detectedLesson, suggestedTags, questions.

    QUY TAC LATEX:
    - Chu Tieng Viet khong nam trong $...$
    - $...$ chi chua so, phep toan (+-x:=), \\frac{}{}, \\sqrt{}, ky hieu toan.

    KIEM TRA LAN CUOI: Dem lai so cau hoi. Phai DUNG ${count} cau.
  `;
};
