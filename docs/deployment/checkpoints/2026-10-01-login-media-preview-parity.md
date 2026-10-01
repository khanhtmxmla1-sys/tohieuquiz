# Checkpoint — Login Media Preview Parity

**Cập nhật gần nhất:** 02/10/2026
**Trạng thái:** PREVIEW PARITY ĐÃ COMMIT/PUSH — WYSIWYG CROP ĐÃ IMPLEMENT + VERIFY — CROP CHƯA COMMIT/PUSH
**Worktree:** `C:/quizpro/.worktrees/login-media-preview-parity`
**Branch:** `fix/login-media-preview-parity`
**HEAD hiện tại:** `8c420692d90b888db8cc2f7ed938f059f7344a62`
**HEAD commit:** `8c42069 fix(login-media): align admin preview with login carousel`
**Tracking:** `origin/fix/login-media-preview-parity` (0 ahead / 0 behind trước phần crop chưa commit)

---

## 1. Mục tiêu của task

Sửa phần **Xem trước Banner đăng nhập trong Admin** để hành vi và giao diện bám sát carousel thật ngoài trang đăng nhập, đồng thời cho phép xem trước thay đổi cấu hình **ngay trước khi bấm Lưu**.

Yêu cầu chính đã xử lý:

- Preview có Play/Pause.
- Có mũi tên trái/phải.
- Có chấm điều hướng.
- Có autoplay.
- Có hiệu ứng Fade/Slide.
- Có pause khi rê chuột.
- Thay đổi các tùy chọn ở Admin phản ánh ngay trong Preview nhưng **không gọi API/database cho tới khi bấm Lưu**.
- Preview mặc định chỉ dùng banner đang bật, đúng lịch hiệu lực, đúng thứ tự, tối đa 10 ảnh.
- Có thể bấm “Xem trước” một banner riêng, kể cả banner chưa tới lịch/tắt.
- Preview Admin không mở link ra ngoài khi bấm ảnh.
- Trang đăng nhập thật và Preview dùng chung một carousel để tránh lệch hành vi về sau.

---

## 2. Worktree an toàn

Task này được thực hiện trong worktree riêng:

```text
C:/quizpro/.worktrees/login-media-preview-parity
```

Branch:

```text
fix/login-media-preview-parity
```

Không code trực tiếp trên root `C:/quizpro`.

Root hiện vẫn có các thay đổi khác từ trước; không reset/clean/restore chúng.

---

## 3. File thay đổi hiện tại

### Modified

```text
src/components/HomePage/components/login-media/LoginMediaSection.tsx
src/features/login-media/admin/LoginMediaAdminPage.tsx
src/features/login-media/admin/LoginMediaPreview.tsx
src/features/login-media/admin/LoginMediaSettingsCard.tsx
tests/LoginMediaAdminPage.test.tsx
```

### New

```text
src/components/HomePage/components/login-media/LoginMediaCarousel.tsx
```

Tổng cộng: **6 file trong scope task**.

---

## 4. Nội dung triển khai

### 4.1. Tạo carousel dùng chung

Đã tạo:

```text
src/components/HomePage/components/login-media/LoginMediaCarousel.tsx
```

Component dùng chung hỗ trợ:

- autoplay theo `intervalMs`;
- pause do hover;
- pause khi focus vào control;
- user Play/Pause;
- mũi tên trước/sau;
- dots;
- Fade/Slide class;
- chọn slide theo `selectedSlideId`;
- có thể disable link bằng `allowLinks={false}`;
- fallback alt;
- lazy loading ảnh.

### 4.2. Trang đăng nhập thật

`LoginMediaSection.tsx` đã chuyển từ carousel tự triển khai riêng sang dùng `LoginMediaCarousel`.

Giữ nguyên các nguyên tắc:

- chỉ fetch media trên desktop;
- nếu API lỗi/degraded/không có slide thì fallback về `LearningOverview`;
- slider public vẫn hiển thị trong layout cũ.

### 4.3. Admin Preview

`LoginMediaPreview.tsx` dùng cùng `LoginMediaCarousel`.

Admin Preview:

- không mở link ngoài;
- hiển thị đúng controls theo draft settings;
- khung preview bám style khung login;
- selected banner có thể ép preview sang banner đó.

### 4.4. Draft settings trước khi Save

`LoginMediaSettingsCard.tsx` có callback:

```text
onPreviewChange
```

Mỗi thay đổi draft hợp lệ được đẩy sang Preview ngay:

- display mode;
- autoplay;
- interval;
- transition;
- dots;
- arrows;
- pause-on-hover.

Không gọi `updateSettings` cho tới khi user bấm nút **Lưu cài đặt**.

### 4.5. Filter banner mặc định trong Admin

`LoginMediaAdminPage.tsx` chọn danh sách preview mặc định theo:

```text
enabled = true
startsAt <= now hoặc null
endsAt > now hoặc null
sortOrder tăng dần
tối đa 10 banner
```

