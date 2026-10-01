# Thiết kế hệ thống logo chính thức và tài sản SEO

## 1. Mục tiêu

Thay toàn bộ nhận diện logo hiện tại của TôHiệuQuiz bằng huy hiệu mới do người dùng cung cấp, đồng thời giữ wordmark `TôHiệuQuiz` tại các bề mặt đủ rộng. Hệ thống mới phải đồng nhất trên giao diện ứng dụng, favicon, Apple touch icon, PWA manifest, metadata Open Graph/Twitter và structured data SEO.

Phương án được duyệt là **A — huy hiệu + wordmark thích ứng theo bề mặt**:

- Bề mặt rộng dùng huy hiệu bên trái và wordmark `TôHiệuQuiz` bên phải.
- Bề mặt nhỏ chỉ dùng huy hiệu.
- Ảnh chia sẻ SEO dùng bố cục ngang 1200×630 chuyên dụng.

## 2. Nguồn logo

Ảnh nguồn là PNG vuông 1290×1290, hệ màu sRGB, có kênh alpha và bốn góc trong suốt. Nội dung huy hiệu phải được giữ nguyên; không vẽ lại, không thay chữ, không đổi màu và không cắt mất vòng ngoài.

Ảnh nguồn được lưu phiên bản hóa tại:

`public/assets/branding/school-logo-source-v2.png`

Mọi tài sản dẫn xuất phải được sinh từ file này để tránh sai khác giữa UI, favicon, PWA và SEO.

## 3. Quy tắc sử dụng thương hiệu

### 3.1. Lockup rộng

Các header, navbar, trang đăng nhập, footer và dashboard tiếp tục dùng component `SchoolLogo` cạnh wordmark `TôHiệuQuiz` hiện có.

- Khoảng cách giữa huy hiệu và wordmark: 8–10px.
- Logo hiển thị: 32–44px tùy bề mặt hiện có.
- Không thêm vòng tròn nền quanh huy hiệu vì huy hiệu đã có hình tròn hoàn chỉnh.
- Không đổi typography hoặc màu wordmark hiện có trong phạm vi công việc này.

### 3.2. Vị trí nhỏ

Favicon, Apple touch icon, PWA icon, trạng thái loading nhỏ và các vị trí chỉ đủ chỗ cho biểu tượng dùng huy hiệu riêng, không ghép wordmark.

### 3.3. Social preview

Open Graph và Twitter dùng ảnh ngang 1200×630:

- Nền chính: ivory `#FFFDF7`.
- Màu nhấn: school blue `#0A3FAE`.
- Huy hiệu nằm bên trái, giữ đầy đủ vòng ngoài.
- Bên phải hiển thị `TôHiệuQuiz` và dòng `TRƯỜNG TIỂU HỌC TÔ HIỆU`.
- Vùng nội dung quan trọng nằm trong safe area 1080×510 để không bị cắt trên Facebook, Zalo hoặc X.

## 4. Ma trận tài sản

| Tài sản | Kích thước | Định dạng | Mục đích |
|---|---:|---|---|
| `school-logo-source-v2.png` | 1290×1290 | PNG RGBA | Nguồn chính, không chỉnh nội dung |
| `school-logo-v2.webp` | 512×512 | WebP lossless | Logo UI qua `SchoolLogo` |
| `school-logo-512.png` | 512×512 | PNG RGBA | Structured data và SEO logo |
| `favicon-32.png` | 32×32 | PNG RGBA | Browser favicon |
| `favicon-48.png` | 48×48 | PNG RGBA | Shortcut icon và fallback UI |
| `apple-touch-icon.png` | 180×180 | PNG RGBA | iOS home screen |
| `pwa-icon-192.png` | 192×192 | PNG RGBA | PWA `purpose: any` |
| `pwa-icon-512.png` | 512×512 | PNG RGBA | PWA `purpose: any` |
| `pwa-maskable-512.png` | 512×512 | PNG RGB/RGBA | PWA `purpose: maskable`, huy hiệu nằm trong safe zone 80% |
| `tohieuquiz-social-card-v2.png` | 1200×630 | PNG | Open Graph và Twitter large image |

Tất cả tên file mới dùng hậu tố `v2` hoặc tên kích thước cụ thể để phá cache. Các đường dẫn cũ không còn được tham chiếu sau khi chuyển đổi.

## 5. Kiến trúc tạo tài sản

Thêm script `scripts/build-brand-assets.mjs` sử dụng dependency `sharp` đã có trong dự án.

Script có hai chế độ:

- `--write`: sinh lại toàn bộ tài sản dẫn xuất từ ảnh nguồn.
- mặc định: kiểm tra file nguồn, kích thước, alpha, file đầu ra và metadata; trả exit code khác 0 nếu bộ tài sản không đúng contract.

`package.json` cung cấp:

- `assets:branding`: chạy generator với `--write`.
- `assets:branding:check`: xác minh tài sản đã commit.

`prebuild:frontend` chạy `assets:branding:check` trước MathJax để CI phát hiện asset bị thiếu hoặc sai kích thước.

Social card được dựng bằng Sharp composite với SVG text cố định. Nội dung chữ là dữ liệu nội bộ của script, không lấy từ input bên ngoài. Generator phải tạo kết quả xác định từ cùng một file nguồn.

## 6. Tích hợp giao diện

`src/config/branding.ts` là nguồn đường dẫn runtime:

- `SCHOOL_LOGO_URL = '/assets/branding/school-logo-v2.webp'`
- `PRODUCT_LOGO_FALLBACK_URL = '/assets/branding/favicon-48.png'`
- thêm URL tuyệt đối cho SEO logo và social card nếu cần dùng từ TypeScript.

