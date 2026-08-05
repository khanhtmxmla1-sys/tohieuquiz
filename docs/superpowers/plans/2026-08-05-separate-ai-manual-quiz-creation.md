# Tách Tạo đề bằng AI và Soạn đề thủ công — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Thực hiện TDD: viết test thất bại trước, chạy xác nhận RED, triển khai tối thiểu, chạy GREEN, rồi mới refactor.

**Goal:** Cho giáo viên nhìn thấy và truy cập rõ ràng hai phương thức **Tạo đề bằng AI** và **Soạn đề thủ công** từ sidebar, trang Tổng quan, tìm kiếm chức năng và khu vực đề gần đây, trong khi giữ nguyên route, dữ liệu và luồng lưu hiện có.

**Architecture:** Giữ nguyên AI ở `/teacher/quizzes?mode=create`, giữ trình soạn thủ công ở `/teacher/quizzes/new`, và giữ edit route `/teacher/quizzes/:quizId/edit`. Không thay đổi `getTeacherRoute`, `AppRoutes`, Worker, API hoặc D1. Tính năng tách hai điểm vào chỉ được hiển thị khi feature flag workspace thủ công hiện có đang bật; khi flag này tắt, giao diện legacy một nút và trình soạn inline cũ vẫn được giữ để rollback tương thích.

**Tech Stack:** React 19, TypeScript, React Router, Zustand, Tailwind CSS, Vitest, Testing Library, Cypress.

## Vì sao kế hoạch đã được thu gọn

- `/teacher/quizzes?mode=create` đã là một URL riêng cho AI và đang được dùng trong route tests, dashboard tests, ba Cypress suites và CTA từ Worker Action Center.
- GitNexus đánh giá thay đổi `getTeacherRoute` là **HIGH risk**: 13 symbols bị ảnh hưởng, 7 direct consumers và 3 modules.
- `BottomNavigation.tsx` hiện không được render; đưa nó trở lại sẽ thay đổi toàn bộ kiến trúc điều hướng mobile, vượt quá yêu cầu tách hai nút.
- `VITE_*` là build-time flag; thay đổi giá trị vẫn cần build/deploy lại. Không thêm flag mới chỉ để điều khiển một thay đổi UI nhỏ.
- Việc chuyển đề AI sang workspace chung thay đổi publish, assignment, autosave và draft recovery; đây là một feature độc lập và không thuộc kế hoạch hiện tại.

## Global Constraints

- Giữ nguyên `getTeacherRoute('create') === '/teacher/quizzes?mode=create'`.
- Giữ nguyên `/teacher/quizzes/new` và `/teacher/quizzes/:quizId/edit`.
- Không sửa `src/app/AppRoutes.tsx` và `src/app/navigationRoutes.ts` trong feature này.
- Không sửa Worker, API contract, D1 schema hoặc migration.
- Không thêm runtime/build-time feature flag mới.
- Dùng `isManualQuizWorkspaceEnabled()` hiện có làm điều kiện tương thích.
- Bổ sung `VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1=true` vào `.env.example` chỉ để tài liệu hóa flag hiện có; đây vẫn là build-time flag và thay đổi giá trị cần build/deploy lại.
- Trước khi sửa code, ghi lại `git status --short` và bảo toàn toàn bộ thay đổi có sẵn của người dùng. Không sửa, xóa, stage hoặc format lan sang các file ngoài danh sách của từng task. Trạng thái hiện tại có thay đổi không liên quan tại `AGENTS.md`, `CLAUDE.md`, `.gemini/` và file logo; phải giữ nguyên.
- Khi workspace thủ công bật: hiển thị hai điểm vào riêng và ẩn entry thủ công bên trong trang AI.
- Khi workspace thủ công tắt: giữ UI legacy hiện tại, gồm một CTA tạo đề và fallback thủ công inline trong `CreateTab`.
- Không đưa `BottomNavigation.tsx` trở lại trong phạm vi này.
- Không thêm telemetry mới trong phạm vi này.
- Không thay đổi cơ chế tạo, lưu, giao bài hoặc xuất bản đề AI.
- Không thay đổi cơ chế autosave/publish của workspace thủ công.
- Trước khi sửa mỗi symbol, chạy GitNexus impact theo yêu cầu `AGENTS.md`.
- Không commit, push hoặc deploy nếu chưa có lệnh riêng của người dùng.

