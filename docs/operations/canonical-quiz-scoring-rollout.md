# Canonical Quiz Scoring V2 — rollout và rollback

Tài liệu này áp dụng cho engine chấm điểm dùng chung của quiz thường, assignment và live exam. Mục tiêu là triển khai an toàn mà không khôi phục bộ chấm legacy đã biết có lỗi.

## 1. Quyết định kiến trúc

Điểm số authoritative luôn được tính bằng `src/domain/quiz-scoring/gradeQuiz.ts` và `gradeQuestion.ts` trên Worker.

Hệ thống không giữ một `legacyQuizGrader` chạy song song vì scorer cũ có các lỗi đã xác nhận ở matching, dropdown, ordering, multiple-select và live exam. Khôi phục scorer đó làm rollback có thể tạo lại điểm sai.

Ba mode hiện tại:

| Mode | Điểm được lưu | Mục đích |
|---|---|---|
| `canonical` | Canonical engine | Contract V2 đã mở cho cohort |
| `shadow` | Canonical engine | Ghi so sánh an toàn giữa kết quả canonical và metadata client gửi lên; metadata không được dùng làm điểm |
| `compatibility` | Canonical engine | Đọc cả answer shape legacy và V2 qua adapter; dùng khi giảm rollout contract |

`compatibility` là rollback contract, không phải rollback về scorer lỗi.

Nếu lỗi nằm trong chính canonical engine, rollback đúng là khôi phục **Cloudflare Worker deployment trước phát hành**, giữ nguyên migration add-only và chạy lại smoke/parity test.

## 2. Feature flags

| Flag | Mặc định | Vai trò |
|---|---:|---|
| `quiz_scoring_canonical_v2` | bật, 100% | Đánh dấu cohort dùng contract canonical V2 |
| `quiz_scoring_shadow_v2` | tắt | Bật log so sánh privacy-safe khi canonical flag không áp dụng |

Thứ tự ưu tiên mode:

1. Canonical flag áp dụng → `canonical`.
2. Canonical không áp dụng, shadow áp dụng → `shadow`.
3. Cả hai không áp dụng → `compatibility`.

Không đổi mode giữa một lần chấm: route resolve mode một lần trước khi gọi service. Live exam luôn gọi cùng canonical engine ở submit, auto-close và kết thúc sớm, vì vậy không thể đổi scorer giữa ca thi.

## 3. Dữ liệu và migration

- `0058_canonical_quiz_scoring_v2.sql` thêm `answer_schema_version` và `grading_version` theo kiểu add-only.
- `0059_quiz_scoring_rollout_flags.sql` thêm hai rollout flag và stop conditions.
- Không tự sửa kết quả lịch sử.
- Audit/regrade chỉ đọc; mọi điều chỉnh lịch sử phải có backup, phê duyệt và script riêng idempotent.

## 4. Preflight bắt buộc

```powershell
npm run verify
```

Chạy Cypress V2 với đúng feature flags:

```powershell
$env:VITE_FEATURE_GIFT_SHOP_V2='true'
$env:VITE_FEATURE_AI_QUIZ_V2='true'
$env:VITE_FEATURE_AI_BLUEPRINT_V3='false'
$env:VITE_FEATURE_PARENT_PORTAL_V1='true'
npm run dev -- --host 127.0.0.1 --port 3001 --strictPort
```

Ở terminal khác:

```powershell
npm run cypress:run:stubbed
```

Blueprint V3 phải chạy ở dev server riêng với `VITE_FEATURE_AI_BLUEPRINT_V3=true`:

```powershell
npm run cypress:run:blueprint-v3
```

Kiểm tra scoring bắt buộc:

```powershell
npx vitest run tests/quizScoringContract.test.ts `
  tests/quizScoringEndToEnd.worker.test.ts `
  tests/resultsAuthoritativeScoring.worker.test.ts `
  tests/liveExamCanonicalScoringMatrix.worker.test.ts `
  tests/quizScoringRollout.worker.test.ts `
  tests/stagedRollout.test.ts --maxWorkers=1
```

## 5. Audit dữ liệu chỉ đọc

Local D1 phải dùng thư mục persist cô lập. Với database mới, bootstrap trực tiếp bằng canonical `workers/schema.sql`; không replay toàn bộ migration lịch sử sau schema mới nhất:

```powershell
$state = ".tmp/scoring-audit-local"
Remove-Item -Recurse -Force $state -ErrorAction SilentlyContinue

Push-Location workers
npx wrangler d1 execute tohieuquiz-db `
  --config wrangler.toml `
  --local `
  --persist-to "../$state" `
  --file schema.sql `
  --yes
Pop-Location

npm run audit:scoring-contracts -- --local --persist-to $state
npm run report:result-regrading -- --local --persist-to $state --limit 5000
```

