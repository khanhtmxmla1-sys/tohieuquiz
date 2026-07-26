# TôHiệuQuiz — Kế hoạch hoàn thiện dự án (ROADMAP)

> Cập nhật: **26/07/2026 (phiên 2)**. Định hướng: hoàn thiện & ổn định tính năng trước, rollout production sau.
> Trạng thái hạ tầng chi tiết: `docs/deployment/CURRENT_PROGRESS.md`. Quy ước kiểm thử E2E: `docs/testing/e2e.md`.

## Tình trạng các giai đoạn

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Dọn dẹp repo & nền tảng làm việc | ✅ Xong |
| 1 | Nghiệm thu 5 tính năng đang tắt cờ | ✅ Xong (kiểm thử tự động) |
| 2 | Đồng bộ tài liệu với thực tế | ✅ Xong |
| 3 | CI/CD tự động | ✅ Xong (chờ bật branch protection) |
| 4 | Hạ tầng Cloudflare/Vercel & deploy | ✅ Xong, trừ AI/email/monitoring |
| 5 | Kiểm thử production & rollout cờ | ⏳ Chờ tài khoản quản trị + nhịp theo dõi |

Quality gate hiện tại (đo ngày 26/07/2026, với tất cả cờ bật ở local):

- `npx tsc --noEmit` và `npx tsc -p workers/tsconfig.json --noEmit`: 0 lỗi.
- `npm run test:run`: **268 file / 1283 test pass**, 0 fail.
- `npm run security:scan`: pass (1627 file).
- Cypress: **25 test stubbed + 2 test Blueprint V3 + 9 component test** đều pass.

---

## Giai đoạn 0 — Dọn dẹp repo ✅

- [x] `.vercel/` được `.gitignore` bỏ qua và không nằm trong Git tracking; entry trùng lặp đã gộp.
- [x] Chạy lại index GitNexus — 12.261 node, 27.056 edge, 815 cluster, 300 flow. `AGENTS.md` và `CLAUDE.md` đã đồng bộ số liệu mới.
- [x] Sửa nợ kỹ thuật ở `src/components/Game/GameCanvas.tsx`: thay `loseLife()` hack bằng `endGame()` tường minh.
  Hack cũ ăn mất một mạng rồi `resetGame()` về menu, nên người chơi **không bao giờ thấy màn hình tổng kết** sau khi trả lời hết câu hỏi. Đã bổ sung `tests/gameStore.test.ts` (6 test) khoá hành vi này.

## Giai đoạn 1 — Nghiệm thu tính năng ✅

Đã bật toàn bộ cờ ở `.env.local` và chạy thật, không chỉ đọc code.

| Tính năng | Cờ | Kết quả |
|---|---|---|
| AI Quiz V2 | `VITE_FEATURE_AI_QUIZ_V2` | ✅ 5/5 E2E pass (**yêu cầu Blueprint V3 tắt**) |
| AI Blueprint V3 | `VITE_FEATURE_AI_BLUEPRINT_V3` | ✅ 2/2 E2E pass |
| Parent Portal V1 | `VITE_FEATURE_PARENT_PORTAL_V1` | ✅ 2/2 E2E pass |
| Gift Shop V2 | `VITE_FEATURE_GIFT_SHOP_V2` | ✅ pass qua unit test + build |
| Unified Notifications | setting server `unified_notifications_v1` | ✅ 4/4 E2E pass |

### Ba phát hiện trong giai đoạn này

1. **Xung đột cờ AI V2 ↔ V3.** `ai-quiz-generation-v2.cy.ts` fail 3/5 khi bật V3, pass 5/5 khi tắt. Nguyên nhân: V3 thay thế pipeline V2 (`OCR → GENERATE → REPAIR → REVIEW`), nên stage `REPAIR` không chạy và nút "Lưu đề" không xuất hiện. Đây là hành vi đúng, không phải lỗi — mỗi spec khoá một phía của cờ. CI vì thế chạy E2E **hai lượt**.
2. **Test đơn vị phụ thuộc môi trường.** `tests/manualQuizTelemetry.test.ts` dùng `vi.unstubAllEnvs()` rồi assert cờ mặc định `false` — thực chất đang đọc môi trường sẵn có, nên fail với bất kỳ lập trình viên nào bật cờ trong `.env.local`. Đã sửa thành `vi.stubEnv(..., undefined)` để test đúng nghĩa "biến chưa được đặt".
3. **Ba spec E2E không chạy được trong môi trường stub:**
   - `student-dashboard-responsive.cy.ts`, `student-practice-library.cy.ts` — đăng nhập thật, cần `--env studentUsername=...,studentPassword=...` trên môi trường đã deploy.
   - `quiz.cy.ts` — **kế thừa từ hệ thống nguồn, đã lỗi thời**: assert thương hiệu cũ ("TRƯỜNG TIỂU HỌC IT ÔNG") và link "Dành cho Giáo viên" không còn tồn tại trong `src/`. Đã `describe.skip` kèm giải thích trong file.

## Giai đoạn 2 — Đồng bộ tài liệu ✅

