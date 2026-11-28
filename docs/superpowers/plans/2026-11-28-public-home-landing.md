# Thay trang chủ công khai bằng landing TôHiệuQuiz

Ngày lập: 28/11/2026. Trạng thái: user đã duyệt triển khai ngày28/11/2026; gate commit/push cuối vẫn riêng.

## 1. Mục tiêu và quyết định sản phẩm

Thay phần hiển thị cho khách chưa đăng nhập tại `https://www.thtohieu.com/` bằng landing dựa trên file người dùng cung cấp. Không tạo route `/gioi-thieu`.

Người đã đăng nhập vẫn đi tới dashboard theo vai trò như hiện tại. Link làm bài, đăng nhập có chủ đích, portal phụ huynh và các trang công khai khác tiếp tục dùng contract hiện có. Đây là thay đổi giao diện công khai, không phải refactor auth hoặc Worker.

Nguồn thiết kế:

- File gốc: `C:\Users\Administrator\Desktop\Landing Page Giới Thiệu TôHiệuQuiz (1).html`.
- Kích thước: 2.866.954 byte.
- SHA256: `D23F04663601E669730BA017111FB48B99E7758AC9BABB13A584058AC283A78F`.
- Đã render xem desktop; giữ màu nền sáng, xanh/vàng, typography Baloo 2/Be Vietnam Pro, ảnh và cấu trúc giới thiệu theo mẫu. Cân lại hero để tiêu đề và CTA không bị đẩy xuống sâu; không sao chép lỗi kích thước ảnh của bản HTML.
- Giữ nguyên file Desktop; mọi bản xem/manifest/log nằm ngoài repository trong `C:\Users\Administrator\.codex\artifacts\public-home-landing-plan-20261128`.

## 2. Baseline, worktree và phạm vi

Baseline đã fetch: `09cde0442d1fc2dca48616e479cb10076b189926` trên `origin/main`.

Worktree chỉ dùng lập plan:

- `C:\Users\Administrator\.codex\worktrees\plan-public-home-landing\quizpro`
- Branch `codex/plan-public-home-landing`.

Sau khi duyệt plan, tạo worktree implementation riêng từ `origin/main` mới nhất:

- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro`
- Branch `codex/feat-public-home-landing`.

Nếu baseline đã tiến lên, đọc diff và chạy lại phân tích/test baseline trước khi sửa. Không reset/clean/fast-forward `C:\quizpro` đang dirty; đặc biệt không ghi đè `HeroSection.tsx`, AGENTS.md, CLAUDE.md và các plan chưa commit ở đó. Cài dependency theo lockfile, không dùng node_modules junction.

## 3. Kiến trúc tích hợp đã kiểm tra

Hiện tại:

1. `AppRoutes` xử lý `?login=teacher|student` trước khi tới `RootView`, kể cả safe returnTo và mixed-role session.
2. `RootView` ưu tiên selected quiz/player, tiếp theo teacher session, rồi student session; nhánh guest cuối cùng render `PublicPageLayout` + `HomePage`.
3. `HomePage` lại render `LoginLandingPage` khi guest.
4. `MainApp` giữ session bootstrap, quiz query/bootstrap, SEO và scroll; parent host được chọn bên ngoài MainApp.

Thay đổi dự kiến:

- Thêm lazy `PublicHomeLandingPage` trong lazyViews.
- Chỉ thay nhánh guest cuối của `RootView` bằng landing mới. Giữ nguyên thứ tự/điều kiện và destination của ba nhánh trước.
- Landing sở hữu header, một main landmark và footer riêng. Không bọc thêm PublicPageLayout để tránh footer/main lặp.
- Giữ HomePage và LoginLandingPage cũ; không sửa auth store, bootstrap, route guards, safe returnTo, player, scoring hoặc assignment attempts.
- MainApp chỉ bổ sung presentation scroll key phân biệt public landing và explicit public login khi cùng pathname `/`, dùng API view-key đã có của useScrollReset. Không đổi auth/bootstrap/SEO/banners hoặc logic chọn route. AppRoutes/navigationRoutes/useScrollReset/useSeo giữ nguyên. Nếu thật sự cần mở rộng hơn, ghi lý do, impact và xin duyệt scope bổ sung trước khi sửa.
- Không dùng iframe, dangerouslySetInnerHTML hoặc nhúng nguyên HTML/script/style global vào React.

### Ma trận tương thích bắt buộc

| Đầu vào | Hành vi sau thay đổi |
| --- | --- |
| Guest `/` | Landing mới, không tự mở login form |
| Guest `/#tinh-nang`, `/#bat-dau` | Sau lazy mount mới tới đúng section; không bị sticky header che; POP về vị trí đã lưu không bị effect hash giành scroll |
| `/?login=student` | Login học sinh hiện có |
| `/?login=teacher` | Login giáo viên hiện có |
| `?login=...&returnTo=...` | Giữ resolveSafeReturnTo, loại external/malformed/mismatched destination như baseline |
| Teacher session tại `/` | Giữ redirect về teacher route/legacy tab hiện tại |
| Student session tại `/` | Giữ dashboard/shop/returnTo hiện tại |
| Cả hai session, explicit role | Giữ quy tắc chọn role hiện tại, không tự đổi tài khoản |
| `/?quiz=...&ref=school` | Giữ canonicalization sang quizId, không làm mất query liên quan |
| `/?quizId=...` hợp lệ | Giữ selected quiz/player, không bị landing chặn |
| Link assignment/category hiện có | Characterize chính xác baseline; không phát minh query contract mới, không đổi quyền/lượt làm |
| Session đang bootstrap/hết hạn | Giữ contract loading/redirect; không thêm guarantee mới hoặc lộ UI private |
| Parent host hoặc `?portal=parent` trong cấu hình hỗ trợ | Portal/fallback phụ huynh hiện tại, không render landing main site |
| `/about`, `/contact`, `/privacy`, `/tos`, school profile, competition, wildcard | Giữ route và lịch sử Back/Forward hiện tại |

