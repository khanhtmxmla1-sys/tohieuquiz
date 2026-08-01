# Teacher Account Menu System Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển `Cài đặt cá nhân` và toàn bộ điều hướng `Quản trị hệ thống` từ sidebar sang menu tài khoản góc trên bên phải mà không thay đổi route, quyền backend hoặc nội dung các trang hiện có.

**Architecture:** Thay menu tài khoản dựa trên `<details>` bằng một popover có state điều khiển, hỗ trợ đóng khi bấm ra ngoài và nhấn `Escape`, đồng thời tự mở nhóm quản trị khi tab quản trị đang active. `TeacherDashboardHeader` tiếp tục nhận callback điều hướng chuẩn và truyền xuống `TeacherAccountMenu`; `Sidebar` chỉ bỏ các nhóm tài khoản/hệ thống, giữ nguyên các nhóm nghiệp vụ và nút đăng xuất hiện tại.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide React, Zustand, Vitest, Testing Library.

## Global Constraints

- Không triển khai sidebar thu gọn/mở rộng trong thay đổi này.
- Không đổi route hoặc tên tab nội bộ.
- Không đổi hệ thống phân quyền hiện tại; `isAdmin` chỉ quyết định khả năng hiển thị, guard/backend vẫn là lớp bảo vệ chính.
- Không đổi nội dung các màn hình quản trị.
- Không thiết kế lại toàn bộ header.
- Không xóa nút tắt `Quản lý thông báo` đang có trên header.
- Giữ nút `Đăng xuất` ở sidebar trong phạm vi thay đổi này.
- `Cài đặt cá nhân` hiển thị cho mọi tài khoản.
- `Quản trị hệ thống` chỉ render khi `isAdmin === true`.
- Nhãn menu quản trị phải là: `Quản lý thông báo`, `Quản lý giáo viên`, `Kiểm tra lỗi công thức`, `Trạng thái hệ thống`.
- Menu quản trị chỉ mở bằng click, không mở bằng hover.
- Bấm một mục điều hướng phải đóng dropdown.
- Bấm ra ngoài hoặc nhấn `Escape` phải đóng dropdown; `Escape` trả focus về trigger tài khoản.
- Khi mở menu trong lúc một tab quản trị đang active, nhóm quản trị phải mở sẵn.
- Dropdown rộng `300px`, dùng `max-width: calc(100vw - 16px)`, item có chiều cao tối thiểu `44px`.
- Icon đăng xuất phải dùng `LogOut`, không dùng `X`.

---

## File Map

**Create**

- `tests/TeacherAccountMenu.test.tsx` — kiểm thử trực tiếp hành vi, phân quyền, active state, click-outside, Escape và đăng xuất của menu tài khoản.

**Modify**

- `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherAccountMenu.tsx` — triển khai popover điều khiển và submenu quản trị.
- `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx` — truyền `activeTab`, tên tài khoản và callback điều hướng vào menu tài khoản.
- `tests/TeacherDashboardShell.test.tsx` — kiểm tra menu tài khoản điều hướng qua route chuẩn trong shell thật.
- `src/components/TeacherDashboard/Sidebar.tsx` — xóa nhóm `Tài khoản` và `Quản trị hệ thống` cùng cấu hình liên quan.
- `tests/TeacherSidebarAccessibility.test.tsx` — xác nhận hai nhóm đã biến mất với cả giáo viên và admin, đồng thời các nhóm nghiệp vụ vẫn còn.

**Read-only contracts**

- `src/stores/useTeacherDashboardUIStore.ts` — dùng type `TeacherDashboardTab`; không sửa.
- `src/app/navigationRoutes.ts` — tiếp tục dùng mapping route hiện có; không sửa.
- `docs/superpowers/specs/2026-08-01-account-menu-system-admin-design.md` — nguồn yêu cầu đã duyệt.

---

### Task 1: Xây menu tài khoản có điều hướng cá nhân và quản trị

