import type {
  AiSelectableQuizQuestionType,
  ServerQuizDiagramMode,
} from '../../../../../shared/quiz-generation.contract';

export interface ServerQuestionContractContext {
  hasImageLibrary: boolean;
}

const STATIC_CONTRACTS: Record<Exclude<AiSelectableQuizQuestionType, 'IMAGE_QUESTION'>, string> = {
  MCQ: `[CONTRACT: MCQ]\n- Tạo đúng 4 phương án không có tiền tố A/B/C/D.\n- Chỉ một đáp án đúng.\n- JSON: {"slotId":"slot-1","type":"MCQ","difficulty":2,"question":"...","options":["...","...","...","..."],"correctAnswer":"A"}`,
  TRUE_FALSE: `[CONTRACT: TRUE_FALSE]\n- Có 2 đến 4 mệnh đề độc lập, gồm ít nhất một Đúng và một Sai.\n- JSON: {"slotId":"slot-1","type":"TRUE_FALSE","difficulty":2,"mainQuestion":"...","items":[{"statement":"...","isCorrect":true},{"statement":"...","isCorrect":false}]}`,
  SHORT_ANSWER: `[CONTRACT: SHORT_ANSWER]\n- Đáp án là một từ, số hoặc cụm từ ngắn, tối đa 120 ký tự.\n- Không đưa nhiều đáp án thay thế bằng dấu / hoặc từ “hoặc”.\n- JSON: {"slotId":"slot-1","type":"SHORT_ANSWER","difficulty":2,"question":"...","correctAnswer":"..."}`,
  MATCHING: `[CONTRACT: MATCHING]\n- Tạo 3 đến 5 cặp một-một; mỗi vế là duy nhất.\n- JSON: {"slotId":"slot-1","type":"MATCHING","difficulty":2,"question":"...","pairs":[{"left":"...","right":"..."},{"left":"...","right":"..."},{"left":"...","right":"..."}]}`,
  MULTIPLE_SELECT: `[CONTRACT: MULTIPLE_SELECT]\n- Câu dẫn yêu cầu chọn tất cả đáp án đúng.\n- Có đúng 4 phương án và 2 đến 3 đáp án đúng.\n- JSON: {"slotId":"slot-1","type":"MULTIPLE_SELECT","difficulty":2,"question":"Chọn tất cả...","options":["...","...","...","..."],"correctAnswers":["A","C"]}`,
  DRAG_DROP: `[CONTRACT: DRAG_DROP]\n- text dùng marker tuần tự [1], [2], ...; đáp án nằm trong blanks, không đặt trong marker.\n- JSON: {"slotId":"slot-1","type":"DRAG_DROP","difficulty":2,"question":"...","text":"... [1] ...","blanks":["..."],"distractors":["..."]}`,
  ORDERING: `[CONTRACT: ORDERING]\n- Có 3 đến 8 mục đã xáo trộn; correctOrder là hoán vị chỉ số 0..n-1.\n- JSON: {"slotId":"slot-1","type":"ORDERING","difficulty":2,"question":"...","items":["...","...","..."],"correctOrder":[1,0,2]}`,
  DROPDOWN: `[CONTRACT: DROPDOWN]\n- text dùng marker [1], [2], ...; blank.id phải đúng số marker.\n- Mỗi blank có 2 đến 5 lựa chọn và correctAnswer thuộc options.\n- JSON: {"slotId":"slot-1","type":"DROPDOWN","difficulty":2,"question":"...","text":"... [1] ...","blanks":[{"id":"1","options":["...","..."],"correctAnswer":"..."}]}`,
  UNDERLINE: `[CONTRACT: UNDERLINE]\n- Trả targetWords, không tự tính chỉ số. Mỗi từ mục tiêu phải xuất hiện đúng một lần trong sentence.\n- JSON: {"slotId":"slot-1","type":"UNDERLINE","difficulty":2,"question":"...","sentence":"...","targetWords":["..."]}`,
  CATEGORIZATION: `[CONTRACT: CATEGORIZATION]\n- Có 2 đến 4 nhóm, 4 đến 10 mục; mọi nhóm phải có ít nhất một mục.\n- JSON: {"slotId":"slot-1","type":"CATEGORIZATION","difficulty":2,"question":"...","categories":[{"id":"a","name":"..."},{"id":"b","name":"..."}],"items":[{"id":"i1","content":"...","categoryId":"a"}]}`,
  WORD_SCRAMBLE: `[CONTRACT: WORD_SCRAMBLE]\n- letters phải ghép chính xác thành correctWord và giữ nguyên dấu tiếng Việt.\n- JSON: {"slotId":"slot-1","type":"WORD_SCRAMBLE","difficulty":2,"question":"...","letters":["h","o","a"],"correctWord":"hoa"}`,
  RIDDLE: `[CONTRACT: RIDDLE]\n- Có 2 đến 6 dòng, một đáp án ngắn duy nhất, phù hợp học sinh tiểu học.\n- Không tự nhận nguồn dân gian khi không có dữ liệu nguồn.\n- JSON: {"slotId":"slot-1","type":"RIDDLE","difficulty":2,"question":"...","riddleLines":["...","..."],"correctAnswer":"...","answerType":"original","answerLabel":"..."}`,
};