### CTA và điều hướng

- CTA học sinh: `/?login=student`.
- CTA giáo viên: `/?login=teacher`.
- CTA phụ huynh: `https://phuhuynh.thtohieu.com/login`, đúng origin portal đã ghi trong CONTEXT và smoke hiện tại; reuse constant nếu có, không dùng `/login` trên main host.
- CTA chung “Vào hệ thống”/“Bắt đầu”: dẫn tới phần chọn vai trò `#bat-dau`; tại đó có các nút role rõ ràng. Không trỏ lại origin `/` gây vòng lặp, không tự đọc/ghi saved-login storage.
- CTA cuộc thi: `/cuoc-thi`, dùng thông tin/lịch đang công khai ở portal hiện tại, không tự chọn slug hoặc tự mở lượt thi.
- Legal/about/contact dùng React Router Link để giữ client navigation và POP scroll restore; không thay bằng window.location reload cho link nội bộ. Role login cũng dùng Router Link. Vì `/` → `/?login=...` chỉ đổi search, MainApp truyền scroll view-key riêng cho landing/login để màn login mở ở đầu trang, không ở offset footer; khóa bằng browser test. Không sửa hay nhân bản safe returnTo/auth logic.
- Anchor nội trang dùng ID ổn định, scroll-margin-top, hỗ trợ hash khi mở trực tiếp. Ưu tiên native anchors. Thêm hook local sau lazy mount: chỉ scroll hash hợp lệ thuộc landing ở fresh/default entry hoặc PUSH/REPLACE; không override POP restore của legal/footer. Reload có saved scroll ưu tiên vị trí đã lưu. Bounded scheduling/cleanup khi unmount, hash đổi hoặc người dùng chủ động scroll/focus; malformed hash không throw. Không sửa global scroll hook để thêm smooth scroll.

## 4. Nội dung, hình ảnh và branding

### Dữ liệu giới thiệu

Các số 49/124/92%/22/53/36/3/4 trong HTML chưa được xác minh. Không lấy dữ liệu bằng API teacher/admin hoặc từ store private để public các số đó.

Mặc định khi triển khai: giữ kiểu thẻ/con số của thiết kế nhưng đổi phần chưa xác minh thành thông tin năng lực đã biết, như lớp 1–5, vai trò học sinh/giáo viên/phụ huynh và các hình thức học/kiểm tra. Nếu người dùng cung cấp snapshot số liệu đã xác nhận, tập trung tại một nguồn content có ngày chốt; không gọi đó là số liệu trực tiếp. Không tạo endpoint thống kê mới trong đợt này.

