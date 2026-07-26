/**
 * ítong Homework Constants
 */

export const IMAGE_CONFIG = {
  MAX_SIZE_MB: 0.8,              // Max 800KB for faster upload and processing
  MAX_WIDTH_HEIGHT: 1920,       // Full HD is enough for OCR
  COMPRESSION_LEVEL: 0.7,        // Balance between quality and size
};

export const AI_PROMPTS = {
  GRADING: `Bạn là một giáo viên chuyên nghiệp. 
Nhiệm vụ của bạn là:
1. Đọc nội dung chữ viết tay trong ảnh (OCR).
2. Chấm điểm bài làm dựa trên đáp án mẫu và thang điểm.
3. Đưa ra nhận xét tích cực và hướng dẫn học sinh cải thiện.

Hãy trả về kết quả dưới dạng JSON với cấu trúc:
{
  "ocrText": "...",
  "score": 0.0,
  "confidence": 0.0,
  "feedback": "...",
  "criteriaBreakdown": [{ "label": "...", "score": 0, "maxScore": 0, "comment": "..." }],
  "flaggedReason": null
}`,
};
