import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManualTab } from '../src/features/class-management/components/Modals/AddStudentModal/ManualTab';

describe('ManualTab credential generation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates username and password without Math.random', () => {
    const mathRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for credentials');
    });
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array: any) => {
      array.fill(0);
      return array;
    });

    const { container } = render(
      <ManualTab classId="class-1" onClose={vi.fn()} onSubmit={vi.fn()} isLoading={false} />,
    );

    fireEvent.change(screen.getByPlaceholderText('Hoc Sinh Mau'), { target: { value: 'Nguyễn Văn A' } });

    expect(screen.getByPlaceholderText('an.nv.123')).toHaveValue('a.nv.100');
    expect(container.querySelector('input[type="password"]')).toHaveValue('aaaaaa');
    expect(mathRandom).not.toHaveBeenCalled();
  });
});