Phần Trạng Nguyên Nhí giữ nội dung giới thiệu và link portal; bỏ khẳng định “đang mở”, lịch đóng 01/12/2026, điểm đạt 80, số vòng/lượt hoặc khối dự thi khi chưa đối chiếu. Ảnh thẻ vòng thi, nếu dùng, phải được mô tả là minh hoạ giao diện, không là lịch hiện hành. Chi tiết tính năng phải khớp code/config đang có; không biến feature đang tắt thành CTA vào chức năng mở.

### Asset

Đã kiểm tra đúng tám ảnh nhúng: bốn WebP 1920×1280 và bốn PNG screenshot. Tổng byte ảnh giải mã là 2.095.447; HTML còn mang overhead base64 và markup.

- Xuất asset riêng, không commit nguyên file HTML 2,87 MB hoặc data URI vào bundle.
- Ảnh chụp giao diện giữ chữ rõ, không cắt/biến dạng; ưu tiên giữ PNG gốc nếu đã gọn và sạch nội dung. Đã xem cả bốn PNG: ảnh số2 có username tác giả, ảnh số8 có ID quiz nội bộ và trạng thái/lịch cũ. Không public nguyên hai ảnh này; thay bằng screenshot demo sạch hoặc minh hoạ tương đương trước commit. Chụp lại chỉ bằng fixture/tài khoản giả ở localhost, không lấy dữ liệu hay credential production. Helper chụp one-off có thể nằm ngoài repo trong artifact; CI chỉ kiểm asset tĩnh đã commit.
- Tạo hai kích thước WebP phù hợp cho mỗi ảnh minh hoạ lớn khi công cụ hiện có hỗ trợ. Ghi nguồn SHA, dimensions và hash output trong content/manifest hoặc artifact. Không thêm dependency chỉ để chuyển ảnh nếu pipeline có sẵn đáp ứng được.
- Đề xuất thư mục public: `public/assets/landing/v1/`; dự kiến tối đa 12 ảnh gồm tám biến thể photo và bốn screenshot. Số/tên cuối phải được liệt kê trong approval manifest trước commit.
- Không có runtime/build/CI dependency vào đường dẫn Desktop. Các asset sử dụng trên trang phải nằm trong repo; nguồn HTML chỉ là tài liệu tham chiếu.
- Hero dùng srcSet/sizes, width/height, eager/fetchPriority high; ảnh dưới fold loading lazy và decoding async. Bản HTML có width1920/height1280 nhưng CSS không đặt height:auto; bản port phải đặt h-auto/aspect-ratio đúng để tránh giữ chiều cao1280px khi ảnh đã thu hẹp.
- Alt mô tả trung tính; không khẳng định ảnh minh hoạ là ảnh thật của trường khi chưa xác minh. Rà lại screenshot trước khi public để không đưa thông tin tài khoản/học sinh không cần thiết ra trang giới thiệu. Người dùng đã cung cấp ảnh để dùng trong landing; không đặt thêm gate đồng ý ảnh chỉ vì ảnh có người.

### Nhận diện/SEO

Reuse SchoolLogo/config schoolIdentity và branding v2 hiện tại. Không dùng badge chữ T/placeholder favicon data:, của HTML để thay logo/favicons chính thức.

Baloo 2 và Be Vietnam Pro đã có trong index/styles hiện tại: reuse, không thêm thư viện/font request mới chỉ cho trang này.

Giữ title, canonical root, favicon-school-v2.png, OG/social v2 và structured data EducationalOrganization hiện tại; không copy head của HTML đính kèm. Root đã có trong sitemap, không thêm route mới hoặc duplicate sitemap entry. Kiểm tra cả metadata tĩnh và sau hydrate; giữ robots của private/quiz/parent routes.

## 5. File dự kiến

Các file implementation sau nằm dưới `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro` khi worktree được tạo.

Sửa production/config:

- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\app\RootView.tsx` — nhánh guest và import không còn dùng.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\app\App.tsx` — chỉ presentation scroll view-key của MainApp, giữ các hook và guard khác nguyên vẹn.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\app\lazyViews.ts` — lazy export mới.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\package.json` — thêm spec landing mới vào cypress:run:stubbed, giữ toàn bộ spec cũ; không đổi dependency/lockfile.

