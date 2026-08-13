# Kế hoạch triển khai Login Media Slider + Cloudinary + D1/Admin

> **Mục tiêu:** Thay phần `Tổng quan học tập` bên trái trang đăng nhập bằng một module media có thể chuyển giữa chế độ `CONTENT` và `SLIDER`, do Admin quản trị; ảnh được upload lên Cloudinary, metadata/lịch hiển thị/cấu hình carousel lưu trong D1; khi bất kỳ thành phần media nào lỗi, trang đăng nhập vẫn hoạt động bình thường và fallback về `Tổng quan học tập` hiện có.

> **Nguyên tắc bắt buộc:** Không thay LoginForm/auth/passkey/session flow. Không thay hệ thống upload R2 hiện hữu dùng cho homework/question. Không dùng bảng Announcement làm nơi lưu slider. Mọi mutation Admin phải kiểm tra `requireAdmin`, có audit log và optimistic concurrency. Không thực hiện production migration/deploy nếu chưa có phê duyệt riêng.

---

## 1. Baseline repo đã audit

### 1.1 Login frontend hiện tại

Luồng chính:

```text
src/components/HomePage/HomePage.tsx
  -> src/components/HomePage/LoginLandingPage.tsx
      -> LandingHeader
      -> NotificationSurfaceStack / CurrentAnnouncementBanner
      -> HeroSection
      -> LoginForm
      -> LandingFooter
```

Phần cần thay thế/tách module hiện nằm trong:

```text
src/components/HomePage/components/HeroSection.tsx
```

Block hiện tại có `data-purpose="learning-preview"`, chứa `Tổng quan học tập`, biểu đồ tiến độ, bài kiểm tra và kết quả tổng hợp. Block đang `hidden ... lg:block`, nghĩa là chỉ xuất hiện ở desktop từ breakpoint `lg`.

### 1.2 Auth/Login không được thay đổi

Các luồng đang ổn định và nằm ngoài phạm vi:

```text
src/components/HomePage/components/LoginForm.tsx
src/components/HomePage/LoginLandingPage.tsx
src/services/passkeyService.ts
stores/authStore
src/stores/useClassroomStore
```

Không thay:
- teacher/student switch;
- username/password login;
- passkey;
- remember login;
- forced password change;
- session bootstrap.

### 1.3 Media upload hiện tại là Worker -> R2, không phải Cloudinary

Frontend:

```text
src/services/mediaUploadService.ts
POST /api/media/uploads
```

Worker:

```text
workers/src/routes/mediaUploads.ts
```

R2 binding:

```text
OG_IMAGES -> tohieuquiz-og-images
R2_PUBLIC_URL -> https://assets.thtohieu.com
```

Purpose hiện có:

```text
homework-assignment
homework-submission
quiz-question
```

Không sửa luồng này.

### 1.4 Cloudinary hiện chỉ còn delivery/legacy use

Repo có Cloudinary URL cho achievement/avatar/legacy homework, nhưng Worker hiện không có Cloudinary upload credentials.

Không có các binding production sau trong `workers/src/types.ts` / `workers/wrangler.toml`:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Vì vậy Login Media phải là integration Cloudinary riêng.

### 1.5 D1/Admin baseline

D1 migration source:

```text
workers/migrations/
workers/schema.sql
```

Global settings hiện dùng:

```text
system_settings
```

nhưng `/api/system-settings` chỉ expose allowlist settings. Không mở rộng bảng này để nhét toàn bộ slider JSON.

Admin shell:

```text
src/stores/useTeacherDashboardUIStore.ts
src/components/TeacherDashboard/teacher-dashboard-shell/dashboardConfig.ts
src/components/TeacherDashboard/teacher-dashboard-shell/dashboardLazyTabs.tsx
src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardFeatureTabs.tsx
```

Auth/audit patterns có thể tái sử dụng:

```text
requireAdmin
verifyJWTMiddleware
auditStatement
withD1Retry
```

---

## 2. Phạm vi triển khai

### In scope

1. Tách `Tổng quan học tập` thành component riêng, giữ nguyên nội dung và UI hiện có.
2. Tạo `LoginMediaSection` quyết định render `CONTENT` hoặc `SLIDER`.
3. Public API read-only lấy cấu hình Login Media và danh sách slide đang hiệu lực.
4. D1 tables riêng cho settings và slides.
5. Admin tab `Banner đăng nhập` / route canonical `/teacher/login-media`.
6. CRUD slide + reorder + enable/disable + schedule.
7. Cấu hình autoplay / interval / transition / dots / arrows / pause-on-hover.
8. Cloudinary upload integration riêng cho Admin Login Media.
9. Audit logs cho settings/slides.
10. Fallback mạnh: API fail, no slide, invalid image, all image fail -> `LearningOverview`.
11. Unit/worker/component/Cypress tests.
12. Observability tối thiểu cho API/config/upload failures.
13. Migration audit, release readiness, staged rollout và rollback plan.

