# Teacher dashboard visual sources

Bộ nguồn vector trong thư mục này được tạo riêng cho dashboard giáo viên TôHiệuQuiz. Tất cả file có nền trong suốt, không chứa chữ, logo hoặc watermark.

| semanticName | sourceFilename | target | expectedRatio | maxBytes |
| --- | --- | --- | --- | ---: |
| teacher-welcome | teacher-welcome.svg | public/illustrations/tohieuquiz/teacher-dashboard-v2/teacher-welcome.webp | 16:9 | 160000 |
| ai-quiz-robot | ai-quiz-robot.svg | public/illustrations/tohieuquiz/teacher-dashboard-v2/ai-quiz-robot.webp | 4:3 | 90000 |
| manual-quiz | manual-quiz.svg | public/illustrations/tohieuquiz/teacher-dashboard-v2/manual-quiz.webp | 4:3 | 90000 |
| assignment | assignment.svg | public/icons/tohieuquiz/dashboard-v2/assignment.webp | 1:1 | 32000 |
| live-exam | live-exam.svg | public/icons/tohieuquiz/dashboard-v2/live-exam.webp | 1:1 | 32000 |
| results | results.svg | public/icons/tohieuquiz/dashboard-v2/results.webp | 1:1 | 32000 |
| students | students.svg | public/icons/tohieuquiz/dashboard-v2/students.webp | 1:1 | 32000 |
| classroom | classroom.svg | public/icons/tohieuquiz/dashboard-v2/classroom.webp | 1:1 | 32000 |
| certificate | certificate.svg | public/icons/tohieuquiz/dashboard-v2/certificate.webp | 1:1 | 32000 |
| quiz-management | quiz-management.svg | public/icons/tohieuquiz/dashboard-v2/quiz-management.webp | 1:1 | 32000 |
| quiz-create | quiz-create.svg | public/icons/tohieuquiz/dashboard-v2/quiz-create.webp | 1:1 | 32000 |

Tạo lại output bằng `npm run assets:teacher-dashboard`. Pipeline kiểm tra alpha, kích thước, ngân sách byte, checksum và vùng góc trong suốt.