Thêm module:

- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\PublicHomeLandingPage.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\publicHomeLanding.content.ts`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\usePublicHomeHashNavigation.ts` — hash sau lazy mount, không giành POP scroll.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\PublicHomeLanding.css`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\LandingHeader.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\LandingHero.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\AudienceAndFeatures.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\RoleBenefitsTabs.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\CompetitionHighlights.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\LandingFacts.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\GettingStarted.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\src\features\public-home\components\LandingFooter.tsx`
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\public\assets\landing\v1\` — asset tĩnh theo manifest cuối.

Test mới/sửa:

- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\tests\PublicHomeLandingPage.test.tsx` — component, CTA, tabs/keyboard, branding/content.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\tests\PublicHomeAssets.test.ts` — asset có thật, format/dimensions/size, không data URI hoặc phụ thuộc Desktop.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\tests\PublicHomeHashNavigation.test.tsx` — fresh hash/PUSH so với POP, malformed hash, cleanup và không cướp scroll/focus.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\tests\AppShell.test.tsx` — guest marker mới và compatibility matrix.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\tests\LegalPageBack.test.tsx` — mock landing mới, giữ POP/REPLACE assertions.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\cypress\e2e\public-home-landing.cy.ts` — landing mới.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\cypress\e2e\login-home.cy.ts` — login form qua explicit login URL, vẫn giữ role/returnTo cases.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\cypress\e2e\mobile-responsive.cy.ts` — root landing selector/320px, giữ login/private/public page checks.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\cypress\e2e\route-scroll.cy.ts` — footer Link selector, không bỏ lịch sử/scroll assertions.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\cypress\e2e\production-smoke.cy.ts` — thêm marker landing ổn định; giữ error collection/asset/parent checks.
- `C:\Users\Administrator\.codex\worktrees\feat-public-home-landing\quizpro\cypress\e2e\unified-notifications.cy.ts` — bổ sung sau full browser RED: đổi URL fixture đăng nhập từ `/` sang `/?login=student`; đo chiều cao AUT thực tế và xác nhận đúng viewport 900/844px thay cho giá trị cấu hình mặc định 720px. Giữ kiểm tra thông báo, form và giới hạn viewport; không sửa code thông báo. Leaf-file impact LOW, 0 caller/0 flow. File này được liệt kê trong scope cuối 40 file trước gate duyệt commit.
- Plan này được copy sang implementation worktree để ghi tiến độ và commit cùng thay đổi được duyệt cuối.

Không dự kiến sửa Worker, D1, auth/store/bootstrap, LoginLandingPage/LoginForm, HomePage/HeroSection cũ, SchoolLogo, global styles/index/useSeo, CI/security policy hoặc performance budget. Nếu cần mở rộng, dừng tại scope đó và trình lý do/diff/impact; tiếp tục phần độc lập đã được phép.

## 6. GitNexus và đánh giá rủi ro

Fresh index planning: 27.691 nodes / 56.094 edges / 300 flows, alias plan-public-home-landing. FTS không khả dụng; query concept trả rỗng và đã bổ sung exact context/UID cùng đọc source/tests.

RootView: LOW; một direct caller AppRoutes, upstream MainApp → App, ba impacted symbols, không có flow được đánh dấu. MainApp: LOW, một caller App, một impacted symbol, không affected flow; chỉ sửa scroll view-key. useSeo đã khảo sát LOW/một caller MainApp/không affected flow, nhưng không nằm trong scope sửa cơ sở.

Rủi ro nghiệp vụ do orchestrator đánh giá MEDIUM vì đổi điểm vào công khai và nhiều test đang mặc định `/` là login. Graph LOW không thay thế kiểm thử auth/deep-link/parent/scroll.

Trước implementation phải refresh nếu stale, chạy impact upstream cho RootView, MainApp và các symbol thực sự sửa. Binary asset và tài liệu N/A với symbol impact; helper mới chưa tồn tại phải được index/context/impact sau tạo. HIGH/CRITICAL phải báo và chờ xác nhận trước sửa. Chạy detect_changes compare origin/main sau sửa, và staged đủ file ngay trước commit; không dùng compare tracked để khẳng định đã bao phủ untracked files.

## 7. Các task triển khai

### Task 1 — Baseline và characterization

- Tạo worktree implementation, npm ci root/Worker theo lockfile, lưu baseline/SHA và trạng thái dirty main.
- Chạy baseline các suite app shell, guards/login/passkey/session recovery, legal/scroll, brand/favicon/parent.
- Baseline Cypress login-home/mobile/route-scroll trên server npm run dev có predev MathJax, API chỉ localhost fixture.
- Khóa teacher/student/mixed session, explicit login, legacy quiz query, quiz player, parent host, legal Back/Forward; assignment/category chỉ theo contract tìm thấy, không thêm hành vi mới để test xanh.

### Task 2 — RED cho homepage mới

- Viết assertion guest `/` phải render landing mới và có role CTA; test phải FAIL trên nhánh guest cũ vì vẫn là login/home cũ, không chỉ FAIL do thiếu module import.
- Giữ characterization compatibility xanh. Ghi log RED thực tế.
- Thêm test DOM/content/assets/keyboard cần thiết theo từng package; không tạo test kiểm lại chi tiết implementation vô ích.

### Task 3 — Asset và content chuẩn bị

- Extract ảnh từ input đã hash vào artifact, kiểm tra từng ảnh/screenshot.
- Tạo asset tối ưu và responsive phù hợp, content nguồn tập trung, link role/public/legal rõ ràng.
- Dùng capability facts mặc định cho số chưa xác minh; bỏ live status/lịch thi hardcode. Giữ source Desktop nguyên vẹn.
- Chạy asset tests; browser sẽ kiểm tra naturalWidth và mạng tải thật, không chỉ kiểm file tồn tại.

### Task 4 — Component landing và tương tác

- Tách component theo section; page chính chỉ composition, không gom toàn HTML/logic thành một file lớn.
- Dùng JSX/React state cho tabs, tránh gắn listener DOM thủ công theo script HTML.
- Header desktop/mobile: menu mobile có aria-expanded/controls, mở/đóng bằng keyboard, Escape, focus hợp lý, không khóa điều hướng.
- Tabs theo role: aria tablist/tab/tabpanel, roving tabIndex, ArrowLeft/Right/Home/End; không tự điều hướng khi đổi tab.
- Native anchor IDs và scroll-margin; focus-visible, skip link, một h1/main/footer, alt/caption không lặp dư. Hash hook chạy sau lazy mount, phân biệt fresh/PUSH với POP để không đua scroll restoration; kiểm direct `/#tinh-nang` và `/#bat-dau`, cũng như Back từ legal sau khi người dùng đã scroll xa hơn anchor.
- Reuse Tailwind/design tokens/fonts hiện có; CSS mới scope theo public-home, không dùng selectors global body/html/h1/a/.btn/.wrap.
- Reduced motion cho transition/decorations; không mang counter animation vào nếu không có dữ liệu số đã xác minh. Nếu cần effect/observer, cleanup đầy đủ.

