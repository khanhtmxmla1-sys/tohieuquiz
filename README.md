# TôHiệuQuiz

TôHiệuQuiz là nền tảng tạo đề, giao bài, tổ chức kiểm tra và theo dõi tiến bộ học tập dành cho giáo viên, học sinh và phụ huynh.

Repository này là một hệ thống độc lập, được khởi tạo với lịch sử Git mới và không chứa dữ liệu production, tài khoản, secret hoặc liên kết hạ tầng của hệ thống nguồn.

## Kiến trúc

- Frontend: React, TypeScript, Vite, Zustand.
- Backend: Cloudflare Workers.
- Database: Cloudflare D1.
- Lưu trữ: Cloudflare R2.
- Xử lý nền: Cloudflare Queues.
- Kiểm thử: Vitest và Cypress.

## Chạy cục bộ

Yêu cầu Node.js 22.22 trở lên.

```bash
npm ci
cd workers && npm ci && cd ..
copy .env.example .env.local
npm run dev
```

API cục bộ mặc định được proxy tới `http://127.0.0.1:8787`. Chạy Worker ở terminal khác khi cần kiểm thử API:

```bash
cd workers
npx wrangler dev --config wrangler.toml
```

## Kiểm tra chất lượng

```bash
npx tsc --noEmit
npx tsc -p workers/tsconfig.json --noEmit
npm run test:run
npm run security:check
npm run build
```

## Trạng thái hạ tầng

Các domain và resource ID trong cấu hình hiện là placeholder `.invalid`. Không deploy trước khi hoàn tất `docs/deployment/NEW_SYSTEM_SETUP.md` và `DEPLOYMENT_CHECKLIST.md`.

Không đưa mật khẩu, OTP, API key hoặc token vào Git, issue, log, ảnh chụp hoặc nội dung chat.