## Navigation Contract

```text
Tạo đề bằng AI       -> /teacher/quizzes?mode=create
Soạn đề thủ công     -> /teacher/quizzes/new
Chỉnh sửa đề hiện có -> /teacher/quizzes/:quizId/edit
```

## UX Contract

### Sidebar desktop và mobile drawer

Khi workspace thủ công bật:

1. CTA chính `Tạo đề bằng AI`.
2. CTA phụ `Soạn đề thủ công`.
3. Cả hai đóng mobile drawer sau khi chọn.

Khi workspace thủ công tắt:

1. Giữ CTA legacy `Tạo đề mới`.
2. Không hiển thị CTA dẫn tới route workspace đang bị tắt.

### Trang Tổng quan

Tạo một khu vực riêng gồm hai thẻ:

- `Tạo đề bằng AI` — `Tạo nhanh từ chủ đề, nội dung hoặc PDF.`
- `Soạn đề thủ công` — `Tự nhập, sắp xếp và kiểm soát từng câu hỏi.`

Không nhét thêm hai thẻ vào `QuickActionGrid`, vì grid hiện có sẽ thành 7 mục và tạo layout lệch. `QuickActionGrid` tiếp tục phục vụ các tác vụ dashboard còn lại.

### Mobile

Không thêm bottom navigation mới. Hai lựa chọn có sẵn tại:

- mobile sidebar drawer;
- khu vực hai thẻ responsive trên Tổng quan;
- khu vực Đề kiểm tra gần đây.

---

### Task 1: Khóa hành vi route hiện tại bằng regression tests

**Files:**
- Modify: `tests/routeGuards.test.tsx`
- Modify: `tests/ManualQuizWorkspaceRoute.test.tsx`
- Modify: `tests/TeacherDashboardShell.test.tsx`

**Interfaces:**
- Preserves: `getTeacherRoute('create')` trả `/teacher/quizzes?mode=create`.
- Preserves: `getQuizEditorRoute()` trả `/teacher/quizzes/new`.
- Preserves: `getQuizEditorRoute(quizId)` trả edit route canonical.

- [ ] **Step 1: Bổ sung regression assertion cho route contract**

```ts
expect(getTeacherRoute('create')).toBe('/teacher/quizzes?mode=create');
expect(getQuizEditorRoute()).toBe('/teacher/quizzes/new');
expect(getQuizEditorRoute('quiz 123')).toBe('/teacher/quizzes/quiz%20123/edit');
```

- [ ] **Step 2: Giữ các test protected route hiện có**

Kiểm tra `/teacher/quizzes/new` và edit route vẫn yêu cầu teacher session và vẫn giữ `returnTo`.

- [ ] **Step 3: Thêm test dashboard không điều hướng sang URL AI mới**

```ts
expect(navigate).toHaveBeenCalledWith('/teacher/quizzes?mode=create');
expect(navigate).not.toHaveBeenCalledWith('/teacher/quizzes/ai/new');
```

- [ ] **Step 4: Chạy regression baseline**

```bash
npm run test:ci -- tests/routeGuards.test.tsx tests/ManualQuizWorkspaceRoute.test.tsx tests/TeacherDashboardShell.test.tsx
```

Expected: PASS trước khi triển khai UI. Nếu fail, dừng vì baseline đang không sạch.

### Task 2: Tạo component hai lựa chọn dùng chung

**Files:**
- Create: `src/components/TeacherDashboard/quiz-creation/QuizCreationActions.tsx`
- Create: `src/components/TeacherDashboard/quiz-creation/index.ts`
- Create: `tests/QuizCreationActions.test.tsx`

**Interfaces:**

```ts
export interface QuizCreationActionsProps {
  layout: 'sidebar' | 'cards' | 'compact';
  onCreateWithAi(): void;
  onCreateManually(): void;
}
```

- [ ] **Step 1: Viết test RED cho nội dung và callback**

```ts
expect(screen.getByRole('button', { name: 'Tạo đề bằng AI' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Soạn đề thủ công' })).toBeInTheDocument();
```

Mỗi button đặt `aria-label` chính xác theo tên hành động để mô tả phụ không làm accessible name bị nối dài. Bấm mỗi nút phải gọi đúng một callback, không gọi callback còn lại.