**Files:**
- Create: `tests/TeacherAccountMenu.test.tsx`
- Modify: `tests/TeacherDashboardShell.test.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherAccountMenu.tsx`
- Modify: `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`

**Interfaces:**
- Consumes: `TeacherDashboardTab` từ `src/stores/useTeacherDashboardUIStore.ts`.
- Consumes: callback `(tab: TeacherDashboardTab) => void` đã điều hướng qua `getTeacherRoute` trong shell.
- Produces: `TeacherAccountMenuProps` với `activeTab`, `displayName`, `initial`, `accountLabel`, `isAdmin`, `onNavigate`, `onLogout`.
- Produces: menu có `role="menu"`, item có `role="menuitem"`, nhóm quản trị có `aria-expanded` và `aria-controls`.

- [ ] **Step 1: Tạo kiểm thử component đang thất bại**

Tạo `tests/TeacherAccountMenu.test.tsx` với toàn bộ nội dung sau:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeacherAccountMenu } from '../src/components/TeacherDashboard/teacher-dashboard-shell/TeacherAccountMenu';
import type { TeacherDashboardTab } from '../src/stores/useTeacherDashboardUIStore';

const renderMenu = (options: {
  activeTab?: TeacherDashboardTab;
  isAdmin?: boolean;
  onNavigate?: (tab: TeacherDashboardTab) => void;
  onLogout?: () => void;
} = {}) => {
  const onNavigate = options.onNavigate ?? vi.fn();
  const onLogout = options.onLogout ?? vi.fn();

  const view = render(
    <TeacherAccountMenu
      activeTab={options.activeTab ?? 'overview'}
      displayName="Cô An"
      initial="A"
      accountLabel="teacher-a"
      isAdmin={options.isAdmin ?? false}
      onNavigate={onNavigate}
      onLogout={onLogout}
    />,
  );

  return { ...view, onNavigate, onLogout };
};

const openAccountMenu = () => {
  const trigger = screen.getByRole('button', { name: /Mở menu tài khoản của Cô An/i });
  fireEvent.click(trigger);
  return trigger;
};