- [x] `README.md` — thay mục "placeholder `.invalid`" bằng bảng hạ tầng production thật, thêm lệnh chạy E2E.
- [x] `docs/architecture/system_overview.md` — mô tả tài nguyên Cloudflare/Vercel thật.
- [x] `AGENTS.md` — issue tracker đã có remote; ghi chú bẫy `GITHUB_TOKEN` hỏng.
- [x] `docs/deployment/NEW_SYSTEM_SETUP.md` — điền bảng chủ sở hữu, thêm banner trạng thái.
- [x] `DEPLOYMENT_CHECKLIST.md` — tick các mục đã xong kèm bằng chứng, thêm mục 8 (rollout cờ).
- [x] `docs/testing/e2e.md` — **mới**, phân loại 3 nhóm spec và ma trận cờ.
- [x] `CONTEXT.md` — đã đúng từ phiên trước, không cần sửa.
- [x] `tests/productionDomainConfig.test.ts` vẫn pass sau khi sửa tài liệu.

## Giai đoạn 3 — CI/CD ✅

- [x] `.github/workflows/ci.yml` — 4 job: `typecheck` (frontend + workers), `test` (vitest), `build` (kèm bước chặn `.invalid` lọt vào bundle), `e2e` (Cypress 2 lượt theo cờ). YAML đã được parse kiểm chứng.
- [x] Job E2E loại trừ đúng 3 spec không chạy được trong CI, có ghi lý do ngay trong workflow.
- [x] Script mới: `cypress:run:stubbed`, `cypress:run:blueprint-v3`, `cypress:run:component`.
- [x] Bổ sung 4 rollback migration còn thiếu: `0015`, `0016`, `0040`, `0042`.
- [x] `tests/d1RollbackCoverage.test.ts` — **mới**, ép mọi migration rủi ro cao phải có rollback, chặn rollback mồ côi, và kiểm tra thứ tự DROP an toàn với khoá ngoại.
- [ ] **Cần thao tác trên GitHub:** bật branch protection cho `main` (bắt buộc CI xanh trước khi merge).

## Giai đoạn 4 — Hạ tầng & deploy ✅ (còn 3 hạng mục)

Chi tiết và bằng chứng: `docs/deployment/CURRENT_PROGRESS.md`.

Đã xong: D1, R2 (public + private), Queue + DLQ, 2 Worker, `JWT_SECRET`, `api.thtohieu.com`,
DNS/SSL cho 4 hostname, Vercel project + Git integration + biến môi trường, 3 custom domain,
smoke test đầy đủ (200 / CSP / HSTS / robots / sitemap / health / auth guard 401).

Còn lại:

- [ ] Dịch vụ AI thật tại `ai.thtohieu.com` và thay `CLIPROXY_TOKEN` tạm.
- [ ] Email provider (SPF/DKIM/DMARC), monitoring, Cloudinary production.
- [ ] Tài khoản quản trị đầu tiên trong D1.

## Giai đoạn 5 — Rollout production ⏳

**Điều kiện tiên quyết:** tạo tài khoản quản trị đầu tiên. Không có nó thì không bật được
Unified Notifications (setting server) và không smoke test được luồng giáo viên.

### Smoke test thủ công còn lại
- [ ] Đăng nhập đủ vai trò: giáo viên, học sinh, quản trị.
- [ ] Tạo đề thủ công → giao bài → học sinh làm → chấm & xem kết quả.
- [ ] Thi trực tiếp (đủ 5 trạng thái).
- [ ] Phiếu kết quả `/phieu/*`.
- [ ] Chứng nhận: batch → queue consumer → R2 → thông báo.
- [ ] Email xác minh / quên mật khẩu (sau khi có email provider).
- [ ] Backup D1 + thử phục hồi.

### Thứ tự bật cờ (mỗi bước cách nhau 2–3 ngày, theo dõi 24–48h)

1. [ ] **Unified Notifications** — cờ server, bật/tắt tức thì không cần redeploy, rủi ro thấp nhất.
2. [ ] **Gift Shop V2**.
3. [ ] **AI Quiz V2** — chỉ sau khi có AI proxy thật; theo dõi chi phí và quota giáo viên.
4. [ ] **AI Blueprint V3**.
5. [ ] **Parent Portal V1** — kèm truyền thông tới phụ huynh; theo dõi rate-limit đăng nhập.

Cờ frontend cần redeploy Vercel với env mới để bật/tắt (vài phút). Cờ server đổi tức thì.

### Kết thúc
- [ ] Cập nhật `CHANGELOG.md`, tag release `v1.0.0`.
- [ ] Chuyển theo dõi dài hạn (chi phí AI, dung lượng R2, backup định kỳ) thành lịch vận hành.

---

## Rủi ro còn lại

| Rủi ro | Ảnh hưởng | Phương án |
|---|---|---|
| Chưa có AI proxy thật | Chặn rollout AI V2/V3 | Bật Unified Notifications và Gift Shop trước |
| Chưa có tài khoản quản trị | Chặn toàn bộ smoke test vai trò | Tạo theo quy trình phê duyệt, không import dữ liệu cũ |
| `quiz.cy.ts` đang skip | Mất phủ luồng home/login | Viết lại theo UI hiện tại hoặc restub như `parent-portal.cy.ts` |
| 2 spec cần credential thật | Không chạy trong CI | Chạy thủ công định kỳ với tài khoản học sinh dùng một lần |
| Chưa bật branch protection | CI có thể bị bỏ qua khi merge | Bật trong GitHub Settings |