- [ ] **Step 2: Viết test RED cho ba layout**

- `sidebar`: hai nút xếp dọc, CTA AI là primary.
- `cards`: hai card cùng chiều cao, mô tả đầy đủ.
- `compact`: hai nút có thể wrap trên màn hình nhỏ.

- [ ] **Step 3: Chạy RED**

```bash
npm run test:ci -- tests/QuizCreationActions.test.tsx
```

Expected: FAIL vì component chưa tồn tại.

- [ ] **Step 4: Triển khai component thuần hiển thị**

Copy chính xác:

```text
Tạo đề bằng AI
Tạo nhanh từ chủ đề, nội dung hoặc PDF.

Soạn đề thủ công
Tự nhập, sắp xếp và kiểm soát từng câu hỏi.
```

Dùng icon thao tác từ `lucide-react`; không thêm dependency mới.

- [ ] **Step 5: Chạy GREEN**

```bash
npm run test:ci -- tests/QuizCreationActions.test.tsx
```

### Task 3: Tạo orchestration điều hướng tại TeacherDashboard

**Files:**
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboard.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/types.ts`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardTabContent.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardCoreTabs.tsx`
- Modify: `.env.example`
- Modify: `tests/TeacherDashboardShell.test.tsx`

**Interfaces:**

```ts
manualQuizWorkspaceEnabled: boolean;
onCreateQuizWithAi(): void;
onCreateQuizManually(): void;
```

- [ ] **Step 1: Chạy GitNexus impact**

Chạy impact upstream cho:

- `TeacherDashboard`
- `TeacherDashboardLayout`
- `TeacherDashboardCoreTabs`

Nếu có HIGH/CRITICAL ngoài teacher dashboard shell, dừng và báo.

- [ ] **Step 2: Viết test RED cho hai callbacks**

Cập nhật mocks trong `TeacherDashboardShell.test.tsx` để Sidebar và Overview mock thực sự render các callback AI/manual mới. Trong `beforeEach/afterEach`, reset `useManualQuizWorkspaceStore` và gọi `vi.unstubAllEnvs()` để test flag không rò rỉ sang case khác.

AI:

```ts
fireEvent.click(screen.getByRole('button', { name: 'Tạo đề bằng AI' }));
expect(navigate).toHaveBeenCalledWith('/teacher/quizzes?mode=create');
```

Thủ công:

```ts
fireEvent.click(screen.getByRole('button', { name: 'Soạn đề thủ công' }));
expect(navigate).toHaveBeenCalledWith('/teacher/quizzes/new', expect.objectContaining({
  state: expect.objectContaining({
    workspaceStartedAt: expect.any(String),
    manualQuizSeed: expect.objectContaining({ classLevel: '4A' }),
  }),
}));
```

Test với giáo viên `teacherClass='4A'` để tránh regression mở trang thủ công nhưng mặc định nhầm Lớp 3. Thêm case admin/không có lớp dùng fallback `classLevel='3'`.

- [ ] **Step 3: Viết test stale workspace được reset trước khi mở đề mới**

Chuẩn bị store có envelope cũ, bấm `Soạn đề thủ công`, sau đó:

```ts
expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();
```

Reset store không xóa local/remote draft; draft cũ vẫn có thể tiếp tục từ Action Center.

- [ ] **Step 4: Triển khai callbacks tại `TeacherDashboard`**

```ts
const manualQuizWorkspaceEnabled = isManualQuizWorkspaceEnabled();

const openAiQuizCreator = useCallback(() => {
  selectTab('create');
}, [selectTab]);

const openManualQuizCreator = useCallback(() => {
  const manualQuizSeed = buildManualQuizSeed({
    quizTitle: 'Đề kiểm tra mới',
    classLevel: authStore.teacherClass?.trim() || '3',
    category: 'toan',
    manualTimeLimit: 15,
    tags: [],
    requireCode: false,
    accessCode: '',
    showOnHome: true,
  });
  useManualQuizWorkspaceStore.getState().reset();
  navigate(getQuizEditorRoute(), {
    state: {
      manualQuizSeed,
      workspaceStartedAt: new Date().toISOString(),
    },
  });
}, [authStore.teacherClass, navigate]);
```

