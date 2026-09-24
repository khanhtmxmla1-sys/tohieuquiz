import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuizHeader from '../src/features/quiz-player/components/QuizHeader';
import { getAvatarUrl } from '../src/config/avatars';

describe('QuizHeader student avatar', () => {
  it('renders the student avatar when the standard quiz opts in', () => {
    render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar="https://assets.example.test/an.png"
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      'https://assets.example.test/an.png',
    );
  });

  it('renders Hà Minh Khang with the exact configured girl_07 avatar', () => {
    render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="Hà Minh Khang"
        avatar="girl_07"
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của Hà Minh Khang' })).toHaveAttribute(
      'src',
      '/avatars/students/girl_07.webp',
    );
  });

  it('uses the configured default avatar when avatar data is missing', () => {
    render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar={null}
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      getAvatarUrl(),
    );
  });

  it('keeps supported direct URLs and internal paths while normalizing invalid ids', () => {
    const { rerender } = render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar=" /avatar2.webp "
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      '/avatar2.webp',
    );

    rerender(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar="not-a-known-avatar"
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      getAvatarUrl('not-a-known-avatar'),
    );

    rerender(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar="https://assets.example.test/an.png"
        showAvatar
      />,
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      'https://assets.example.test/an.png',
    );
  });

  it('falls back once to the default image and then to the student initial', () => {
    const { container, rerender } = render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar="boy_02"
        showAvatar
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Ảnh đại diện của An' }));
    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      getAvatarUrl(),
    );

    fireEvent.error(screen.getByRole('img', { name: 'Ảnh đại diện của An' }));
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveTextContent('A');
    rerender(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice
        studentName="An"
        avatar="boy_03"
        showAvatar
      />,
    );
    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      getAvatarUrl('boy_03'),
    );
  });

  it('does not add an avatar to shared quiz headers unless explicitly enabled', () => {
    render(
      <QuizHeader
        title="Thi thử"
        timeLeft={600}
        totalQuestions={10}
        completedCount={0}
        partialCount={0}
        isPractice={false}
        studentName="Thi trực tiếp"
        avatar={null}
      />,
    );

    expect(screen.queryByRole('img', { name: 'Ảnh đại diện của Thi trực tiếp' })).not.toBeInTheDocument();
  });
});