### Task 5 — Nối RootView và đạt GREEN

- Thay đúng guest fallback, thêm lazy export. Landing không bọc PublicPageLayout lần nữa. MainApp chỉ đổi view-key truyền cho useScrollReset khi đang public root: landing/login phải phân biệt; selected-quiz/player và các route khác giữ key cũ. Không đổi thứ tự hook, session/auth decisions hoặc tự reset scroll ở mọi lần landing mount.
- Giữ nguyên ba nhánh selected quiz/teacher/student trước guest.
- Màn explicit login và role returnTo vẫn qua AppRoutes/LoginLandingPage hiện tại, không sửa saved accounts/passkey/session handling.
- Đạt GREEN test homepage mới và toàn bộ compatibility; update mock/selector cũ theo DOM mới, không xóa assertion quyền/lịch sử/health.

### Task 6 — Responsive, performance và accessibility

- Browser tại 320×800, 375×812, 768×1024, 1024×768, 1440×900, 1920×1080.
- Không overflow ngang, CTA đọc/bấm được, ảnh không vỡ/cắt nội dung quan trọng, menu mobile và tabs dùng keyboard được; anchor không bị che; Back/Forward từ footer giữ scroll. Đăng nhập từ CTA cuối trang phải bắt đầu ở đầu màn hình; direct hash sau lazy mount phải đúng vị trí; POP/legal với hash phải giữ saved offset. Các trường hợp này phải có assertion vị trí thực tế trong Cypress, không chỉ kiểm URL.
- Screenshot các viewport, so với HTML nguồn về bố cục/màu/spacing; cân hero để CTA desktop xuất hiện trong viewport đầu hợp lý.
- Measure CSS sớm: baseline CSS gzip48.322byte, budget toàn bộ CSS51.200byte, chỉ còn2.878byte. Analyzer cộng mọi CSS kể cả lazy; tách chunk không né được gate. Ưu tiên utility đã có, custom CSS gọn, không chép nguyên stylesheet HTML. Không nâng budget/gia hạn waiver.
- Các gate giữ nguyên: initial JS gzip204.800byte, CSS51.200byte; lazy/single chunk theo config hiện tại, chỉ exception MathJax đã có.
- Image budget bổ sung để review: hero phù hợp viewport mục tiêu≤180KiB; tổng bộ asset đã tối ưu mục tiêu≤1,2MiB. Nếu không đạt mà vẫn cần chất lượng chữ/screenshot, báo số đo và phương án trước khi chốt, không làm mờ chữ để ép số.
- Ảnh dưới fold phải lazy; không inline base64 vào JS/CSS, không thêm dependency hay font tải mới.