Tái sử dụng `selectTab('create')` cho AI thay vì lặp lại `setEditingQuiz + navigate`. Thêm imports canonical `getQuizEditorRoute`, `buildManualQuizSeed` và `useManualQuizWorkspaceStore` cho nhánh thủ công. Không gọi manual callback khi `manualQuizWorkspaceEnabled === false`.

- [ ] **Step 5: Truyền callbacks xuống layout và overview**

Giữ tất cả quyết định điều hướng ở `TeacherDashboard`; component con chỉ phát sự kiện.

- [ ] **Step 6: Tài liệu hóa flag workspace hiện có**

Thêm vào `.env.example`:

```dotenv
# Full-screen manual quiz workspace. Build-time flag; changing it requires a rebuild/redeploy.
VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1=true
```

Không thay đổi fallback `true` trong `featureFlags.ts`.

- [ ] **Step 7: Chạy GREEN**

```bash
npm run test:ci -- tests/TeacherDashboardShell.test.tsx tests/ManualQuizWorkspaceRoute.test.tsx
```

### Task 4: Tách hai CTA ở Sidebar

**Files:**
- Modify: `src/components/TeacherDashboard/Sidebar.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`
- Modify: `tests/TeacherSidebarAccessibility.test.tsx`

**Interfaces:**

```ts
manualQuizWorkspaceEnabled: boolean;
onCreateQuizWithAi(): void;
onCreateQuizManually(): void;
```

- [ ] **Step 1: Chạy GitNexus impact cho `Sidebar`**.

- [ ] **Step 2: Viết test RED khi workspace bật**

Kiểm tra:

- có `Tạo đề bằng AI`;
- có `Soạn đề thủ công`;
- không còn CTA chung `Tạo đề mới`;
- bấm action đóng drawer bằng `setIsMobileOpen(false)`;
- focus ring và `type="button"` tồn tại.

- [ ] **Step 3: Viết test RED khi workspace tắt**

```ts
expect(screen.getByRole('button', { name: 'Tạo đề mới' })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
```

CTA legacy gọi `setActiveTab('create')` như hiện tại.

- [ ] **Step 4: Thay block CTA đầu sidebar**

- Flag bật: render `QuizCreationActions layout="sidebar"`.
- Flag tắt: giữ nguyên nút legacy.
- Sidebar dùng wrapper handler để gọi `setIsMobileOpen(false)` trước, sau đó mới gọi callback điều hướng tương ứng.

Không thêm hai action vào accordion `Đề thi`; chúng là primary creation actions phía trên.

- [ ] **Step 5: Chạy GREEN**

```bash
npm run test:ci -- tests/TeacherSidebarAccessibility.test.tsx
```

### Task 5: Tạo khu vực hai lựa chọn trên Tổng quan

**Files:**
- Create: `src/components/TeacherDashboard/overview/QuizCreationChoicePanel.tsx`
- Modify: `src/components/TeacherDashboard/overview/index.ts`
- Modify: `src/components/TeacherDashboard/OverviewTab.tsx`
- Modify: `src/components/TeacherDashboard/overview/RecentQuizzesPanel.tsx`
- Modify: `tests/TeacherOverview.test.tsx`
- Modify: `tests/teacherOverviewA11y.test.tsx`
- Modify: `tests/teacherOverviewAxe.test.tsx`
- Create: `tests/QuizCreationChoicePanel.test.tsx`

**Interfaces:**

```ts
interface QuizCreationChoicePanelProps {
  onCreateWithAi(): void;
  onCreateManually(): void;
}
```

`OverviewTabProps` thêm:

```ts
manualQuizWorkspaceEnabled: boolean;
onCreateQuizWithAi(): void;
onCreateQuizManually(): void;
```

- [ ] **Step 1: Chạy GitNexus impact cho `OverviewTab` và `RecentQuizzesPanel`**.

- [ ] **Step 2: Viết component test RED**

Kiểm tra heading `Tạo đề kiểm tra`, hai card, mô tả, callback và responsive classes. `QuizCreationChoicePanel` chỉ là semantic wrapper (`Card`/`section` + heading) và phải render lại `QuizCreationActions layout="cards"`; không sao chép markup hai button.

- [ ] **Step 3: Viết Overview test RED khi workspace bật**

```ts
expect(screen.getByRole('button', { name: /Tạo đề bằng AI/i })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /Soạn đề thủ công/i })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Tạo đề mới/i })).not.toBeInTheDocument();
```