Nếu user bấm “Xem trước” một banner riêng ngoài tập live thì Preview chỉ đưa banner đó vào để kiểm tra.

---

## 5. TDD / Regression tests

Đã thêm test mới trong:

```text
tests/LoginMediaAdminPage.test.tsx
```

Các behavior mới được cover:

1. Draft settings thay đổi Preview trước khi Save.
2. Chưa Save thì `updateSettings` không được gọi.
3. Tắt arrows thì nút next biến mất.
4. Tắt dots thì dot buttons biến mất.
5. Tắt autoplay thì Play/Pause biến mất.
6. Đổi transition sang SLIDE thì ảnh dùng class slide.
7. Preview mặc định loại banner tương lai.
8. Preview riêng banner tương lai vẫn xem được khi user chọn.

Test đầu tiên đã được chạy theo RED → GREEN.

---

## 6. Verification đã hoàn tất

### Focused tests

```text
npm run test:run -- tests/LoginMediaAdminPage.test.tsx tests/LoginMediaSection.test.tsx tests/LoginMediaAccessibility.test.tsx
```

Kết quả cuối:

```text
3 test files PASS
15/15 tests PASS
```

### TypeScript

```text
npm run typecheck
```

Kết quả:

```text
PASS
```

### ESLint đúng scope thay đổi

```text
npx eslint   src/components/HomePage/components/login-media/LoginMediaCarousel.tsx   src/components/HomePage/components/login-media/LoginMediaSection.tsx   src/features/login-media/admin/LoginMediaAdminPage.tsx   src/features/login-media/admin/LoginMediaPreview.tsx   src/features/login-media/admin/LoginMediaSettingsCard.tsx   tests/LoginMediaAdminPage.test.tsx   --max-warnings=0
```

Kết quả:

```text
PASS
```

### Build

```text
npm run build
```

Kết quả cuối:

```text
PASS
vite built successfully
LoginMediaCarousel được bundle thành chunk riêng
```

### Diff / review

```text
git diff --check
```

Kết quả:

```text
PASS
chỉ có cảnh báo LF -> CRLF, không có whitespace error
```

Automated diff review:

```text
PASS
0 findings
```

Security scan trên tracked changed files:

```text
PASS
0 hits
```

---

## 7. Lưu ý về môi trường dependency

Lúc đầu `npm install` / `npm ci` trong worktree không hoàn tất sạch và tạo `node_modules` thiếu MathJax.

Build lần đầu báo:

```text
Missing MathJax runtime asset:
node_modules/mathjax-full/es5/tex-mml-chtml.js
```

Đã xử lý ở mức môi trường worktree bằng cách thay `node_modules` trong worktree thành junction tới:

```text
C:/quizpro/node_modules
```

Sau đó:

```text
npm run build
→ PASS
```

Không có file source/package lock nào bị thay đổi bởi thao tác này.

---

## 8. Full test / full lint

### Full Vitest

Đã khởi chạy:

```text
npm run test:run
```

Suite chạy rất lâu và nhiều test khác ngoài scope vẫn đang PASS, nhưng phiên chạy đã được **chủ động dừng** để không giữ tài nguyên quá lâu.

Do đó:

```text
KHÔNG được ghi là full suite PASS
KHÔNG được coi exit code do stop là test failure của task
```

### Full lint

Một lần full `npm run lint` cũng chạy lâu trong môi trường hiện tại và được dừng.

Sau đó đã chạy ESLint **đúng 6 file trong scope** và PASS.

---

## 9. Browser visual verification

Chrome Companion hiện báo:

```text
paired = false
connected = false
```

Do đó chưa có screenshot/browser runtime verification trực tiếp.

Không được tuyên bố đã kiểm tra trực quan bằng browser.

Focused React tests + accessibility tests + production build đều PASS.

---

## 10. Root repo phải giữ nguyên

Root `C:/quizpro` đang có các thay đổi từ trước, ví dụ:

```text
M AGENTS.md
M CLAUDE.md
M docs/superpowers/plans/2026-09-28-certificate-per-item-queue-recovery.md
M src/components/HomePage/components/HeroSection.tsx
... và một số file docs untracked
```

Các thay đổi đó **không thuộc task này**.

Khi resume:

- không reset root;
- không clean root;
- không restore hàng loạt;
- không stage file root vào commit task này.

---

## 11. Git state tại checkpoint

```text
Branch:
fix/login-media-preview-parity

HEAD:
ab535b4c1a34219c27ba4c133e2185128fb160a4

Task commit:
NONE

Push:
NONE

Pull Request:
NONE

Merge:
NONE

Deploy:
NONE
```

Các thay đổi trong worktree hiện đều **chưa staged**.

---

## 12. Việc tiếp theo khi resume

Nếu user duyệt giao hàng:

1. Đọc checkpoint này.
2. Kiểm tra lại:
   ```bash
   git status --short
   git diff --check
   ```