### Out of scope

1. Không thay UI LoginForm.
2. Không thay login/auth/session/passkey.
3. Không migrate generic media từ R2 sang Cloudinary.
4. Không sửa Announcement thành slider.
5. Không làm slider mobile ở phase đầu; giữ behavior `lg:block` hiện tại.
6. Không thêm video/GIF trong V1.
7. Không cho teacher thường quản trị Login Media.
8. Không xóa media trên Cloudinary tự động khi slide bị disable.
9. Không bật production ngay sau merge nếu chưa có smoke/approval.

---

## 3. Kiến trúc đích

### 3.1 Public login flow

```text
LoginLandingPage
  -> HeroSection
      -> LoginMediaSection
          -> fetch GET /api/login-media
          -> nếu lỗi / disabled / 0 slide
                -> LearningOverview
          -> nếu SLIDER + có slide hợp lệ
                -> LoginMediaSlider
```

### 3.2 Admin flow

```text
TeacherDashboard (admin)
  -> /teacher/login-media
  -> LoginMediaAdminPage
      -> GET admin settings/slides
      -> POST upload authorization / upload proxy
      -> Cloudinary
      -> POST/PUT/PATCH/DELETE slide metadata in D1
      -> PATCH settings with expectedVersion
      -> audit log
```

### 3.3 Storage split

```text
Generic user media -> existing R2 pipeline
Login Media images -> Cloudinary only
Login Media config/metadata -> D1
```

Không trộn hai pipeline.

---

## 4. D1 schema đề xuất

> **Lưu ý sequence:** Không hard-code migration number trước khi bắt đầu implementation. Source đã có migration sau checkpoint `0066`; trước khi tạo migration phải đọc `workers/migrations/` tại HEAD của worktree và lấy số kế tiếp thực tế.

### 4.1 Table `login_media_settings`

```sql
CREATE TABLE login_media_settings (
  id TEXT PRIMARY KEY,
  display_mode TEXT NOT NULL DEFAULT 'CONTENT'
    CHECK (display_mode IN ('CONTENT', 'SLIDER')),
  autoplay INTEGER NOT NULL DEFAULT 1
    CHECK (autoplay IN (0, 1)),
  interval_ms INTEGER NOT NULL DEFAULT 5000
    CHECK (interval_ms BETWEEN 2000 AND 30000),
  transition TEXT NOT NULL DEFAULT 'FADE'
    CHECK (transition IN ('FADE', 'SLIDE')),
  show_dots INTEGER NOT NULL DEFAULT 1
    CHECK (show_dots IN (0, 1)),
  show_arrows INTEGER NOT NULL DEFAULT 1
    CHECK (show_arrows IN (0, 1)),
  pause_on_hover INTEGER NOT NULL DEFAULT 1
    CHECK (pause_on_hover IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
```

Seed singleton:

```sql
INSERT OR IGNORE INTO login_media_settings (
  id, display_mode, autoplay, interval_ms, transition,
  show_dots, show_arrows, pause_on_hover, version, updated_at
) VALUES (
  'default', 'CONTENT', 1, 5000, 'FADE',
  1, 1, 1, 1, datetime('now')
);
```

### 4.2 Table `login_media_slides`

```sql
CREATE TABLE login_media_slides (
  id TEXT PRIMARY KEY,
  cloudinary_public_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_width INTEGER,
  image_height INTEGER,
  alt_text TEXT NOT NULL DEFAULT '',
  internal_title TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  open_new_tab INTEGER NOT NULL DEFAULT 0
    CHECK (open_new_tab IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0
    CHECK (enabled IN (0, 1)),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
```

Index:

```sql
CREATE INDEX idx_login_media_slides_active_order
ON login_media_slides(enabled, sort_order, starts_at, ends_at);
```

### 4.3 Không lưu secret trong D1

Tuyệt đối không lưu:

```text
Cloudinary API secret
API key secret material
signed upload signature history
```

Secrets chỉ ở Worker environment.

---

## 5. Cloudinary integration

### 5.1 Worker env mới