- [ ] **Step 4: Giữ `QuickActionGrid` đơn giản**

Xóa action `create` khỏi `quickActions`; không đổi interface `DashboardQuickAction` và không nhúng callback vào config. Cập nhật test hiện tại đang kỳ vọng action `create` có gradient primary; khi split bật, grid còn 5 tác vụ thường và không có primary card. Layout 3+2 ở desktop là chấp nhận được, không thêm abstraction cột động chỉ để cân hàng.

Các action còn lại vẫn dùng `onSelectTab`:

- Giao bài
- Thi trực tiếp
- Xem kết quả
- Quản lý lớp
- Cấp chứng nhận

- [ ] **Step 5: Render `QuizCreationChoicePanel` trước `QuickActionGrid`**

Khi workspace tắt, giữ action `Tạo đề mới` trong `QuickActionGrid` và không render panel mới.

- [ ] **Step 6: Cập nhật `RecentQuizzesPanel`**

Đổi interface thành:

```ts
manualQuizWorkspaceEnabled: boolean;
onCreateQuizWithAi(): void;
onCreateQuizManually(): void;
onManageQuizzes(): void;
```

Khi workspace bật:

- header render `QuizCreationActions layout="compact"` với hai action;
- empty state tái sử dụng cùng component, không sao chép button;
- dùng `flex-wrap`, không mở modal/bottom sheet.

Khi workspace tắt: giữ một CTA `Tạo đề`/`Tạo đề mới` legacy và gọi `onCreateQuizWithAi` (canonical create tab hiện tại).

- [ ] **Step 7: Cập nhật design-system/a11y coverage**

Thêm `QuizCreationChoicePanel.tsx` và `quiz-creation/QuizCreationActions.tsx` vào danh sách source được kiểm tra trong `teacherOverviewA11y.test.tsx`; hai file mới không được thêm raw hex color. Cập nhật `teacherOverviewAxe.test.tsx` với đầy đủ props mới cho `OverviewTab`.

- [ ] **Step 8: Chạy GREEN và axe**

```bash
npm run test:ci -- tests/QuizCreationChoicePanel.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewA11y.test.tsx tests/teacherOverviewAxe.test.tsx
```

### Task 6: Đồng bộ header và dashboard search

**Files:**
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/dashboardConfig.ts`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/useDashboardSearch.ts`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/DashboardSearchForm.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardLayout.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/types.ts`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboard.tsx`
- Modify: `tests/TeacherDashboardShell.test.tsx`
- Create: `tests/useDashboardSearch.test.tsx`

**Interfaces:**

```ts
type DashboardSearchDestination =
  | { id: string; kind: 'tab'; tab: TeacherDashboardTab; label: string; keywords: string }
  | { id: 'manual-quiz'; kind: 'manual-quiz'; label: string; keywords: string };
```

Mọi item có `id` ổn định vì `DashboardSearchForm` không thể tiếp tục dùng `item.tab` làm React key sau khi thêm destination thủ công.

`useDashboardSearch` nhận:

```ts
{
  onSelectTab(tab: TeacherDashboardTab): void;
  onCreateQuizManually(): void;
  manualQuizWorkspaceEnabled: boolean;
}
```

- [ ] **Step 1: Viết search tests RED**

- `tạo đề ai`, `pdf`, `trí tuệ nhân tạo` -> tab create.
- `soạn thủ công`, `nhập từng câu` -> manual callback khi workspace bật.
- Thêm case không dấu: `soan thu cong` -> manual callback.
- Manual query không được trả route workspace khi flag tắt và manual option không xuất hiện trong datalist.
- Query không hợp lệ vẫn báo `Không tìm thấy chức năng phù hợp.`.

Không dùng phép `.includes(normalizedQuery)` trên toàn chuỗi như hiện tại vì `tạo đề ai` không khớp `Tạo đề bằng AI`, và token `ai` có thể khớp nhầm bên trong `bài`. Tạo helper thuần để:

1. lowercase;
2. bỏ dấu Unicode và đổi `đ` thành `d`;
3. tách thành token;
4. yêu cầu mọi query token khớp **một token hoàn chỉnh** trong label/keywords.

- [ ] **Step 2: Đổi header label theo flag**

Không đổi `TAB_LABELS.create` thành AI vô điều kiện. `TeacherDashboardHeader` nhận `manualQuizWorkspaceEnabled` và resolve:

```ts
const activeLabel = props.activeTab === 'create'
  ? (props.manualQuizWorkspaceEnabled ? 'Tạo đề bằng AI' : 'Tạo đề mới')
  : TAB_LABELS[props.activeTab] || 'Tổng quan';
```

Như vậy rollback flag `false` vẫn phản ánh đúng trang kết hợp legacy.

- [ ] **Step 3: Đổi search config**

AI item:

```ts
{
  id: 'create',
  kind: 'tab',
  tab: 'create',
  label: 'Tạo đề bằng AI',
  keywords: 'tạo đề mới ai trí tuệ nhân tạo chủ đề nội dung pdf',
}
```

Manual item:

```ts
{
  id: 'manual-quiz',
  kind: 'manual-quiz',
  label: 'Soạn đề thủ công',
  keywords: 'tạo đề thủ công nhập từng câu trình soạn đề',
}
```

- [ ] **Step 4: Điều phối destination trong hook và datalist**

Không dùng raw URL trong search config. Manual destination gọi callback canonical từ `TeacherDashboard`.

`useDashboardSearch` phải trả thêm danh sách option đã lọc theo flag. Truyền danh sách này qua `TeacherDashboardLayout` -> `TeacherDashboardHeader` -> `DashboardSearchForm`. Form chỉ render `<option key={item.id} value={item.label} />`; không tự import danh sách tĩnh, để hook tìm kiếm và datalist luôn có cùng availability.

- [ ] **Step 5: Bổ sung test header rollback**

- flag bật + active tab create -> `Tạo đề bằng AI`;
- flag tắt + active tab create -> `Tạo đề mới`.

- [ ] **Step 6: Chạy GREEN**

```bash
npm run test:ci -- tests/useDashboardSearch.test.tsx tests/TeacherDashboardShell.test.tsx
```

### Task 7: Làm sạch entry thủ công bên trong trang AI nhưng giữ fallback legacy

**Files:**
- Modify: `src/components/TeacherDashboard/CreateTab.tsx`
- Modify: `src/components/TeacherDashboard/quiz-preview/EmptyQuizPreview.tsx`
- Modify: `tests/CreateTab.manualNavigation.test.tsx`
- Create: `tests/CreateTab.aiOnly.test.tsx`

**Behavior:**

- Workspace flag bật: trang AI không hiển thị nút `Mở phòng soạn đề thủ công`; tiêu đề nội bộ của `CreateTab` đổi thành `Tạo đề bằng AI`.
- Workspace flag tắt: giữ tiêu đề `Tạo đề kiểm tra mới` và fallback inline hiện có để không mất khả năng soạn thủ công khi workspace bị rollback.

- [ ] **Step 1: Chạy GitNexus impact cho `CreateTab` và `EmptyQuizPreview`**.

- [ ] **Step 2: Viết AI-only test RED**

```ts
expect(screen.getByRole('heading', { name: 'Tạo đề bằng AI' })).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Mở phòng soạn/i })).not.toBeInTheDocument();
expect(screen.getByText(/Hoàn thành cấu hình bên trái/i)).toBeInTheDocument();
```

Legacy test flag `false` phải tiếp tục thấy heading `Tạo đề kiểm tra mới`.

- [ ] **Step 3: Cập nhật legacy test**

Khi `VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1=false`, nút legacy vẫn xuất hiện và gọi `logic.setGeneratedQuiz(...)` với đề rỗng như hiện tại.

Không còn test mặc định điều hướng từ `CreateTab` sang `/teacher/quizzes/new`; điều hướng thủ công mới được test tại TeacherDashboard/Sidebar/Overview.

- [ ] **Step 4: Tách handler legacy**

Giữ `buildManualQuizSeed` chỉ cho fallback inline:

```ts
const startLegacyInlineManualQuiz = () => {
  const seed = buildManualQuizSeed(...);
  logic.setGeneratedQuiz(/* empty legacy quiz */);
};
```

Truyền:

```tsx
onStartManual={manualQuizWorkspaceEnabled ? undefined : startLegacyInlineManualQuiz}
```

Button legacy trong `EmptyQuizPreview` phải có `type="button"`.

- [ ] **Step 5: Đổi copy của `EmptyQuizPreview` theo callback**