Remote D1 yêu cầu xác nhận đúng tên database:

```powershell
npm run audit:scoring-contracts -- --remote --confirm-remote tohieuquiz-db
npm run report:result-regrading -- --remote --confirm-remote tohieuquiz-db --limit 5000
```

**STOP** khi contract audit có blocker. Regrade report có chênh lệch không tự động sửa dữ liệu; phải phân loại từng nhóm nguyên nhân trước rollout.

## 6. Rollout theo giai đoạn

Tạo plan không gọi API ghi:

```powershell
npm run rollout:staged -- `
  --action plan `
  --stage admin-only `
  --flag quiz_scoring_canonical_v2 `
  --api https://api.thtohieu.com `
  --site https://www.thtohieu.com `
  --output reports/scoring-rollout-admin-plan.json
```

Thứ tự cohort chuẩn:

1. `admin-only` — quan sát 24 giờ.
2. `teachers-5` — quan sát 24 giờ.
3. `pilot-class` — quan sát 48 giờ.
4. `teachers-25` — quan sát 24 giờ.
5. `full` — quan sát 48 giờ.

Không mở rộng khi audit chưa sạch hoặc metric đang thiếu.

## 7. Metric bắt buộc

File metric dùng cho `--action evaluate` phải có các trường chung và scoring-specific phù hợp:

```json
{
  "error5xxRatePercent": 0.2,
  "baselineClientErrorRate": 1.0,
  "clientErrorRate": 1.1,
  "baselineP95Ms": 300,
  "p95Ms": 330,
  "dataCorruption": false,
  "authAnomaly": false,
  "scoringInvalidRatePercent": 0.1,
  "validation422RatePercent": 0.1,
  "unexplainedScoreMismatchCount": 0,
  "submissionFailureRatePercent": 0.1,
  "liveExamFailureRatePercent": 0.1
}
```

Rollout bị chặn khi:

- 5xx vượt 1%.
- Client error vượt 2 lần baseline.
- P95 tăng hơn 30%.
- Có data corruption hoặc auth anomaly.
- `scoringInvalidRatePercent` vượt 1%.
- `validation422RatePercent` vượt 1%.
- Có bất kỳ `unexplainedScoreMismatchCount > 0`.
- `submissionFailureRatePercent` vượt 1%.
- `liveExamFailureRatePercent` vượt 1%.

Chênh lệch do bug legacy chỉ được xem là explained khi có regression test và liên kết incident/issue tương ứng.

## 8. Shadow mode

Shadow log chỉ chứa:

- `quizId`.
- Điểm/số câu đúng/tổng câu canonical.
- Metadata điểm/số câu client đã gửi.
- Delta.

Không log tên học sinh, username, lớp, answer text hoặc correct answer.

Shadow mode dùng để tìm client cũ hoặc đường gửi payload sai, không dùng kết quả client để chấm hay lưu.

## 9. Rollback

### 9.1 Lỗi contract hoặc cohort

1. Dừng mở rộng.
2. Đưa `quiz_scoring_canonical_v2` về cohort trước bằng `rollout:staged --action rollback`.
3. Giữ canonical engine authoritative ở compatibility mode.
4. Bật shadow nếu cần xác định client/path gây lệch.
5. Chạy lại smoke, scoring matrix và audit.

### 9.2 Lỗi canonical engine

1. Dừng submit rollout và ghi deployment ID hiện tại.
2. Rollback Cloudflare Worker về deployment đã xác minh trước phát hành.
3. Không rollback migration add-only và không chạy SQL phá hủy.
4. Kiểm tra quiz thường, assignment, live exam submit và auto-close.
5. Chạy report regrade để xác định phạm vi kết quả có thể bị ảnh hưởng; không tự sửa.
6. Chỉ mở lại sau khi có regression test tái hiện lỗi.

### 9.3 Điều cấm

- Không tin `score`, `correctCount`, `isCorrect` từ client.
- Không bật scorer legacy để “khôi phục nhanh”.
- Không sửa hàng loạt kết quả lịch sử trong cửa sổ incident.
- Không đổi nhiều feature flag cùng lúc.
- Không log answer text hoặc PII trong shadow observation.

## 10. Bằng chứng đóng rollout

- `npm run verify` xanh.
- Cypress stubbed và Blueprint V3 xanh ở hai server/flag set riêng.
- Browser scoring matrix đạt 14/14.
- Live exam service matrix đạt 14/14 và ghi grading version.
- Contract audit không blocker.
- Historical regrade report được lưu và reviewed.
- Release-readiness trả `status: ready`.
- GitNexus impact/review không có route consumer bị bỏ sót.
- Dashboard không có stop condition trong toàn bộ observation window.