Bổ sung type/binding names:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_LOGIN_MEDIA_FOLDER   (optional var, default tohieuquiz/login-media)
CLOUDINARY_LOGIN_MEDIA_UPLOAD_PRESET (signed preset, default tohieuquiz_login_media_signed)
```

`CLOUDINARY_API_SECRET` phải là secret binding, không commit value. Preset Cloudinary phải ở chế độ **signed**. Worker ký `allowed_formats=jpg,jpeg,png,webp` cùng namespace/public ID do server tạo nên client không thể đổi whitelist định dạng mà vẫn giữ chữ ký hợp lệ. UI Admin từ chối file lớn hơn 5 MB trước khi xin chữ ký; giới hạn kích thước cấp tài khoản Cloudinary vẫn là lớp backstop phía nhà cung cấp.

### 5.2 Hướng upload đề xuất

Ưu tiên **signed direct upload** để không đẩy file lớn qua Worker:

```text
Admin browser
  -> POST /api/admin/login-media/upload-signature
      Worker verify JWT + requireAdmin
      Worker tạo timestamp + folder + public-id policy + signature
  -> browser POST file trực tiếp Cloudinary upload endpoint
  -> nhận secure_url/public_id/width/height
  -> Admin submit metadata vào D1
```

Lợi ích:
- tránh Worker body/upload bandwidth;
- giữ API secret server-side;
- Cloudinary trực tiếp trả metadata;
- dễ retry upload riêng.

### 5.3 Upload policy

Chỉ cho phép:

```text
image/jpeg
image/png
image/webp
```

Giới hạn đề xuất client + Cloudinary policy: 5 MB cho V1.

Folder cố định:

```text
tohieuquiz/login-media/<year>/<month>/...
```

Không cho client tự chọn arbitrary folder.

### 5.4 Signature request contract

```http
POST /api/admin/login-media/upload-signature
```

Response public fields:

```json
{
  "status": "success",
  "data": {
    "cloudName": "...",
    "apiKey": "...",
    "timestamp": 0,
    "signature": "...",
    "folder": "...",
    "uploadUrl": "..."
  }
}
```

`apiKey` của Cloudinary có thể xuất hiện ở client trong signed upload flow; API secret tuyệt đối không xuất hiện.

### 5.5 Validation sau upload

Khi Admin lưu slide metadata, Worker không tin hoàn toàn URL từ browser.

Worker phải validate:
- `https:` only;
- host thuộc Cloudinary delivery host được cấu hình;
- `public_id` non-empty, bounded;
- URL/public id match expected account/folder pattern nếu có thể;
- width/height integer hợp lệ;
- alt/title/link length limits.

### 5.6 Xóa Cloudinary asset

V1 mặc định:

```text
DELETE slide row != delete Cloudinary asset tự động
```

Lý do: tránh mutation ngoài hệ thống không thể rollback cùng D1 transaction.

Có thể bổ sung nút `Xóa ảnh khỏi Cloudinary` ở phase sau với confirm/audit riêng.

---

## 6. API contracts

### 6.1 Public read-only

```http
GET /api/login-media
```

Không cần auth.

Backend lọc slide:

```sql
enabled = 1
AND (starts_at IS NULL OR starts_at <= now)
AND (ends_at IS NULL OR ends_at > now)
ORDER BY sort_order ASC, created_at ASC
```

Response không expose admin metadata:

```json
{
  "status": "success",
  "data": {
    "mode": "SLIDER",
    "settings": {
      "autoplay": true,
      "intervalMs": 5000,
      "transition": "FADE",
      "showDots": true,
      "showArrows": true,
      "pauseOnHover": true
    },
    "slides": [
      {
        "id": "slide-...",
        "imageUrl": "https://res.cloudinary.com/...",
        "alt": "...",
        "linkUrl": null,
        "openNewTab": false
      }
    ]
  }
}
```

Nếu table chưa tồn tại hoặc D1 transient fail:
- trả `200` với safe fallback `mode: CONTENT`, `slides: []`, `degraded: true` nếu có thể;
- không làm fail login page.

### 6.2 Admin read

```http
GET /api/admin/login-media
```

Admin-only.

Trả đầy đủ:
- settings + version;
- slides including disabled/scheduled;
- `cloudinaryPublicId`;
- timestamps;
- creators/updaters.

### 6.3 Admin settings update

```http
PATCH /api/admin/login-media/settings
```

Payload:

```json
{
  "expectedVersion": 5,
  "displayMode": "SLIDER",
  "autoplay": true,
  "intervalMs": 5000,
  "transition": "FADE",
  "showDots": true,
  "showArrows": true,
  "pauseOnHover": true,
  "reason": "Cập nhật banner đầu năm học"
}
```

Worker:
- requireAdmin;
- validate full object;
- `UPDATE ... WHERE version = expectedVersion`;
- increment version exactly once;
- 409 nếu stale;
- audit before/after nguyên tử cùng DB batch/transaction pattern hỗ trợ.

### 6.4 Slide create/update

```http
POST /api/admin/login-media/slides
PUT  /api/admin/login-media/slides/:id
```

Validation:
- image URL secure;
- alt max 300;
- internal title max 160;
- link internal path hoặc HTTPS;
- `startsAt`/`endsAt` ISO hợp lệ;
- ends > starts;
- bounded sort order.

Create mặc định:

```text
enabled = false
```

trừ khi Admin explicitly bật.

### 6.5 Enable/disable

Có thể dùng PUT full row hoặc action endpoint. Đề xuất full PUT cho V1 để giảm số contract, nhưng UI phải tải latest `updatedAt` và dùng optimistic check.

Nếu cần action rõ hơn:

```http
POST /api/admin/login-media/slides/:id/enable
POST /api/admin/login-media/slides/:id/disable
```

Chỉ chọn một style trong implementation, không hỗ trợ hai contract song song không cần thiết.

### 6.6 Reorder

```http
PATCH /api/admin/login-media/slides/reorder
```

Payload:

```json
{
  "slideIds": ["slide-a", "slide-b", "slide-c"],
  "reason": "Đổi thứ tự chiến dịch"
}
```

Worker phải:
- requireAdmin;
- verify exact set/no duplicate;
- update order in one DB batch;
- audit một record tổng hợp.

### 6.7 Delete

```http
DELETE /api/admin/login-media/slides/:id
```

V1 chỉ xóa D1 metadata.

Nếu muốn an toàn hơn có thể dùng soft-delete `enabled=0`; quyết định cuối ở implementation sau khi kiểm tra convention delete/archive trong repo.

---

## 7. Worker implementation plan

### 7.1 File mới

```text
workers/src/routes/loginMedia.ts
```

Responsibilities:
- public GET;
- admin GET;
- settings PATCH;
- slide CRUD/reorder;
- signed upload authorization;
- validation helpers local/module-scoped;
- audit calls.

### 7.2 Router registration

Inspect/modify:

```text
workers/src/index.ts
workers/src/router/createWorkerFetch.ts
```

Route order phải tránh conflict:

```text
/api/login-media
/api/admin/login-media...
```

### 7.3 Authorization matrix

Modify:

```text
workers/src/security/apiAuthorizationPolicy.ts
docs/security/api-authorization-matrix.md
```

Policy:

```text
GET /api/login-media                public
/api/admin/login-media*             admin-only
```

### 7.4 Worker env

Modify:

```text
workers/src/types.ts
workers/wrangler.toml
```

Không commit secret value.

### 7.5 D1 schema mirror/audit

Modify:

```text
workers/schema.sql
workers/scripts/audit_d1_migration_state.sql
workers/scripts/bootstrap_d1_migration_registry.sql
```

Nếu repo convention yêu cầu rollback SQL, thêm rollback tương ứng nhưng normal app rollback không tự drop production data.

---

## 8. Frontend public Login Media

### 8.1 Tách Learning Overview nguyên trạng

Create:

```text
src/components/HomePage/components/login-media/LearningOverview.tsx
```

Move block `data-purpose="learning-preview"` từ `HeroSection.tsx` sang component này, giữ visual output hiện tại.

Mục tiêu TDD đầu tiên: snapshot/DOM assertions vẫn thấy `Tổng quan học tập`, `Bài kiểm tra Toán`, `Kết quả đã tổng hợp` khi không có slider.

### 8.2 Types/service

Create:

```text
src/components/HomePage/components/login-media/loginMedia.types.ts
src/services/loginMediaService.ts
```

Service chỉ call public API, không throw error ra ngoài Login page boundary nếu consumer có thể fallback.

### 8.3 Hook

Create:

```text
src/components/HomePage/components/login-media/useLoginMedia.ts
```

State:

```text
loading
ready
mode
settings
slides
degraded
```

Không block render LoginForm.

### 8.4 `LoginMediaSection`

Create:

```text
src/components/HomePage/components/login-media/LoginMediaSection.tsx
```

Logic:

```text
loading -> LearningOverview hoặc reserved skeleton có cùng height
CONTENT -> LearningOverview
SLIDER + 0 usable slides -> LearningOverview
SLIDER + usable slides -> LoginMediaSlider
```

Ưu tiên render LearningOverview ngay rồi hydrate slider khi data ready để tránh empty space.

### 8.5 Slider

Create:

```text
src/components/HomePage/components/login-media/LoginMediaSlider.tsx
```

Behavior:
- fixed reserved aspect ratio/height;
- 1 slide -> no autoplay, arrows/dots optional hidden;
- >1 slide -> autoplay theo interval;
- pause hover nếu enabled;
- focus/hover controls;
- respect `prefers-reduced-motion` / existing reduced-experience hook;
- image `onError` marks slide unusable;
- if all slides unusable -> parent fallback `LearningOverview`;
- do not render broken image placeholder.

### 8.6 HeroSection integration

Modify:

```text
src/components/HomePage/components/HeroSection.tsx
```

Replace inline learning preview with:

```tsx
<LoginMediaSection />
```

Không thay header/slogan/features.

---

## 9. Admin UI plan

### 9.1 Tab/route wiring

Modify:

```text
src/stores/useTeacherDashboardUIStore.ts
src/components/TeacherDashboard/teacher-dashboard-shell/dashboardConfig.ts
src/components/TeacherDashboard/teacher-dashboard-shell/dashboardLazyTabs.tsx
src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardFeatureTabs.tsx
```

Add canonical tab:

```text
login-media
```

URL:

```text
/teacher/login-media
```

UI label:

```text
Banner đăng nhập
```

Render only if `isAdmin`.

Route guard tests phải xác nhận teacher thường bị redirect/không render.

### 9.2 Admin feature files

Create:

```text
src/features/login-media/admin/LoginMediaAdminPage.tsx
src/features/login-media/admin/LoginMediaSettingsCard.tsx
src/features/login-media/admin/LoginMediaSlideList.tsx
src/features/login-media/admin/LoginMediaSlideEditor.tsx
src/features/login-media/admin/LoginMediaPreview.tsx
src/features/login-media/admin/useLoginMediaAdmin.ts
src/features/login-media/loginMediaAdmin.types.ts
```

### 9.3 Admin UX

Sections:

```text
1. Chế độ hiển thị
   - Tổng quan học tập
   - Trình chiếu ảnh