Không callback:

```text
Chưa có đề xem trước
Hoàn thành cấu hình bên trái và chọn chế độ tạo đề để AI sinh bản nháp.
```

Có callback legacy:

```text
Bạn có thể tạo bằng AI hoặc mở trình soạn thủ công dạng cũ.
```

- [ ] **Step 6: Chạy GREEN**

```bash
npm run test:ci -- tests/CreateTab.aiOnly.test.tsx tests/CreateTab.manualNavigation.test.tsx tests/useCreateQuizLogic.contract.test.tsx
```

### Task 8: Cypress và verification hoàn tất

**Files:**
- Create: `cypress/e2e/quiz-creation-entry-points.cy.ts`
- Verify: `cypress/e2e/manual-quiz-workspace.cy.ts`
- Verify: `cypress/e2e/ai-quiz-generation-v2.cy.ts`
- Verify all files above.

- [ ] **Step 1: Cypress entry-point cases**

1. Sidebar `Tạo đề bằng AI` mở `/teacher/quizzes?mode=create`.
2. Sidebar `Soạn đề thủ công` mở `/teacher/quizzes/new`.
3. Overview hai card mở đúng destination.
4. Mobile drawer hiển thị hai CTA và đóng sau khi chọn.
5. Recent quizzes có hai CTA khi workspace bật.
6. Trang AI không còn entry thủ công khi workspace bật.
7. Browser Back từ workspace trở về dashboard đúng vị trí lịch sử.

`cypress.config.ts` dùng `baseUrl=http://localhost:3001` và không tự khởi động web server. Trước khi chạy, khởi động Vite riêng tại port 3001 với workspace flag bật. `allowCypressEnv: false` và `VITE_*` là build-time, vì vậy không cố đổi flag ngay trong spec.

Nhánh workspace flag `false` được khóa bằng Vitest. Chỉ chạy E2E rollback nếu chủ động khởi động một server/build thứ hai với `VITE_FEATURE_MANUAL_QUIZ_WORKSPACE_V1=false`; không coi đây là case trong cùng Cypress run.

Run:

```bash
npx cypress run --e2e --spec "cypress/e2e/quiz-creation-entry-points.cy.ts,cypress/e2e/manual-quiz-workspace.cy.ts,cypress/e2e/ai-quiz-generation-v2.cy.ts"
```

- [ ] **Step 2: Focused Vitest**