3. Chạy lại focused gate:
   ```bash
   npm run test:run -- tests/LoginMediaAdminPage.test.tsx tests/LoginMediaSection.test.tsx tests/LoginMediaAccessibility.test.tsx
   npx eslint src/components/HomePage/components/login-media/LoginMediaCarousel.tsx src/components/HomePage/components/login-media/LoginMediaSection.tsx src/features/login-media/admin/LoginMediaAdminPage.tsx src/features/login-media/admin/LoginMediaPreview.tsx src/features/login-media/admin/LoginMediaSettingsCard.tsx tests/LoginMediaAdminPage.test.tsx --max-warnings=0
   npm run typecheck
   npm run build
   ```
4. Review diff lần cuối.
5. Chỉ stage đúng 6 file của task + checkpoint nếu muốn đưa checkpoint vào commit.
6. Commit.
7. Push branch.
8. Tạo PR.
9. Không cleanup worktree trước khi PR hoàn tất.

---

## 13. Exact source scope đề xuất cho commit

```text
src/components/HomePage/components/login-media/LoginMediaCarousel.tsx
src/components/HomePage/components/login-media/LoginMediaSection.tsx
src/features/login-media/admin/LoginMediaAdminPage.tsx
src/features/login-media/admin/LoginMediaPreview.tsx
src/features/login-media/admin/LoginMediaSettingsCard.tsx
tests/LoginMediaAdminPage.test.tsx
```

Checkpoint này có thể commit cùng nếu muốn:

```text
docs/deployment/checkpoints/2026-10-01-login-media-preview-parity.md
```

---

## 14. Câu mở đầu cho chat mới

Dùng nguyên câu sau:

```text
Đọc checkpoint:
C:/quizpro/.worktrees/login-media-preview-parity/docs/deployment/checkpoints/2026-10-01-login-media-preview-parity.md

Tiếp tục task Login Media Preview Parity đúng theo checkpoint.
Không reset/clean/overwrite.
Kiểm tra lại focused tests, typecheck, lint đúng scope và build trước khi commit.
Sau đó nếu sạch thì chuẩn bị commit, push và tạo PR; chưa cleanup worktree.
```


---

## 15. Mở rộng scope — WYSIWYG Banner Crop (02/10/2026)

**Mục tiêu:** Admin kéo/zoom ảnh trong khung 630:286; Crop Editor, Admin Preview và public Login phải render cùng kết quả.

**Dữ liệu:** `cropX/cropY = 0..1`, `cropZoom = 1..3`; mặc định `0.5/0.5/1`.

**Migration:** `workers/migrations/0088_login_media_crop.sql`.
- Thêm `crop_x`, `crop_y`, `crop_zoom` với DEFAULT + CHECK.
- `origin/main` hiện kết thúc ở 0087, chưa có collision 0088.
- Rollout bắt buộc: **apply 0088 trước khi deploy Worker mới**.

**Renderer dùng chung:** `LoginMediaImageViewport.tsx`.
- Dùng intrinsic width/height + aspect 630/286 để tính cover, zoom, left/top.
- Clamp vị trí để không lộ khoảng trắng.
- Không tạo ảnh crop mới trên Cloudinary.

**Crop Editor:** `LoginMediaCropEditor.tsx`.
- Pointer Events cho chuột/cảm ứng.
- Kéo focal X/Y, zoom 100–300%, Reset về center/100%.
- Draft cập nhật ngay khung Preview Admin; chưa Save thì không gọi `updateSlide`.

**API/Worker:** đọc/ghi/validate crop metadata; public payload trả `imageWidth/imageHeight` + crop. Payload public cũ thiếu crop được default center/100%.

**TDD:** đã có RED→GREEN cho renderer intrinsic geometry, migration/validation, crop editor/save và live draft preview.

**Verification cuối:**
```text
Focused Vitest: 11 files / 60 tests PASS
npm run typecheck: PASS
npm run typecheck:workers: PASS
Scoped ESLint: PASS, 0 warnings
npm run build: PASS (4782 modules)
git diff --check: PASS
security_scan: 0 hits
Cypress login-media-admin: final rerun 3/3 PASS
```

Cypress lần đầu có 1 timeout chờ alias `loginMediaState`; rerun ngay cùng source/environment 3/3 PASS. Chrome Companion vẫn chưa pair/arm nên chưa có visual verification trực tiếp qua Companion.

**Môi trường:** worktree phải junction `workers/node_modules -> C:/quizpro/workers/node_modules` để Worker typecheck tìm `@simplewebauthn/server`; không đổi source/package lock.

**Git crop scope hiện tại:**
```text
Branch: fix/login-media-preview-parity
HEAD: 8c420692d90b888db8cc2f7ed938f059f7344a62
Tracking: origin/fix/login-media-preview-parity (HEAD 0 ahead / 0 behind trước crop)
Crop commit/push/deploy: NONE
```

**Resume:** đọc `git status --short` và diff trước; không reset/clean/overwrite. Nếu giao hàng, rerun focused tests + typecheck root/workers + scoped lint + build. Chỉ commit/push sau user approval.