2. Cài đặt trình chiếu
   - autoplay
   - interval 2-30s
   - Fade / Slide
   - dots
   - arrows
   - pause hover

3. Danh sách banner
   - drag/reorder hoặc move up/down accessible controls
   - thumbnail
   - enabled state
   - schedule status
   - edit
   - disable/delete

4. Preview
   - cùng renderer logic gần với public slider

5. Save/Conflict handling
   - reason field
   - expectedVersion
   - 409 -> reload prompt
```

### 9.4 Upload component

Trong Slide Editor:
- file picker;
- client MIME/size check;
- optional image compression nếu cần, nhưng không tái sử dụng `mediaUploadService` endpoint;
- request signed signature;
- direct upload Cloudinary;
- progress;
- preview;
- persist returned `secure_url/public_id/width/height`.

Không lưu base64 vào D1.

---

## 10. Security requirements

### P0

1. Cloudinary API secret chỉ ở Worker secret binding.
2. Signed upload endpoint admin-only.
3. D1 mutations admin-only.
4. Public API read-only, không expose public_id/audit actor.
5. Validate URL/host/server-side.
6. Validate schedule/server-side.
7. Validate interval bounds/server-side.
8. Reorder verifies exact IDs/no duplicates.
9. Settings update uses optimistic version check.
10. LoginForm/auth must be independent from Login Media failures.

### P1

1. Rate limit upload-signature endpoint.
2. Bound all text/url lengths.
3. `openNewTab` links use `rel="noopener noreferrer"`.
4. Avoid untrusted HTML; all text plain React output.
5. Log redaction: no Cloudinary secret/signature dumps.
6. `Cache-Control` public read can be short-lived; admin responses `no-store`.

---

## 11. Accessibility and reduced motion

1. Nếu slide chỉ decorative và không link: alt có thể empty theo semantics.
2. Nếu slide clickable: meaningful alt/accessible name bắt buộc.
3. Arrows phải keyboard accessible và có `aria-label`.
4. Dots phải có accessible current state.
5. Autoplay phải dừng khi keyboard focus nằm trong carousel nếu cần để tránh mất kiểm soát.
6. `prefers-reduced-motion` hoặc existing reduced visual setting -> không animate transition mạnh; có thể disable autoplay hoặc dùng instant transition.
7. Focus ring theo design system hiện có.
8. Không dùng `aria-hidden` cho interactive slider.

---

## 12. Performance requirements

1. Slider chỉ desktop `lg` trong V1.
2. Reserve aspect ratio để tránh CLS.
3. First slide `loading="eager"` hoặc browser-priority cân nhắc sau profiling; slide sau lazy-load/preload vừa đủ.
4. Cloudinary transformation delivery nên chuẩn hóa width/quality tự động trong URL hoặc upload transformation policy nếu phù hợp.
5. Không fetch Admin API ở public login.
6. Public API response nhỏ, chỉ active slides.
7. Giới hạn số slide active trả về, đề xuất max 10.
8. Nếu Admin lưu >10 enabled slides, backend có thể reject hoặc public API cap; quyết định contract trong implementation nhưng phải test rõ.

---

## 13. Error/fallback matrix

| Tình huống | Public login behavior | Admin behavior |
|---|---|---|
| Public API 500 | LearningOverview | N/A |
| D1 table missing | LearningOverview | báo degraded/error |
| mode CONTENT | LearningOverview | settings vẫn editable |
| mode SLIDER, 0 active slides | LearningOverview | cảnh báo chưa có slide hiển thị |
| 1 slide | ảnh tĩnh, không autoplay | bình thường |
| một ảnh 404 | bỏ ảnh lỗi | cảnh báo preview ảnh lỗi |
| tất cả ảnh lỗi | LearningOverview | cảnh báo |
| Cloudinary upload fail | public không ảnh hưởng | retry upload |
| Admin stale version | public không ảnh hưởng | 409 + reload state |
| schedule invalid | public không ảnh hưởng | 400, không lưu |
| malformed public payload | LearningOverview | N/A |

---

## 14. TDD plan theo thứ tự RED -> GREEN

### Task A — Extract LearningOverview không đổi behavior

**RED**
- cập nhật/viết test xác nhận fallback content chính xác.

**GREEN**
- extract component;
- HeroSection render component mới.

**Verification**
- `tests/LoginLandingPresentation.test.tsx`
- `tests/loginHeroIcons.test.tsx`
- focused component tests.

### Task B — Public LoginMediaSection + service

**RED**
- mode CONTENT -> overview;
- API failure -> overview;
- SLIDER + 0 slides -> overview;
- SLIDER + slides -> carousel.

**GREEN**
- service/types/hook/section.

### Task C — Slider behavior

**RED**
- one slide no auto advance;
- multi slide interval;
- arrows/dots;
- pause hover;
- image failure filtering;
- all failure fallback;
- reduced motion.

**GREEN**
- implement slider.

### Task D — D1 migration/schema

**RED**
- worker DB tests boot old/new schema expectations.

**GREEN**
- migration + schema mirror + audit script.

### Task E — Public Worker API

**RED**
- filtering by enabled/start/end;
- stable sort;
- public response hides admin fields;
- missing table/transient failure returns safe CONTENT response.

**GREEN**
- route + router registration.

### Task F — Admin API

**RED**
- teacher/student forbidden;
- admin read success;
- settings validation;
- expectedVersion conflict;
- create/update/reorder/delete behavior;
- audit calls.

**GREEN**
- implement admin mutation routes.

### Task G — Cloudinary signed upload

**RED**
- non-admin forbidden;
- missing config -> 503;
- signature payload bounded;
- folder controlled server-side;
- no secret in response.

**GREEN**
- signature route/helper.

### Task H — Admin UI

**RED**
- admin route render;
- teacher hidden/redirect;
- settings form;
- upload state;
- reorder;
- conflict UI;
- preview.

**GREEN**
- components/service/hooks.

### Task I — Cypress regression

**RED/GREEN**
- login page fallback;
- slider render with stub API;
- admin CRUD happy path with intercepted API;
- non-admin guard.

---

## 15. Test files dự kiến

### Existing tests cần cập nhật/giữ xanh

```text
tests/LoginLandingPresentation.test.tsx
tests/loginFormUi.test.tsx
tests/loginHeroIcons.test.tsx
tests/LoginFormPasskey.test.tsx
tests/TeacherDashboardShell.test.tsx
tests/routeGuards.test.tsx
cypress/e2e/login-home.cy.ts
```

### New tests

```text
tests/LoginMediaSection.test.tsx
tests/LoginMediaSlider.test.tsx
tests/loginMediaService.test.ts
tests/loginMedia.worker.test.ts
tests/LoginMediaAdminPage.test.tsx
cypress/e2e/login-media-admin.cy.ts
cypress/e2e/login-home-media.cy.ts
```

Tên cuối cùng có thể điều chỉnh theo convention repo khi implementation, nhưng coverage intent không đổi.

---

## 16. GitNexus pre-change plan

Trước khi edit từng symbol phải chạy impact upstream theo `AGENTS.md`.

Tối thiểu kiểm tra:

```text
HeroSection
TeacherDashboardFeatureTabs
normalizeTeacherDashboardTab
createWorkerFetch / router handler composition
Env
```

Nếu symbol mới không có impact, chỉ cần impact các symbol hiện hữu sẽ sửa.

Nếu HIGH/CRITICAL:
- dừng;
- báo blast radius;
- xin phê duyệt scope trước khi edit.

Trước commit:

```text
detect_changes({scope: compare, base_ref: main})
```

---

## 17. Worktree/branch plan

Không làm trực tiếp trên dirty `main` hiện tại.

Tạo isolated worktree, ví dụ:

```text
C:\quizpro\.worktrees\login-media-cloudinary
branch: feat/login-media-cloudinary
```

Không đưa hai file untracked sẵn trên main vào commit feature ngoài phạm vi.

Trước worktree:
- xác nhận `git status` main;
- preserve untracked docs hiện có;
- tạo branch từ latest safe `main`/`origin/main` theo repo state thực tế.

---

## 18. Verification commands dự kiến

Các lệnh cụ thể phải xác nhận từ `package.json` trước khi chạy; không đoán script names trong implementation. Coverage intent:

1. Focused Vitest cho Login Media.
2. Existing login regression tests.
3. Worker route tests.
4. Admin/route guard tests.
5. Typecheck.
6. Lint.
7. Build frontend.
8. Worker type/check/build nếu repo có script.
9. Security policy gates.
10. Migration audit script.
11. Cypress desktop login/admin specs.
12. Production-smoke script chỉ sau deploy approval.

---

## 19. Browser verification checklist

Desktop widths:

```text
1280
1440
1920
```

Check:
- LoginForm position không nhảy;
- Hero không overflow;
- slider width ~ current preview region;
- no CLS khi media API trả chậm;
- arrows/dots không đè ảnh;
- focus keyboard;
- bad image fallback;
- mobile/tablet vẫn không render learning-preview/slider nếu giữ V1 `lg` only.

---

## 20. Observability

### Worker logs

Log bounded event names, không log secrets:

```text
login-media-public-read-degraded
login-media-admin-update-conflict
login-media-cloudinary-config-missing
login-media-upload-signature-issued
login-media-slide-validation-failed
```

Không log:
- API secret;
- signed signature đầy đủ;
- auth token;
- user password.

### Audit D1

Actions dự kiến:

```text
LOGIN_MEDIA_SETTINGS_UPDATED
LOGIN_MEDIA_SLIDE_CREATED
LOGIN_MEDIA_SLIDE_UPDATED
LOGIN_MEDIA_SLIDE_REORDERED
LOGIN_MEDIA_SLIDE_DELETED
LOGIN_MEDIA_UPLOAD_AUTHORIZED
```

`UPLOAD_AUTHORIZED` có thể chỉ operational log thay vì D1 audit nếu audit volume không phù hợp; quyết định sau khi inspect existing audit conventions.

---

## 21. Rollout plan

### Phase 1 — Ship code với default CONTENT

Migration seed:

```text
display_mode = CONTENT
```

Sau deploy, public UI phải trông giống trước feature.

### Phase 2 — Admin smoke

Admin:
1. mở `/teacher/login-media`;
2. upload 1 ảnh test;
3. save slide disabled;
4. preview;
5. enable slide;
6. vẫn giữ `display_mode=CONTENT`.

### Phase 3 — Enable SLIDER có kiểm soát

Chỉ sau khi:
- Cloudinary delivery OK;
- public API OK;
- admin state OK;
- login auth smoke OK.

Admin chuyển `display_mode=SLIDER`.

### Phase 4 — Production smoke

Check:
- anonymous login page;
- teacher password login;
- student login;
- passkey availability không regression;
- slider hiện đúng;
- browser console/network sạch;
- fallback thử bằng disabled/no active slide nếu có staging/safe test path.

---

## 22. Rollback plan

### Fastest rollback

Admin set:

```text
display_mode = CONTENT
```

Không redeploy, không xóa slide.

### App rollback

Nếu code issue:
- rollback frontend/Worker version;
- giữ D1 tables/data;
- không drop migration trong normal rollback.

### Cloudinary issue

- set CONTENT;
- không cần xóa Cloudinary asset;
- điều tra riêng.

### Schema rollback

Chỉ khi có incident đặc biệt và explicit production approval. Không drop tables có owner-created data trong normal release rollback.

---

## 23. Stop conditions

Dừng implementation/deploy nếu:

1. GitNexus impact HIGH/CRITICAL chưa được user duyệt.
2. Cloudinary credential strategy chưa rõ hoặc có nguy cơ expose secret.
3. Existing login/auth tests fail.
4. Public Login Media failure có thể làm LoginForm fail/block.
5. Migration audit không khớp D1 remote.
6. Worker public route expose admin metadata/public_id không cần thiết.
7. Teacher/student có thể gọi Admin mutation.
8. Upload signature endpoint cho client control folder/transform nguy hiểm.
9. Browser regression làm mobile login xấu hơn.
10. Required CI/security/release-readiness fail.
11. Production action chưa có explicit approval.

---

## 24. Thứ tự triển khai an toàn đề xuất

### PR 1 — Public component extraction + fallback architecture

Phạm vi:
- extract `LearningOverview`;
- `LoginMediaSection` shell;
- public service/types;
- no D1/Cloudinary yet hoặc API mocked-safe fallback.

Mục tiêu:
- chứng minh LoginForm không bị ảnh hưởng;
- tạo seam an toàn.

### PR 2 — D1 + Worker public/admin contracts

Phạm vi:
- migration;
- schema;
- public GET;
- admin CRUD/settings/reorder;
- auth/audit;
- no Cloudinary direct upload UI yet nếu cần giảm blast radius.

Mục tiêu:
- contract + persistence ổn định.

### PR 3 — Cloudinary signed upload + Admin UI

Phạm vi:
- Worker Cloudinary signing;
- Admin page/tab;
- upload/edit/reorder/settings/preview.

Mục tiêu:
- end-to-end admin management.

### PR 4 — Slider polish + browser/a11y/performance

Nếu PR 1 đã có slider basic thì PR này chỉ polish; nếu muốn ít PR hơn có thể gộp vào PR 3 sau approval.

Mục tiêu:
- production-ready motion, bad-image handling, responsive/a11y/perf.

> Có thể gộp PR 1+2 nếu blast radius GitNexus LOW/MEDIUM và test suite đủ nhanh, nhưng mặc định ưu tiên tách để rollback dễ.

### Quy tắc theo mức rủi ro

- **LOW:** thay đổi cục bộ, ít caller, không chạm auth/data contract; có thể triển khai trong PR nhỏ sau khi test RED rõ ràng.
- **MEDIUM:** chạm router, D1 schema, Admin contract hoặc external provider; bắt buộc focused tests + regression suite + browser/security verification trước gate commit.
- **HIGH/CRITICAL:** dừng trước khi sửa và xin phê duyệt phạm vi riêng theo `AGENTS.md`.

Đối với feature này, audit hiện tại chỉ là ước lượng kiến trúc. Mức rủi ro chính thức chỉ được chốt sau GitNexus impact trên worktree; không coi đánh giá LOW/MEDIUM ở plan là bằng chứng thay cho impact analysis.

---

## 25. Acceptance criteria cuối cùng

Feature chỉ được coi là hoàn tất khi tất cả điều kiện sau đạt:

1. Default production sau migration vẫn là `CONTENT`.
2. Login teacher/student/passkey không regression.
3. Admin-only tab `/teacher/login-media` hoạt động.
4. Admin upload ảnh Cloudinary mà không expose API secret.
5. D1 lưu settings/slides đúng schema.
6. Reorder/schedule/enable/disable persist qua reload.
7. Public API chỉ trả active slides đúng lịch.
8. Slider chạy đúng interval/config.
9. Một ảnh lỗi không làm carousel broken.
10. Tất cả ảnh lỗi/API lỗi -> `LearningOverview`.
11. Mobile behavior không thay đổi trong V1.
12. Audit log ghi mutations quan trọng.
13. Optimistic conflict trả 409 và UI xử lý rõ.
14. Focused/full relevant tests pass.
15. Typecheck/lint/build/security/release-readiness pass.
16. Cypress login/admin pass.
17. GitNexus `detect_changes` không thấy scope ngoài dự kiến.
18. User approve commit/push riêng.
19. PR required CI/review pass trước merge.
20. Production migration/deploy/smoke có approval riêng và evidence thành công.

---

## 26. Gate tiếp theo

Sau khi plan này được duyệt:

```text
1. Tạo isolated worktree/branch.
2. Refresh/inspect repo state + package scripts + migration sequence.
3. Chạy GitNexus impact cho symbols sẽ sửa.
4. Báo blast radius.
5. Nếu không HIGH/CRITICAL, bắt đầu PR 1 bằng TDD RED.
```

Không commit, push, migrate production hoặc deploy cho tới khi user duyệt đúng gate tương ứng.