Dùng một dòng vì môi trường triển khai hiện tại là Windows `cmd`; dấu `\` nối dòng kiểu Bash sẽ không chạy đúng:

```bash
npm run test:ci -- tests/routeGuards.test.tsx tests/ManualQuizWorkspaceRoute.test.tsx tests/TeacherDashboardShell.test.tsx tests/TeacherSidebarAccessibility.test.tsx tests/QuizCreationActions.test.tsx tests/QuizCreationChoicePanel.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewA11y.test.tsx tests/teacherOverviewAxe.test.tsx tests/useDashboardSearch.test.tsx tests/CreateTab.aiOnly.test.tsx tests/CreateTab.manualNavigation.test.tsx
```

- [ ] **Step 3: Full frontend gates**

```bash
npm run lint
npm run typecheck
npm run typecheck:strict
npm run test:ci:all
npm run build
npm run perf:budget
```

Không bắt buộc `typecheck:workers` cho feature này vì Worker không thay đổi; vẫn chạy trong release readiness trước deploy production.

- [ ] **Step 4: Browser accessibility checks**

Viewport:

- 375×812
- 768×1024
- 1366×768
- 1920×1080

Kiểm tra:

- sidebar không overflow;
- CTA đủ 44px;
- focus order hợp lý;
- text không bị cắt;
- card hai lựa chọn không thành một cột quá hẹp;
- mobile drawer đóng bằng Escape và backdrop như hiện tại;
- không có horizontal scroll mới.

- [ ] **Step 5: GitNexus final review**

```text
detect_changes(scope="all")
```

Expected affected scope:

- teacher dashboard shell;
- sidebar;
- overview;
- CreateTab empty state;
- tests/Cypress.

Unexpected and phải dừng nếu xuất hiện:

- Worker/API routes;
- scoring;
- results/student flows;
- D1 migrations;
- assignment persistence.

- [ ] **Step 6: Primary code review và Gemini read-only review**

Review tập trung:

- route không đổi;
- manual workspace disabled fallback;
- stale Zustand envelope được reset khi bắt đầu đề mới;
- accessibility;
- không có dead `BottomNavigation` integration;
- không có dữ liệu/lưu đề bị thay đổi.

## Baseline Evidence (2026-08-05)

Đã chạy trước khi triển khai:

```bash
npm run test:ci -- tests/routeGuards.test.tsx tests/ManualQuizWorkspaceRoute.test.tsx tests/TeacherDashboardShell.test.tsx tests/TeacherSidebarAccessibility.test.tsx tests/TeacherOverview.test.tsx tests/teacherOverviewA11y.test.tsx tests/teacherOverviewAxe.test.tsx tests/CreateTab.manualNavigation.test.tsx
```

Kết quả: **8 test files PASS, 60 tests PASS**. Vitest hiện có cảnh báo React `act(...)` từ `ActionCenterPanel` trong các Overview tests; đây là baseline warning có sẵn, không phải lỗi của feature. Không mở rộng scope để sửa cảnh báo này, nhưng không được làm tăng số lượng/cường độ warning.

## Acceptance Criteria

1. Khi manual workspace bật, sidebar có hai CTA riêng.
2. Tổng quan có khu vực hai thẻ riêng, không làm lệch `QuickActionGrid`.
3. Tìm kiếm token-based phân biệt AI và thủ công, hỗ trợ truy vấn không dấu; datalist không hiển thị manual khi flag tắt.
4. Header shell hiển thị `Tạo đề bằng AI` khi flag bật và `Tạo đề mới` khi flag tắt; heading nội bộ `CreateTab` cũng chuyển AI/legacy đúng theo flag.
5. AI vẫn dùng `/teacher/quizzes?mode=create`.
6. Manual vẫn dùng `/teacher/quizzes/new`.
7. Edit route không đổi.
8. Trang AI không còn nút thủ công khi workspace bật; trang thủ công mới nhận đúng lớp giáo viên qua canonical `manualQuizSeed`.
9. Khi workspace tắt, UI/fallback legacy vẫn hoạt động.
10. Không sửa Worker, D1, API, assignment hoặc publish logic.
11. Không tích hợp lại `BottomNavigation.tsx`.
12. Tất cả focused tests, full frontend gates và Cypress liên quan đều PASS.

## Stop Conditions

Dừng và báo người dùng nếu:

- Cần đổi `getTeacherRoute` hoặc `AppRoutes` để hoàn thành UI.
- Cần sửa Worker/D1/API.
- Manual CTA mở nhầm stale envelope hoặc làm mất draft.
- Workspace flag tắt nhưng không còn đường soạn thủ công fallback, hoặc datalist/header vẫn quảng bá workspace thủ công.
- Tests route, AI generation hoặc manual workspace bị regression.
- Scope lan sang assignment/publish/scoring/student data.
- Có yêu cầu commit, push hoặc deploy nhưng chưa được người dùng cho phép.

## Deferred: AI → Unified Workspace

Không thực hiện trong plan này. Feature đó cần một design/plan riêng vì phải giải quyết đầy đủ:

1. `AssignmentSection` hiện tạo assignment sau khi AI save; workspace publish hiện không làm việc này.
2. Phải dùng `Quiz['sourceType']` hiện có, không tạo union mới. Giá trị canonical gồm `manual`, `ai`, `word_import`, `excel_import`, `question_bank`, `template`, `duplicated`.
3. Câu hỏi phải deep clone bằng `structuredClone`, không shallow clone nested options/media.
4. Handoff phải là draft-first hoặc local-draft-first; không chỉ dựa vào `location.state`.
5. Draft hiện giới hạn 1.000.000 bytes và 300 câu; phải preflight và xử lý SVG/media/base64.
6. Phải giữ quality summary, target points, assignment intent và đảm bảo publish idempotent.
7. Refresh, multiple tabs, offline và conflict recovery phải có test riêng.

## Suggested Commit Boundaries

Chỉ commit khi người dùng yêu cầu:

```text
feat(teacher): add separate quiz creation actions
feat(teacher): split quiz creation choices on overview
refactor(ai-quiz): hide manual entry when workspace is enabled
feat(teacher): support manual quiz destination in dashboard search
chore(test): cover quiz creation entry points
```
