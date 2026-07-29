import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from '../src/components/HomePage/components/LoginForm';

const renderForm = (activeTab: 'student' | 'teacher', onPasskey = vi.fn()) => render(
  <LoginForm
    activeTab={activeTab}
    setActiveTab={vi.fn()}
    username="teacher-a"
    setUsername={vi.fn()}
    password=""
    setPassword={vi.fn()}
    isLoading={false}
    onSubmit={vi.fn()}
    onPasskey={onPasskey}
    passkeyAvailable
  />,
);

describe('LoginForm passkey option', () => {
  it('shows passkey only for the teacher tab and does not submit the password form', () => {
    const onPasskey = vi.fn();
    renderForm('teacher', onPasskey);
    fireEvent.click(screen.getByRole('button', { name: '??ng nh?p b?ng passkey' }));
    expect(onPasskey).toHaveBeenCalledTimes(1);
  });

  it('does not expose staff passkeys to the student tab', () => {
    renderForm('student');
    expect(screen.queryByRole('button', { name: '??ng nh?p b?ng passkey' })).not.toBeInTheDocument();
  });
});
