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
