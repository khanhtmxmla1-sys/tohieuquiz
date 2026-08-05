import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardSearch } from '../src/components/TeacherDashboard/teacher-dashboard-shell/useDashboardSearch';

const mocks = vi.hoisted(() => ({ showError: vi.fn() }));

vi.mock('../src/utils/toast', () => ({ showError: mocks.showError }));

const submit = (hook: ReturnType<typeof renderHook<ReturnType<typeof useDashboardSearch>, unknown>>) => {
  act(() => {
    hook.result.current.submitSearch({ preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>);
  });
};

describe('useDashboardSearch', () => {
  beforeEach(() => mocks.showError.mockReset());

  it.each(['tạo đề ai', 'pdf', 'trí tuệ nhân tạo'])('routes %s to the AI creator', (query) => {
    const onSelectTab = vi.fn();
    const hook = renderHook(() => useDashboardSearch({
      onSelectTab,
      onCreateQuizManually: vi.fn(),
      manualQuizWorkspaceEnabled: true,
    }));

    act(() => hook.result.current.setSearchQuery(query));
    submit(hook);

    expect(onSelectTab).toHaveBeenCalledWith('create');
  });

  it.each(['soạn thủ công', 'nhập từng câu', 'soan thu cong'])('routes %s to the manual workspace', (query) => {
    const onCreateQuizManually = vi.fn();
    const hook = renderHook(() => useDashboardSearch({
      onSelectTab: vi.fn(),
      onCreateQuizManually,
      manualQuizWorkspaceEnabled: true,
    }));

    act(() => hook.result.current.setSearchQuery(query));
    submit(hook);

    expect(onCreateQuizManually).toHaveBeenCalledTimes(1);
  });

  it('removes the manual destination and uses the legacy create label when the workspace is disabled', () => {
    const onCreateQuizManually = vi.fn();
    const hook = renderHook(() => useDashboardSearch({
      onSelectTab: vi.fn(),
      onCreateQuizManually,
      manualQuizWorkspaceEnabled: false,
    }));

    expect(hook.result.current.searchOptions.some((item) => item.kind === 'manual-quiz')).toBe(false);
    expect(hook.result.current.searchOptions.find((item) => item.id === 'create')?.label).toBe('Tạo đề mới');

    act(() => hook.result.current.setSearchQuery('soạn thủ công'));
    submit(hook);

    expect(onCreateQuizManually).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith('Không tìm thấy chức năng phù hợp.');
  });

  it('does not match the token ai inside the word bài', () => {
    const onSelectTab = vi.fn();
    const hook = renderHook(() => useDashboardSearch({
      onSelectTab,
      onCreateQuizManually: vi.fn(),
      manualQuizWorkspaceEnabled: true,
    }));

    act(() => hook.result.current.setSearchQuery('ai'));
    submit(hook);

    expect(onSelectTab).toHaveBeenCalledWith('create');
    expect(onSelectTab).not.toHaveBeenCalledWith('homework');
  });
});