describe('TeacherAccountMenu', () => {
  it('shows personal settings to teachers and hides system administration', () => {
    const { onNavigate } = renderMenu();

    openAccountMenu();

    expect(screen.getByRole('menu', { name: 'Menu tài khoản giáo viên' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Cài đặt cá nhân' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Quản trị hệ thống' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Cài đặt cá nhân' }));

    expect(onNavigate).toHaveBeenCalledWith('personal-settings');
    expect(screen.queryByRole('menu', { name: 'Menu tài khoản giáo viên' })).not.toBeInTheDocument();
  });

  it('opens the administration group automatically when an admin tab is active', () => {
    renderMenu({ activeTab: 'operations', isAdmin: true });

    openAccountMenu();

    const administration = screen.getByRole('menuitem', { name: 'Quản trị hệ thống' });
    expect(administration).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Quản lý thông báo' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Quản lý giáo viên' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Kiểm tra lỗi công thức' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Trạng thái hệ thống' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    ['Quản lý thông báo', 'announcements'],
    ['Quản lý giáo viên', 'teachers'],
    ['Kiểm tra lỗi công thức', 'math-audit'],
    ['Trạng thái hệ thống', 'operations'],
  ] as const)('navigates to %s and closes the menu', (label, tab) => {
    const { onNavigate } = renderMenu({ isAdmin: true });

    openAccountMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quản trị hệ thống' }));
    fireEvent.click(screen.getByRole('menuitem', { name: label }));

    expect(onNavigate).toHaveBeenCalledWith(tab);
    expect(screen.queryByRole('menu', { name: 'Menu tài khoản giáo viên' })).not.toBeInTheDocument();
  });

  it('closes on outside click', () => {
    renderMenu();

    openAccountMenu();
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu', { name: 'Menu tài khoản giáo viên' })).not.toBeInTheDocument();
  });

  it('closes on Escape and restores focus to the trigger', () => {
    renderMenu();

    const trigger = openAccountMenu();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Menu tài khoản giáo viên' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('uses the existing logout callback and renders the semantic logout icon', () => {
    const { container, onLogout } = renderMenu();

    openAccountMenu();
    expect(container.querySelector('.lucide-log-out')).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: 'Menu tài khoản giáo viên' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Bổ sung kiểm thử shell đang thất bại**

Trong `tests/TeacherDashboardShell.test.tsx`, thêm hai test sau ngay sau test `gives every teacher an inbox while reserving notification management for admins`:

```tsx
  it('navigates teachers to personal settings from the account menu', async () => {
    render(<TeacherDashboard />);

    await click(screen.getByRole('button', { name: /Mở menu tài khoản của Cô An/i }));

    expect(screen.queryByRole('menuitem', { name: 'Quản trị hệ thống' })).toBeNull();
    await click(screen.getByRole('menuitem', { name: 'Cài đặt cá nhân' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/settings');
  });

  it('navigates admins to system pages from the account menu', async () => {
    useAuthStore.setState({ isAdmin: true } as any);
    render(<TeacherDashboard />);

    await click(screen.getByRole('button', { name: /Mở menu tài khoản của Cô An/i }));
    const administration = screen.getByRole('menuitem', { name: 'Quản trị hệ thống' });
    expect(administration).toHaveAttribute('aria-expanded', 'false');

    await click(administration);
    await click(screen.getByRole('menuitem', { name: 'Trạng thái hệ thống' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/operations');
  });
```

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại đúng lý do**

Run:

```bash
npm run test:run -- tests/TeacherAccountMenu.test.tsx tests/TeacherDashboardShell.test.tsx
```

Expected: FAIL vì `TeacherAccountMenu` chưa nhận `activeTab`, `accountLabel`, `onNavigate`; chưa có các menuitem mới và chưa có submenu quản trị.

- [ ] **Step 4: Thay `TeacherAccountMenu.tsx` bằng implementation điều khiển đầy đủ**

Thay toàn bộ `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherAccountMenu.tsx` bằng:

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  LogOut,
  Megaphone,
  ScanSearch,
  ServerCog,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

interface TeacherAccountMenuProps {
  activeTab: TeacherDashboardTab;
  displayName: string;
  initial: string;
  accountLabel?: string;
  isAdmin: boolean;
  onNavigate: (tab: TeacherDashboardTab) => void;
  onLogout: () => void;
}

type AdminMenuItem = {
  id: TeacherDashboardTab;
  label: string;
  icon: LucideIcon;
};

const ACCOUNT_MENU_ID = 'teacher-account-menu';
const ADMIN_MENU_ID = 'teacher-account-admin-menu';

const ADMIN_ITEMS: readonly AdminMenuItem[] = [
  { id: 'announcements', label: 'Quản lý thông báo', icon: Megaphone },
  { id: 'teachers', label: 'Quản lý giáo viên', icon: Users },
  { id: 'math-audit', label: 'Kiểm tra lỗi công thức', icon: ScanSearch },
  { id: 'operations', label: 'Trạng thái hệ thống', icon: ServerCog },
];

const isAdminTab = (tab: TeacherDashboardTab) => (
  ADMIN_ITEMS.some((item) => item.id === tab)
);

const navigationItemClass = (active: boolean) => [
  'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm',
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]',
  active
    ? 'bg-[#F0F9FF] font-semibold text-[#0284C7]'
    : 'font-medium text-[#526174] hover:bg-[#F8FAFC] hover:text-[#0284C7]',
].join(' ');

export const TeacherAccountMenu = ({
  activeTab,
  displayName,
  initial,
  accountLabel,
  isAdmin,
  onNavigate,
  onLogout,
}: TeacherAccountMenuProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const adminActive = isAdminTab(activeTab);

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isAdmin) setIsAdminOpen(false);
  }, [isAdmin]);

  const toggleMenu = () => {
    const nextOpen = !isOpen;
    if (nextOpen) setIsAdminOpen(adminActive);
    setIsOpen(nextOpen);
  };

  const navigateAndClose = (tab: TeacherDashboardTab) => {
    onNavigate(tab);
    setIsOpen(false);
  };

  const logoutAndClose = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <div ref={rootRef} className="relative border-l border-[#E5E7EB] pl-2 sm:pl-3">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Mở menu tài khoản của ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={ACCOUNT_MENU_ID}
        onClick={toggleMenu}
        className="flex min-h-11 items-center gap-3 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
      >
        <span className="hidden flex-col items-end sm:flex">
          <span className="text-sm font-semibold leading-tight text-[#172033]">{displayName}</span>
          <span className="text-xs font-medium text-[#7A8796]">
            {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
          </span>
        </span>
        <span className="flex size-10 items-center justify-center rounded-full border border-[#BAE6FD] bg-[#0EA5E9] font-semibold text-white transition-colors hover:bg-[#0284C7]">
          {initial}
        </span>
      </button>

      {isOpen && (
        <div
          id={ACCOUNT_MENU_ID}
          role="menu"
          aria-label="Menu tài khoản giáo viên"
          className="absolute right-0 top-full z-50 mt-2 w-[300px] max-w-[calc(100vw-16px)] overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(23,32,51,0.10)]"
        >
          <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-[#F8FAFC] p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#BAE6FD] bg-white font-semibold text-[#0284C7]">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#172033]">{displayName}</p>
              <p className="text-xs font-medium text-[#7A8796]">
                {isAdmin ? 'Quản trị viên' : 'Giáo viên'}
              </p>
              {accountLabel && (
                <p className="mt-0.5 truncate text-xs text-[#9AA5B1]" title={accountLabel}>
                  {accountLabel}
                </p>
              )}
            </div>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              aria-current={activeTab === 'personal-settings' ? 'page' : undefined}
              onClick={() => navigateAndClose('personal-settings')}
              className={navigationItemClass(activeTab === 'personal-settings')}
            >
              <Settings aria-hidden="true" className="size-[18px]" />
              <span>Cài đặt cá nhân</span>
            </button>

            {isAdmin && (
              <div className="mt-1">
                <button
                  type="button"
                  role="menuitem"
                  aria-expanded={isAdminOpen}
                  aria-controls={ADMIN_MENU_ID}
                  onClick={() => setIsAdminOpen((open) => !open)}
                  className={navigationItemClass(adminActive)}
                >
                  <ShieldCheck aria-hidden="true" className="size-[18px]" />
                  <span className="flex-1">Quản trị hệ thống</span>
                  <ChevronRight
                    aria-hidden="true"
                    className={`size-4 transition-transform ${isAdminOpen ? 'rotate-90' : ''}`}
                  />
                </button>

                {isAdminOpen && (
                  <div
                    id={ADMIN_MENU_ID}
                    role="group"
                    aria-label="Các chức năng quản trị hệ thống"
                    className="ml-4 mt-1 space-y-0.5 border-l border-[#E5E7EB] pl-2"
                  >
                    {ADMIN_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          aria-current={active ? 'page' : undefined}
                          onClick={() => navigateAndClose(item.id)}
                          className={navigationItemClass(active)}
                        >
                          <Icon aria-hidden="true" className="size-[18px]" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[#E5E7EB] p-2">
            <button
              type="button"
              role="menuitem"
              onClick={logoutAndClose}
              className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm font-medium text-[#526174] transition-colors hover:bg-[#FFF4F1] hover:text-[#B94733] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E76F51]"
            >
              <LogOut aria-hidden="true" className="size-[18px]" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Truyền đúng dữ liệu và callback từ header**

Trong `src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx`, thay block hiện tại:

```tsx
      <TeacherAccountMenu
        displayName={props.teacherDisplayName}
        initial={props.teacherInitial}
        isAdmin={props.isAdmin}
        onLogout={props.onLogout}
      />
```

bằng:

```tsx
      <TeacherAccountMenu
        activeTab={props.activeTab}
        displayName={props.teacherDisplayName}
        initial={props.teacherInitial}
        accountLabel={props.notificationUserId}
        isAdmin={props.isAdmin}
        onNavigate={props.setActiveTab}
        onLogout={props.onLogout}
      />
```

Không thay đổi nút `Quản lý thông báo` độc lập đang nằm ngay phía trên block này.

- [ ] **Step 6: Chạy kiểm thử component và shell**

Run:

```bash
npm run test:run -- tests/TeacherAccountMenu.test.tsx tests/TeacherDashboardShell.test.tsx
```

Expected: PASS; các route `/teacher/settings` và `/teacher/operations` được gọi đúng, giáo viên không thấy submenu quản trị, admin điều hướng được qua submenu.

- [ ] **Step 7: Chạy typecheck cho interface mới**

Run:

```bash
npm run typecheck
```

Expected: PASS, không còn call site nào thiếu props mới của `TeacherAccountMenu`.

- [ ] **Step 8: Commit phần menu tài khoản**

```bash
git add \
  tests/TeacherAccountMenu.test.tsx \
  tests/TeacherDashboardShell.test.tsx \
  src/components/TeacherDashboard/teacher-dashboard-shell/TeacherAccountMenu.tsx \
  src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx
git commit -m "feat: move account admin navigation into profile menu"
```

---

### Task 2: Xóa điều hướng tài khoản và hệ thống khỏi sidebar

**Files:**
- Modify: `tests/TeacherSidebarAccessibility.test.tsx`
- Modify: `src/components/TeacherDashboard/Sidebar.tsx`

**Interfaces:**
- Consumes: `authStore.isAdmin` vẫn được dùng để hiển thị `Mẫu chứng nhận`; không xóa `useAuthStore`.
- Produces: sidebar chỉ còn các nhóm nghiệp vụ `Đề thi`, `Dạy và giao bài`, `Học sinh`, `Tiện ích`, `Chứng nhận`.
- Produces: không còn `GroupKey` là `account` hoặc `system`.

- [ ] **Step 1: Thay test cũ bằng kiểm thử thất bại cho cả hai vai trò**

Trong `tests/TeacherSidebarAccessibility.test.tsx`, thay test:

```tsx
    it('does not show Operations Center to teachers', () => {
        renderSidebar();
        expect(screen.queryByText('Operations Center')).not.toBeInTheDocument();
    });
```

bằng hai test:

```tsx
    it('keeps account and system destinations out of the teacher sidebar', () => {
        renderSidebar();

        expect(screen.queryByRole('button', { name: 'Tài khoản' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Quản trị hệ thống' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Đề thi' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Dạy và giao bài' })).toBeInTheDocument();
    });

    it('keeps account and system destinations out of the admin sidebar', () => {
        useAuthStore.setState({ isAdmin: true });
        renderSidebar();

        expect(screen.queryByRole('button', { name: 'Tài khoản' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Quản trị hệ thống' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Chứng nhận' })).toBeInTheDocument();
    });
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run:

```bash
npm run test:run -- tests/TeacherSidebarAccessibility.test.tsx
```

Expected: FAIL vì sidebar hiện vẫn render nút nhóm `Tài khoản` cho giáo viên và cả `Tài khoản`, `Quản trị hệ thống` cho admin.

- [ ] **Step 3: Xóa import chỉ phục vụ hai nhóm đã chuyển**

Trong `src/components/TeacherDashboard/Sidebar.tsx`, đổi import Lucide từ:

```tsx
import {
    Award,
    BookText,
    ChevronRight,
    ClipboardList,
    FileText,
    Gift,
    GraduationCap,
    Home,
    LayoutTemplate,
    List,
    LogOut,
    Megaphone,
    PlusCircle,
    Radio,
    ScanSearch,
    Settings,
    ServerCog,
    Users,
} from 'lucide-react';
```

thành:

```tsx
import {
    Award,
    BookText,
    ChevronRight,
    ClipboardList,
    FileText,
    Gift,
    GraduationCap,
    Home,
    LayoutTemplate,
    List,
    LogOut,
    PlusCircle,
    Radio,
} from 'lucide-react';
```

- [ ] **Step 4: Thu hẹp `GroupKey`, `GROUP_KEYS` và `groupForTab`**

Thay:

```tsx
type GroupKey = 'exams' | 'teaching' | 'students' | 'utilities' | 'certificates' | 'account' | 'system';
```

bằng:

```tsx
type GroupKey = 'exams' | 'teaching' | 'students' | 'utilities' | 'certificates';
```

Thay:

```tsx
const GROUP_KEYS: GroupKey[] = [
    'exams',
    'teaching',
    'students',
    'utilities',
    'certificates',
    'account',
    'system',
];
```

bằng:

```tsx
const GROUP_KEYS: GroupKey[] = [
    'exams',
    'teaching',
    'students',
    'utilities',
    'certificates',
];
```

Trong `groupForTab`, xóa hai nhánh sau:

```tsx
    if (tab === 'personal-settings') return 'account';
    if (['announcements', 'teachers', 'math-audit', 'operations'].includes(tab)) return 'system';
```

Giữ nguyên các nhánh cho `exams`, `teaching`, `students`, `utilities`, `certificates`.

- [ ] **Step 5: Xóa cấu hình item của tài khoản và hệ thống**

Xóa toàn bộ hai block sau khỏi `Sidebar.tsx`:

```tsx
    const accountItems: NavItem[] = [
        { id: 'personal-settings', label: 'Cài đặt cá nhân', icon: <Settings className="size-5" /> },
    ];

    const settingItems: NavItem[] = [
        { id: 'announcements', label: 'Thông báo', icon: <Megaphone className="size-5" /> },
        { id: 'teachers', label: 'Giáo viên', icon: <Users className="size-5" /> },
        { id: 'math-audit', label: 'Theo dõi lỗi công thức', icon: <ScanSearch className="size-5" /> },
        { id: 'operations', label: 'Operations Center', icon: <ServerCog className="size-5" /> },
    ];
```

Không xóa `certificateItems`, vì admin vẫn cần mục `Mẫu chứng nhận` trong nhóm `Chứng nhận`.

- [ ] **Step 6: Xóa hai `NavGroup` khỏi JSX**

Trong phần `<nav>`, thay:

```tsx
                    <NavGroup title="Đề thi" items={examItems} groupKey="exams" />
                    <NavGroup title="Dạy và giao bài" items={teachingItems} groupKey="teaching" />
                    <NavGroup title="Học sinh" items={studentItems} groupKey="students" />
                    <NavGroup title="Tiện ích" items={utilityItems} groupKey="utilities" />
                    <NavGroup title="Chứng nhận" items={certificateItems} groupKey="certificates" />
                    <NavGroup title="Tài khoản" items={accountItems} groupKey="account" />
                    <NavGroup title="Quản trị hệ thống" items={settingItems} groupKey="system" adminOnly />
```

bằng:

```tsx
                    <NavGroup title="Đề thi" items={examItems} groupKey="exams" />
                    <NavGroup title="Dạy và giao bài" items={teachingItems} groupKey="teaching" />
                    <NavGroup title="Học sinh" items={studentItems} groupKey="students" />
                    <NavGroup title="Tiện ích" items={utilityItems} groupKey="utilities" />
                    <NavGroup title="Chứng nhận" items={certificateItems} groupKey="certificates" />
```

Giữ nguyên nút `Đăng xuất` ở cuối sidebar.

- [ ] **Step 7: Chạy kiểm thử sidebar**

Run:

```bash
npm run test:run -- tests/TeacherSidebarAccessibility.test.tsx
```

Expected: PASS cho cả giáo viên và admin; hai nhóm tài khoản/hệ thống không còn, các nhóm nghiệp vụ vẫn render.

- [ ] **Step 8: Chạy typecheck để bắt import hoặc union còn sót**

Run:

```bash
npm run typecheck
```

Expected: PASS; không còn tham chiếu đến `accountItems`, `settingItems`, `account` hoặc `system` trong `Sidebar.tsx`.

- [ ] **Step 9: Commit phần dọn sidebar**

```bash
git add \
  tests/TeacherSidebarAccessibility.test.tsx \
  src/components/TeacherDashboard/Sidebar.tsx
git commit -m "refactor: remove account admin groups from teacher sidebar"
```

---

### Task 3: Xác minh toàn bộ thay đổi trước khi bàn giao

**Files:**
- Verify only; không tạo hoặc sửa file nếu tất cả lệnh đều pass.

**Interfaces:**
- Consumes: kết quả của Task 1 và Task 2.
- Produces: bằng chứng rằng menu, sidebar, type system, lint và production build đều ổn định.

- [ ] **Step 1: Chạy toàn bộ test liên quan trong một lệnh**

Run:

```bash
npm run test:run -- \
  tests/TeacherAccountMenu.test.tsx \
  tests/TeacherSidebarAccessibility.test.tsx \
  tests/TeacherDashboardShell.test.tsx
```

Expected: PASS, không có test fail hoặc snapshot thay đổi ngoài dự kiến.

- [ ] **Step 2: Chạy typecheck frontend và workers**

Run:

```bash
npm run typecheck && npm run typecheck:workers
```

Expected: cả hai lệnh exit code `0`.

- [ ] **Step 3: Chạy lint toàn dự án**

Run:

```bash
npm run lint
```

Expected: exit code `0`, không có warning vì script dùng `--max-warnings=0`.

- [ ] **Step 4: Chạy production build**

Run:

```bash
npm run build
```

Expected: build hoàn tất, không có lỗi import, type hoặc bundle.

- [ ] **Step 5: Kiểm tra thủ công hành vi UI ở hai vai trò**

Khởi động local app:

```bash
npm run dev
```

Xác minh trên desktop và viewport mobile:

1. Giáo viên mở avatar: thấy `Cài đặt cá nhân`, không thấy `Quản trị hệ thống`.
2. Admin mở avatar: thấy `Cài đặt cá nhân` và nhóm `Quản trị hệ thống`.
3. Bốn mục quản trị mở đúng trang và dropdown đóng sau click.
4. Click ngoài và `Escape` đóng dropdown; sau `Escape`, focus trở lại avatar.
5. Trên màn hình hẹp, dropdown không vượt mép viewport và các item vẫn có vùng chạm tối thiểu `44px`.
6. Sidebar không còn nhóm `Tài khoản` và `Quản trị hệ thống`, nhưng vẫn còn `Đề thi`, `Dạy và giao bài`, `Học sinh`, `Tiện ích`, `Chứng nhận`.
7. Nút `Quản lý thông báo` độc lập trên header vẫn hoạt động với admin.
8. Nút `Đăng xuất` ở sidebar và menu tài khoản đều vẫn gọi luồng đăng xuất hiện tại.

Expected: tất cả tám kiểm tra đạt, không có lỗi console mới.

- [ ] **Step 6: Kiểm tra git diff chỉ chứa thay đổi đúng phạm vi**

Run:

```bash
git status --short
git diff --stat HEAD~2..HEAD
git diff HEAD~2..HEAD -- \
  src/components/TeacherDashboard/teacher-dashboard-shell/TeacherAccountMenu.tsx \
  src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardHeader.tsx \
  src/components/TeacherDashboard/Sidebar.tsx \
  tests/TeacherAccountMenu.test.tsx \
  tests/TeacherDashboardShell.test.tsx \
  tests/TeacherSidebarAccessibility.test.tsx
```

Expected: chỉ có sáu file implementation/test nêu trên trong hai commit tính năng; không đưa `.gitignore` hoặc kế hoạch icon module đang tồn tại vào commit.