### Task 7 — Verification và review cuối

- Focused Vitest: PublicHomeLandingPage, PublicHomeAssets, PublicHomeHashNavigation, AppShell, LegalPageBack, routeGuards, LoginLandingState/Presentation, LoginFormPasskey, loginSessionRecovery.integration, useSessionBootstrap, BrandSeo, FaviconSeo, SchoolLogo, PublicSchoolPages, PublicLegalPages, ScrollReset, ParentPortalApp/Seo và production smoke runner/workflow/policy tests.
- Cypress focused: public-home-landing, login-home, mobile-responsive, route-scroll; sau đó toàn cypress:run:stubbed đã thêm spec mới. Lưu số ca/exit thực tế, không dự đoán số ca cố định.
- npm run lint; npm run typecheck; npm run typecheck:strict; npm run typecheck:workers; npm run verify; npm run perf:budget; security checks và enforced production audits.
- Build kiểm dist/index.html, asset/font requests, lazy chunk, metadata/favicons; HTML root app vẫn đúng, sau hydrate có landing.
- Review thực tế root + independent reviewer, không còn P1/P2, git diff --check, không .only/.skip, asset/content manifest và hash cuối; detect_changes đúng scope.
- Nếu local verify gặp hai audit fixture runner-context cũ, giữ exit/log gốc và kiểm tra source có đổi không; chạy bổ sung có ghi rõ. Không gọi lượt lỗi là PASS, không suppress/retry/ignore exception để ép xanh. CI/hosted full verify phải đạt trước merge.
- Planning-only hiện tại: TDD/build/browser regression N/A vì chưa sửa executable code. Khi implementation thực hiện đầy đủ RED→GREEN cho hành vi homepage mới.

### Task 8 — Duyệt cuối, commit, PR và CI

- Trình exact file list, ảnh đã chọn, content đã chốt, hash, tests, risk/limitations; chờ user duyệt commit/push/PR theo AGENTS.md mục6.
- Stage chỉ file task, staged GitNexus; commit tập trung, push feature branch, PR vào main.
- Chờ CI/Security/Vercel Preview và code-owner review đúng HEAD; giữ nguyên branch protection, không admin bypass.
- Re-check HEAD/checks/review threads/mergeability ngay trước guarded merge.

### Task 9 — Production và cleanup

- Frontend deploy sau merge; xác minh deployment environment/full SHA, root landing, asset HTTP200/MIME/cache và favicon/canonical.
- Public smoke và read-only authenticated smoke theo workflow hiện tại; kiểm cả main/apex và parent host. Không tạo bài/nộp bài hoặc dùng tài khoản thật để write production.
- Release readiness đủ năm gate, gồm public-home spec thực sự chạy trong stubbed job (đối chiếu log, không chỉ tin script string).
- Revert PR hoặc rollback frontend deployment qua flow được duyệt nếu bản mới có regression; không cần D1 rollback vì không migration.
- Sau gate đạt: dọn riêng merged worktree/index/local-remotebranch, bảo vệ commit mới của người khác; main fast-forward N/A khi còn dirty, giữ nguyên user changes.
- Báo SHA, trạng thái và bằng chứng, không tuyên bố hoàn tất khi còn gate chưa đạt.