function buildImageQuestionContract(context: ServerQuestionContractContext): string {
  const imageRule = context.hasImageLibrary
    ? 'Chỉ dùng ID ảnh có trong thư viện được cung cấp.'
    : 'Dùng image token theo pipeline tạo ảnh hiện có; không dùng URL placeholder.';
  return `[CONTRACT: IMAGE_QUESTION]\n- Bắt buộc có image và imageAlt; câu hỏi phải phụ thuộc trực tiếp vào hình.\n- ${imageRule}\n- Có đúng 4 phương án và một đáp án đúng.\n- JSON: {"slotId":"slot-1","type":"IMAGE_QUESTION","difficulty":2,"question":"...","image":"image-id","imageAlt":"...","options":["...","...","...","..."],"correctAnswer":"A"}`;
}

export function buildServerQuestionTypeContractSection(
  types: readonly AiSelectableQuizQuestionType[],
  context: ServerQuestionContractContext,
): string {
  const uniqueTypes = [...new Set(types)];
  return uniqueTypes.map((type) => {
    const fragment = type === 'IMAGE_QUESTION'
      ? buildImageQuestionContract(context)
      : STATIC_CONTRACTS[type];
    return fragment.replaceAll('"slotId":"slot-1"', '"slotId":"<slotId>"');
  }).join('\n\n');
}

const SVG_SECURITY_RULES = `SVG phải:
1. Có thẻ gốc <svg>.
2. Có xmlns="http://www.w3.org/2000/svg".
3. Có viewBox.
4. Không phụ thuộc width/height cố định.
5. Có độ tương phản tốt trên nền trắng, stroke rõ trên điện thoại và nhãn chữ đủ lớn.
6. Không tải font ngoài, không có logo/watermark, animation hoặc nội dung trang trí không liên quan.
7. Không chứa JavaScript, event handler hoặc URL ngoài.
8. Không chứa ảnh raster nhúng.
9. Không dùng các tag: script, foreignObject, iframe, object, embed, audio, video, canvas, image, use, a.
10. Không dùng thuộc tính bắt đầu bằng on, href, xlink:href, src hoặc style.
11. Ngoại trừ xmlns SVG chuẩn, không chứa javascript:, data:text/html, http:// hoặc https://.`;

export function buildServerDiagramPolicyPrompt(mode: ServerQuizDiagramMode = 'off'): string {
  if (mode === 'off') {
    return `[DIAGRAM POLICY: OFF]
- Không tạo svgContent.
- Không thêm SVG raw vào image.
- Không tạo trường svgAlt hoặc svgVersion.
- Giữ hành vi hình ảnh hiện tại của hệ thống.`;
  }

  return `[SVG DIAGRAM POLICY: AUTO]
Bạn được phép tạo hình vẽ SVG cho một câu hỏi khi hình giúp học sinh hiểu đề, quan sát dữ kiện hoặc thực hiện suy luận.
Không bắt buộc mọi câu hỏi phải có SVG.
Chỉ tạo SVG cho trường hợp phù hợp: hình học, hình khối, trục số, hệ trục Oxy, đồ thị đơn giản, biểu đồ, sơ đồ khoa học hoặc quy trình.
Không tạo hình trang trí không phục vụ việc trả lời câu hỏi.
Khi có hình SVG, trả về đủ svgContent, svgAlt và svgVersion = 1.
svgContent phải là chuỗi JSON hợp lệ đã escape; không bọc trong markdown code fence và không giải thích ngoài JSON.
${SVG_SECURITY_RULES}
Ví dụ có SVG: {"slotId":"slot-2","type":"MCQ","difficulty":2,"question":"Quan sát tam giác ABC. Cạnh nào dài nhất?","options":["AB","BC","CA","Ba cạnh bằng nhau"],"correctAnswer":"B","svgContent":"<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" viewBox=\\\"0 0 400 260\\\"><polygon points=\\\"80,210 320,210 190,45\\\" fill=\\\"none\\\" stroke=\\\"#1e3a8a\\\" stroke-width=\\\"4\\\"/><text x=\\\"65\\\" y=\\\"230\\\" font-size=\\\"20\\\">A</text><text x=\\\"325\\\" y=\\\"230\\\" font-size=\\\"20\\\">B</text><text x=\\\"185\\\" y=\\\"35\\\" font-size=\\\"20\\\">C</text></svg>","svgAlt":"Tam giác ABC có đáy AB nằm ngang và đỉnh C ở phía trên","svgVersion":1}.
Ví dụ không cần SVG: {"slotId":"slot-3","type":"MCQ","difficulty":1,"question":"Số liền sau của 249 là số nào?","options":["248","249","250","251"],"correctAnswer":"C"}.`;
}
