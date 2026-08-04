import type { DiagramGenerationMode } from '../question-contracts/questionContract.types';

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

export const buildSvgDiagramPolicyPrompt = (mode: DiagramGenerationMode = 'off'): string => {
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
Ví dụ có SVG: {"slotId":"slot-2","type":"MCQ","difficulty":2,"question":"Quan sát tam giác ABC. Cạnh nào dài nhất?","options":["AB","BC","CA","Ba cạnh bằng nhau"],"correctAnswer":"B","svgContent":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 260\"><polygon points=\"80,210 320,210 190,45\" fill=\"none\" stroke=\"#1e3a8a\" stroke-width=\"4\"/><text x=\"65\" y=\"230\" font-size=\"20\">A</text><text x=\"325\" y=\"230\" font-size=\"20\">B</text><text x=\"185\" y=\"35\" font-size=\"20\">C</text></svg>","svgAlt":"Tam giác ABC có đáy AB nằm ngang và đỉnh C ở phía trên","svgVersion":1}.
Ví dụ không cần SVG: {"slotId":"slot-3","type":"MCQ","difficulty":1,"question":"Số liền sau của 249 là số nào?","options":["248","249","250","251"],"correctAnswer":"C"}.`;
};

export const buildSlotDiagramRule = (policy: 'forbidden' | 'optional' | 'required'): string => {
  if (policy === 'forbidden') return 'diagramPolicy=forbidden: tuyệt đối không trả svgContent, svgAlt hoặc svgVersion.';
  if (policy === 'required') return 'diagramPolicy=required: câu phải có geometryData hợp lệ hoặc đủ svgContent, svgAlt, svgVersion=1.';
  return 'diagramPolicy=optional: chỉ thêm SVG khi hình thực sự cần cho việc hiểu hoặc giải câu hỏi.';
};