### Task 10 — Nhắc MỤC 4 sau landing

Theo yêu cầu mới nhất của user, gọi bước tiếp theo là **Mục 4: tách pure readiness/suggestion model** trong `workers/src/services/interventionService.ts`.

Chỉ khi landing đã merge, production verified và cleanup xong, phải nhắc trong final và báo cáo bàn giao: lập plan riêng cho mục4. Ranh giới ban đầu của mục4 là pure readiness helpers, trend/evidence và recommendation ranking; D1 queries, authorization, group/note persistence, assignment idempotency và Worker contract được giữ ngoài gói đầu. Mục4 cần baseline/impact/test/approval riêng; không triển khai backend trong đợt landing này. Đây là nhắc tại milestone trong task, không tạo automation định kỳ.

## 8. Definition of done

- [x] Guest `/` là landing theo mẫu, CTA không vòng lặp.
- [x] Login/student/teacher/returnTo/quiz/parent/legal/scroll contracts đạt.
- [x] Content số liệu/lịch thi không có khẳng định chưa xác minh; logo/SEO v2 đúng.
- [x] Asset riêng, responsive/a11y/keyboard/performance đạt, không đổi budget.
- [ ] Review không còn P1/P2; final scope được duyệt, CI + owner review đúng HEAD.
- [ ] Merge, frontend SHA/assets/read-only production smoke và năm readiness gate đạt.
- [ ] Cleanup đúng task, giữ dirty main, báo SHA cuối.
- [ ] Đã nhắc user lập plan riêng cho **Mục 4 — pure readiness/suggestion model**.

Trạng thái lúc soạn plan: chưa sửa runtime code, chưa stage/commit/push/PR/deploy. User sau đó đã duyệt implementation; tiến độ thực tế ghi ở cuối tài liệu. Approval commit và review GitHub vẫn là các gate riêng.

## 9. Review plan trước khi trình duyệt

- Architect-review và review độc lập đã thực hiện trên source/plan thực tế.
- Review đầu phát hiện P2 về direct hash trước khi lazy landing mount; đã bổ sung hook local, phân biệt POP/fresh/PUSH, cleanup, user-input cancellation và browser assertions.
- Root bổ sung MainApp scroll view-key cho CTA login đổi query cùng pathname. Pre-impact MainApp LOW/1callerApp/0flow; không mở rộng auth hoặc global scroll hook.
- Re-review: không còn P1/P2 trong plan. Đây chưa phải kết quả test/runtime implementation.
- Chỉ một file plan untracked trong planning worktree; không sửa runtime, không stage/commit/push/deploy. Hash file HTML gốc vẫn khớp.

## Tiến độ implementation