`SchoolLogo` giữ nguyên API và hành vi fallback. Vì các header/footer/dashboard đã dùng component chung, đổi cấu hình trung tâm sẽ thay logo trên toàn bộ bề mặt đó mà không sao chép JSX.

Không thay icon chức năng, mascot, avatar, logo đối tác hoặc icon module; chúng không phải logo thương hiệu của dự án.

## 7. Tích hợp favicon và PWA

`index.html` chuyển các link icon sang PNG mới:

- `rel="icon"` 32×32.
- `rel="icon"` 48×48.
- `rel="shortcut icon"` dùng 48×48.
- `rel="apple-touch-icon"` dùng 180×180.

`public/site.webmanifest` khai báo ba icon:

- 192×192, `purpose: any`.
- 512×512, `purpose: any`.
- 512×512, `purpose: maskable`.

Theme color giữ nguyên `#2563eb` trong phạm vi thay logo.

## 8. Tích hợp SEO

### 8.1. Metadata tĩnh

`index.html` dùng URL tuyệt đối:

- `og:image` và `twitter:image`: `https://www.thtohieu.com/assets/branding/tohieuquiz-social-card-v2.png`.
- thêm `og:image:width=1200`, `og:image:height=630`, `og:image:type=image/png`.
- alt: `Huy hiệu Trường Tiểu học Tô Hiệu và TôHiệuQuiz`.
- JSON-LD `logo`: `https://www.thtohieu.com/assets/branding/school-logo-512.png`.
- JSON-LD `image`: social card 1200×630.

`EducationalOrganization` và `SoftwareApplication` cùng tham chiếu logo chính thức. `WebSite` có image social card.

### 8.2. Metadata SPA

`src/hooks/useSeo.ts` phải đặt lại ảnh mặc định khi chuyển route để ảnh hero của route trước không rò sang trang sau.

- Mọi route thông thường dùng social card mặc định.
- Structured data của `EducationalOrganization`, `WebSite`, `WebPage`, `Quiz` và publisher dùng URL logo/social phù hợp.
- Route private/noindex vẫn có metadata nhất quán nhưng không thay đổi quy tắc robots.

### 8.3. Competition portal

`useCompetitionPortalSeo` dùng social card mặc định khi campaign/article không có ảnh riêng. Khi có `hero.imageUrl` hoặc `coverImageUrl`, ảnh nội dung vẫn được ưu tiên. Việc chuyển giữa route có ảnh và route fallback phải luôn cập nhật cả `og:image` lẫn `twitter:image`, không xóa về trạng thái rỗng.

## 9. Accessibility và chất lượng hình ảnh

- `SchoolLogo` tiếp tục dùng alt mặc định `Logo Trường Tiểu học Tô Hiệu` khi không decorative.
- Logo decorative vẫn có `alt=""` và `aria-hidden`.
- Không dùng CSS background cho logo mang ý nghĩa để tránh mất alt text.
- Asset PNG/WebP phải giữ tỷ lệ 1:1, không méo, không cắt vòng ngoài.
- Các icon nhỏ được resize với kernel Lanczos3 và giữ alpha.
- Maskable icon phải giữ toàn bộ huy hiệu trong safe zone trung tâm 80%.

## 10. Kiểm thử

### 10.1. TDD contract tests

Thêm hoặc cập nhật test để kiểm tra:

- URL logo runtime trỏ sang `v2`.
- `SchoolLogo` render file mới và fallback mới.
- Tất cả surface integration hiện có vẫn render một `SchoolLogo`.
- Asset nguồn và dẫn xuất tồn tại, đúng kích thước, định dạng và alpha.
- Manifest có đủ icon `any` và `maskable`.
- HTML có favicon, Apple icon, OG/Twitter image và JSON-LD URL mới.
- `useSeo` đặt social card mặc định và structured data logo.
- Competition SEO fallback dùng social card nhưng vẫn ưu tiên ảnh campaign/article.

### 10.2. Verification

- Focused Vitest branding/SEO suites.
- Generator check.
- ESLint và TypeScript typecheck.
- Frontend production build.
- Performance budget để bảo đảm asset mới không làm tăng initial JS/CSS.
- Cypress/browser smoke ở desktop và mobile: logo rõ, không làm vỡ header, không gây layout shift.
- Kiểm tra trực tiếp favicon, manifest, OG/Twitter và JSON-LD trên production sau deploy.

## 11. Phạm vi không thực hiện

- Không đổi tên sản phẩm `TôHiệuQuiz`.
- Không đổi font, palette hoặc layout tổng thể.
- Không sửa logo đối tác, mascot, avatar, icon chức năng hoặc icon module.
- Không thay API, Worker, D1, auth hoặc dữ liệu nghiệp vụ.
- Không dùng AI để vẽ lại nội dung huy hiệu chính thức.

## 12. Rủi ro và giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| Huy hiệu nhiều chi tiết khó đọc ở 32px | Trung bình | Sinh favicon riêng từ cùng nguồn, xem trực tiếp trên Chrome desktop/mobile |
| Social platform cache ảnh cũ | Trung bình | Tên file `v2`, URL tuyệt đối và xác minh bằng response headers |
| PWA mask cắt vòng ngoài | Trung bình | Asset maskable có safe zone 80%, test kích thước và browser preview |
| Ảnh hero competition bị ghi đè | Thấp | Test cả fallback và override |
| Đường dẫn logo cũ còn sót | Thấp | `rg` contract test và final diff review |

## 13. Rollback

Rollback bằng cách revert commit triển khai. Các đường dẫn mới được phiên bản hóa nên revert sẽ khôi phục logo/favicons/SEO cũ mà không cần migration hoặc thao tác dữ liệu.