- User đã duyệt thực hiện plan. Worktree feat-public-home-landing từ đúng09cde04, không ghi đè dirtymain.
- Baseline browser dùng bằng chứng Release readiness46119182669 trên cùng fullSHA/lockfile: stubbed78/78, Blueprint4/4, SVG2/2PASS. Không chạy lặp baseline browser khi chưa đổi executablecode; localfocused/fullbrowser sẽ chạy trên source mới. Focused unit baseline vẫn chạy trướcRED.
- Dependency root/Worker đã cài theo lockfile, không junction. Baseline focused: 16 suite/102 test PASS. RED AppShell trên production chưa sửa: 4 failed/9 passed, đúng hành vi guest homepage cũ.
- Asset đã hoàn thành: 12 file, 708.309 byte; HTML nguồn giữ nguyên hash. Component/assets 11 test PASS. Hai lỗi integration qua RED→GREEN: persisted quiz không được lấn presentation key của explicit login; local hash không được tranh với live SPA POP restore. AppShell/hash/legal tổng 36 test PASS ở lượt kiểm tra này.
- Lần combined đầu: 4 suite/31 test PASS, suite component chưa chạy vì import trong lúc file UI đang được ghi lại; giữ log lỗi, sẽ chạy lại sau khi worker freeze. Đây không phải lượt verification cuối.
- Lint, typecheck, strict typecheck, Worker typecheck và security checks đã PASS. Audit production root/Worker đều 0. Build đầu PASS; performance PASS với initial JS 169.481/204.800 byte gzip, tổng CSS 51.165/51.200 byte gzip; không tăng budget hoặc waiver.
- Browser focused đầu bị ngắt trước khi kết thúc toàn bộ lượt chạy, nên không có exit tổng. Landing đạt 10/16 test; sáu failure gồm assertion ảnh đổi DOM subject thành attribute string, anchor thiếu khoảng đệm và POP hash cần điều tra. Login đạt 6/6. Giữ nguyên log/screenshot, không gọi lượt này là PASS.
- CSS đã sửa khoảng đệm anchor 88px desktop/84px mobile, format dễ đọc, ảnh height:auto/contain, footer brand contrast và icon-list alignment. CTA login nội bộ đã dùng React Router Link.
- Trường hợp StrictMode đã tái hiện lỗi POP bằng test: 18 test, 14 PASS/4 FAIL; fresh direct hash dưới StrictMode vẫn PASS. Đang sửa hook local sau fresh GitNexus impact LOW/1 caller/0 flow; giữ nguyên global useScrollReset.
- Đã sửa StrictMode replay và thêm regression mounted hash PUSH→POP: RED 1/19, rồi GREEN. Focused cuối 19 suite/135 test PASS. Browser focused hoàn chỉnh 4 spec/41 test PASS; các bản chạy lỗi trước vẫn giữ nguyên log, không tính là PASS.
- Full browser đầu: 14 spec/95 test, 93 PASS/2 FAIL; hai failure là test thông báo cũ còn mặc định `/` là login. Cập nhật một URL fixture theo contract mới, giữ mọi assertion. Chờ lượt full browser cuối và verification cuối trước gate commit.
- Test thông báo còn phát hiện assertion dùng chiều cao config 720px trong case viewport 900px; đã sửa phép đo AUT, giữ cả kiểm tra chiều cao khớp case và giới hạn form. Focused thông báo cuối 4/4 PASS; landing 17/17 PASS sau các chỉnh màu cuối.
- Canonical `npm run verify`: lint và ba typecheck PASS; shard1 182 suite/1.075 test PASS, shard2 182 suite/1.034 test PASS; shard3 180 suite/1.121 test PASS và đúng hai fixture audit Windows FAIL. Hai file audit không có diff so với main; cùng suite chạy Node trực tiếp 28/28 PASS. Giữ nguyên exit1 của canonical verify; đang hoàn tất shard4, coverage, build/security/performance riêng. CI/hosted verify vẫn bắt buộc xanh trước merge.
- Viewport 320px thêm vào bảng test toàn bộ trang cũ phát hiện overflow ở /contact (320px scrollWidth so với 305px clientWidth). Ghi nhận ngoài phạm vi; giữ nguyên các viewport cũ, kiểm tra landing 320px trong spec mới. Không sửa trang Liên hệ trong gói này.

- Verification bổ sung cuối: shard4 181 suite/1.108 test PASS; coverage schema 7 suite đạt threshold (statements 88,32%, branches 62,12%, functions 94,73%, lines 89,38%). Build/security/performance PASS; production audit root + Worker 0 lỗ hổng. Initial JS 169.474/204.800 byte gzip, CSS 51.132/51.200 byte gzip. Canonical verify vẫn giữ exit1 cho hai fixture Windows nêu trên.
- Final GitNexus: toàn bộ 40 file qua alternate index riêng, 28 text file/127 symbol, 0 process, LOW; 12 binary asset kiểm tra bằng manifest. Index Git thật không thay đổi, 0 file staged. Review root và reviewer độc lập không còn P1/P2. Đang chờ full browser cuối trước duyệt commit.

- Full browser cuối trên source đã freeze, cấu hình Cypress nguyên bản và feature flags CI đã xác minh: 14 spec/95 test PASS, exit0 (cypress-full-final.log). Không còn browser failure. Gate hiện tại: chờ user duyệt commit → push → PR đúng 40 file; chưa stage/commit/push.
